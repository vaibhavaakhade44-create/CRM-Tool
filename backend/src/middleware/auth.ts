import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { unauthorized } from "../utils/response";
import { prisma } from "../lib/prisma";
import { apiCache } from "../lib/cache";

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  isSuperAdmin?: boolean;
}

// Short-lived cache of per-user security state so we don't hit the DB on every
// authenticated request, while still catching de-activation / demotion /
// "log out everywhere" within a few seconds instead of a full access-token TTL.
interface UserSecState {
  isActive: boolean;
  isSuperAdmin: boolean;
  // epoch ms of the last password change / forced global logout, or 0
  invalidBefore: number;
}
const SEC_TTL_MS = 15_000;

async function loadUserSecState(userId: string): Promise<UserSecState | null> {
  const cacheKey = `usersec:${userId}`;
  const hit = apiCache.get<UserSecState>(cacheKey);
  if (hit) return hit;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, isSuperAdmin: true, lastPasswordChange: true },
  });
  if (!user) return null;

  const state: UserSecState = {
    isActive: user.isActive,
    isSuperAdmin: user.isSuperAdmin,
    invalidBefore: user.lastPasswordChange ? new Date(user.lastPasswordChange).getTime() : 0,
  };
  apiCache.set(cacheKey, state, SEC_TTL_MS);
  return state;
}

// Call after any change that must take effect immediately (deactivate, role
// change, password change, session revoke) to drop the cached security state.
export function invalidateUserSecState(userId: string): void {
  apiCache.del(`usersec:${userId}`);
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  // Prefer the Authorization header (API clients); fall back to the httpOnly
  // cookie set for the browser SPA.
  const header = req.headers.authorization;
  let token: string | undefined;
  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  } else {
    token = (req as any).cookies?.bos_access;
  }
  if (!token) {
    unauthorized(res);
    return;
  }
  let payload: ReturnType<typeof verifyAccessToken> & { iat?: number };
  try {
    payload = verifyAccessToken(token) as typeof payload;
  } catch {
    unauthorized(res, "Invalid or expired token");
    return;
  }

  // Re-check current security state against the DB (cached ~15s). This is what
  // makes de-activation, demotion and password-change actually revoke a
  // still-valid access token instead of waiting out its 15-minute lifetime.
  try {
    const sec = await loadUserSecState(payload.userId);
    if (!sec || !sec.isActive) {
      unauthorized(res, "Account is inactive");
      return;
    }
    if (payload.iat && sec.invalidBefore && payload.iat * 1000 < sec.invalidBefore - 1000) {
      unauthorized(res, "Session expired. Please log in again.");
      return;
    }
    req.userId = payload.userId;
    req.userEmail = payload.email;
    // Trust the DB, not the (possibly stale) token claim, for privilege level.
    req.isSuperAdmin = sec.isSuperAdmin;
    next();
  } catch {
    // On a DB blip, fall back to the verified token rather than locking everyone
    // out — availability trade-off, bounded by the 15-minute access-token TTL.
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.isSuperAdmin = payload.isSuperAdmin;
    next();
  }
}
