import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { ok, serverError } from "../utils/response";

const db = () => (prisma as any);

// ── List all sessions for current user ────────────────────────
export async function listSessions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const sessions = await db().userSession.findMany({
      where: { userId: req.userId, isActive: true },
      orderBy: { lastActiveAt: "desc" },
      take: 20,
    });
    ok(res, sessions);
  } catch (e) { serverError(res, e); }
}

// ── Revoke a specific session ─────────────────────────────────
export async function revokeSession(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const session = await db().userSession.findFirst({ where: { id, userId: req.userId } });
    if (!session) { res.status(404).json({ success: false, message: "Session not found" }); return; }

    await db().userSession.update({ where: { id }, data: { isActive: false } });

    // Also revoke the associated refresh token
    if (session.tokenId) {
      await prisma.refreshToken.deleteMany({ where: { id: session.tokenId } });
    }

    ok(res, null, "Session revoked");
  } catch (e) { serverError(res, e); }
}

// ── Revoke ALL other sessions (keep current) ──────────────────
export async function revokeAllOtherSessions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const otherSessions = await db().userSession.findMany({
      where: { userId: req.userId, isActive: true, isCurrent: false },
      select: { id: true, tokenId: true },
    });

    await db().userSession.updateMany({
      where: { userId: req.userId, isCurrent: false },
      data: { isActive: false },
    });

    const tokenIds = otherSessions.map((s: any) => s.tokenId).filter(Boolean);
    if (tokenIds.length) {
      await prisma.refreshToken.deleteMany({ where: { id: { in: tokenIds } } });
    }

    ok(res, { revoked: otherSessions.length }, `${otherSessions.length} session(s) revoked`);
  } catch (e) { serverError(res, e); }
}
