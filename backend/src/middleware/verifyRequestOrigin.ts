import { Request, Response, NextFunction } from "express";
import { forbidden } from "../utils/response";

/**
 * CSRF defence for cookie-authenticated requests.
 *
 * Auth cookies are SameSite=Lax, so a cross-site POST/PUT/PATCH/DELETE never
 * carries them — that already stops classic CSRF. This adds a second, explicit
 * check: for a state-changing request that is authenticated *by cookie* (no
 * `Authorization` header), the `Origin` (or `Referer`) must be one of our own
 * front-end origins.
 *
 * Requests that carry an `Authorization: Bearer` / `ApiKey` header are exempt —
 * those are not ambient credentials and cannot be driven by a hostile page.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function originAllowed(origin: string): boolean {
  const list = (process.env.FRONTEND_URL || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/localhost:\d+$/.test(origin)) return true;
  return false;
}

export function verifyRequestOrigin(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) { next(); return; }

  // Not cookie-authenticated → not our concern here.
  const hasAuthHeader = typeof req.headers.authorization === "string" && req.headers.authorization.length > 0;
  const cookies = (req as any).cookies || {};
  const hasAuthCookie = !!(cookies.bos_access || cookies.bos_refresh);
  if (hasAuthHeader || !hasAuthCookie) { next(); return; }

  const origin = (req.headers.origin as string) || "";
  const referer = (req.headers.referer as string) || "";
  let source = origin;
  if (!source && referer) {
    try { source = new URL(referer).origin; } catch { source = ""; }
  }

  if (source && originAllowed(source)) { next(); return; }

  forbidden(res, "Cross-origin request blocked.");
}
