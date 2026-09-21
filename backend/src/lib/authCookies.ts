import { Response } from "express";

/**
 * httpOnly auth cookies.
 *
 * Why: the SPA used to keep the access + refresh tokens in localStorage, which
 * means any XSS anywhere on the page can read them and take over the account.
 * httpOnly cookies are not reachable from JavaScript, so an XSS can still act as
 * the user *while the page is open* but cannot exfiltrate a durable credential.
 *
 * The backend still ALSO returns the tokens in the JSON body so header-based
 * (Bearer) clients keep working — the security win comes from the browser client
 * no longer storing them.
 *
 * CSRF: cookies are `SameSite=Lax`, so a cross-site form/POST does not carry
 * them at all. `verifyRequestOrigin` (middleware) is the belt-and-suspenders
 * check for state-changing requests that are authenticated by cookie.
 */

const isProd = process.env.NODE_ENV === "production";

export const ACCESS_COOKIE = "bos_access";
export const REFRESH_COOKIE = "bos_refresh";

const ACCESS_MAX_AGE_MS = 30 * 60 * 1000;          // 30 min — a little longer than the JWT so refresh can run
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — matches refresh token TTL

// SameSite:
//   "lax"  (default) — fine when the SPA and API share a registrable domain
//                      (app.example.com + api.example.com).
//   "none" — REQUIRED when they are different sites (e.g. *.onrender.com pairs,
//            Vercel + Render). "none" implies Secure, so it only works over
//            HTTPS. CSRF is then covered by `verifyRequestOrigin`.
const sameSite = (process.env.AUTH_COOKIE_SAMESITE || "lax").toLowerCase() as "lax" | "strict" | "none";
const secure = isProd || sameSite === "none";

function base() {
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...base(), maxAge: ACCESS_MAX_AGE_MS });
  // Refresh cookie is only ever needed by /api/auth/* — scope it so it is not
  // sent on every API call.
  res.cookie(REFRESH_COOKIE, refreshToken, { ...base(), path: "/api/auth", maxAge: REFRESH_MAX_AGE_MS });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...base() });
  res.clearCookie(REFRESH_COOKIE, { ...base(), path: "/api/auth" });
}
