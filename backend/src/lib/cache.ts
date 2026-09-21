// LRU TTL cache — single-threaded per Node worker.
// When REDIS_URL is set, CacheService uses Redis as the primary store and
// falls back to this LRU so every cluster worker shares the same cache.

interface Entry {
  v: unknown;
  exp: number;
}

class LRUCache {
  private map = new Map<string, Entry>();

  constructor(private readonly max: number) {
    // Remove expired entries every minute without blocking the event loop
    setInterval(() => this.sweep(), 60_000).unref();
  }

  get<T>(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (Date.now() > e.exp) { this.map.delete(key); return undefined; }
    // Move to tail (LRU refresh)
    this.map.delete(key);
    this.map.set(key, e);
    return e.v as T;
  }

  set(key: string, value: unknown, ttlMs: number): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.max) {
      this.map.delete(this.map.keys().next().value as string);
    }
    this.map.set(key, { v: value, exp: Date.now() + ttlMs });
  }

  del(key: string): void { this.map.delete(key); }

  invalidatePrefix(prefix: string): void {
    for (const k of this.map.keys()) {
      if (k.startsWith(prefix)) this.map.delete(k);
    }
  }

  stats() {
    return { size: this.map.size, max: this.max };
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, e] of this.map) {
      if (now > e.exp) this.map.delete(k);
    }
  }
}

// 5 000 entries — ~50 MB worst-case at 10 KB/response
export const apiCache = new LRUCache(5_000);

// ── Async cache service ───────────────────────────────────────
// Redis is primary (shared across workers); in-memory LRU is the fallback.
// Both are always written so a Redis miss never causes a cold LRU lookup.
import { redis } from "./redisClient";

class CacheService {
  async get<T>(key: string): Promise<T | undefined> {
    if (redis?.isReady) {
      try {
        const val = await redis.get(key);
        // Guard against Redis cache-poisoning with malformed JSON (LPDoS / secret-leak vector)
        if (val !== null) {
          try { return JSON.parse(val) as T; } catch { /* treat as cache miss */ }
        }
      } catch (_) { /* fall through to LRU */ }
    }
    return apiCache.get<T>(key);
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    apiCache.set(key, value, ttlMs);
    if (redis?.isReady) {
      try {
        await redis.set(key, JSON.stringify(value), { PX: ttlMs });
      } catch (_) { /* LRU already written above */ }
    }
  }

  del(key: string): void {
    apiCache.del(key);
    if (redis?.isReady) {
      redis.del(key).catch(() => {});
    }
  }

  invalidatePrefix(prefix: string): void {
    apiCache.invalidatePrefix(prefix);
    if (redis?.isReady) {
      redis.keys(`${prefix}*`)
        .then((keys) => { if (keys.length) redis!.del(keys).catch(() => {}); })
        .catch(() => {});
    }
  }
}

export const cacheService = new CacheService();
