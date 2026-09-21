import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, serverError } from "../utils/response";
import { z } from "zod";

const commentSchema = z.object({
  comment:    z.string().min(1).max(2000),
  isInternal: z.boolean().optional().default(false),
});

// ── GET /api/comments?entityType=X&entityId=Y ────────────────
export async function listComments(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { entityType, entityId } = req.query as { entityType: string; entityId: string };
    if (!entityType || !entityId) { ok(res, []); return; }

    const comments = await (prisma as any).recordComment.findMany({
      where: { organizationId: req.organizationId!, entityType, entityId },
      orderBy: { createdAt: "asc" },
    });
    ok(res, comments);
  } catch (e) { serverError(res, e); }
}

// ── POST /api/comments ────────────────────────────────────────
export async function addComment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { entityType, entityId } = req.body as { entityType: string; entityId: string };
    if (!entityType || !entityId) { ok(res, { error: "entityType and entityId required" }); return; }

    const { comment, isInternal } = commentSchema.parse(req.body);

    // Fetch author info
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { name: true, email: true } });

    const newComment = await (prisma as any).recordComment.create({
      data: {
        organizationId: req.organizationId!,
        entityType,
        entityId,
        comment,
        authorId: req.userId,
        authorName: user?.name,
        authorEmail: user?.email,
        isInternal: isInternal ?? false,
      },
    });
    created(res, newComment);
  } catch (e) { serverError(res, e); }
}

// ── DELETE /api/comments/:id ──────────────────────────────────
export async function deleteComment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const existing = await (prisma as any).recordComment.findFirst({
      where: { id, organizationId: req.organizationId! },
    });
    if (!existing) { notFound(res, "Comment not found"); return; }

    // Only author or admin can delete
    if (existing.authorId !== req.userId) {
      const member = await prisma.organizationMember.findFirst({
        where: { userId: req.userId!, organizationId: req.organizationId! },
      });
      if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
        ok(res, { error: "Permission denied" }); return;
      }
    }

    await (prisma as any).recordComment.delete({ where: { id } });
    ok(res, { message: "Comment deleted" });
  } catch (e) { serverError(res, e); }
}
