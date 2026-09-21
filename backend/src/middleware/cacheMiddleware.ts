import { Request, Response, NextFunction } from "express";
import { apiCache, cacheService } from "../lib/cache";

// Caches successful GET responses, keyed by org + full URL.
// Uses Redis when REDIS_URL is set (shared across all cluster workers),
// falls back to per-worker in-memory LRU otherwise.
export function withCache(ttlMs: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== "GET") { next(); return; }

    const orgId = (req.headers["x-organization-id"] as string) ?? "anon";
    const cacheKey = `${orgId}:${req.originalUrl}`;

    try {
      const cached = await cacheService.get<string>(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(cached);
        return;
      }
    } catch (_) { /* cache miss — proceed normally */ }

    // Intercept res.json to store the serialised body before sending
    const origJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Fire-and-forget: don't delay the response for a cache write
        cacheService.set(cacheKey, JSON.stringify(body), ttlMs).catch(() => {});
      }
      return origJson(body);
    };

    res.setHeader("X-Cache", "MISS");
    next();
  };
}

// Call after any write mutation to keep cached reads fresh.
// Synchronous from caller's perspective; Redis invalidation is fire-and-forget.
export function bustCache(orgId: string, routePrefix: string): void {
  cacheService.invalidatePrefix(`${orgId}:${routePrefix}`);
}

// Expose raw stats for the /api/metrics endpoint
export { apiCache };
