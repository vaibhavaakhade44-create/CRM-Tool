import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";

const db = () => (prisma as any);

// ── List bugs ─────────────────────────────────────────────────
export async function listBugs(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { projectId, status, severity, assignedToId, search } = req.query as Record<string, string>;

    const bugs = await db().bug.findMany({
      where: {
        organizationId: orgId,
        ...(projectId && { projectId }),
        ...(status && status !== "ALL" && { status }),
        ...(severity && severity !== "ALL" && { severity }),
        ...(assignedToId && { assignedToId }),
        ...(search && { title: { contains: search, mode: "insensitive" } }),
      },
      include: {
        project: { select: { id: true, name: true } },
        comments: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { comments: true } },
      },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
    });

    ok(res, bugs);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Get single bug ────────────────────────────────────────────
export async function getBug(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const bug = await db().bug.findFirst({
      where: { id: req.params.id as string, organizationId: orgId },
      include: {
        project: { select: { id: true, name: true } },
        comments: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!bug) { notFound(res, "Bug not found"); return; }
    ok(res, bug);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Create bug ────────────────────────────────────────────────
export async function createBug(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { title, description, projectId, severity, priority, assignedToId,
            stepsToRepro, expectedResult, actualResult, environment, tags, dueDate } = req.body;

    if (!title?.trim()) { badRequest(res, "Bug title is required"); return; }

    const bug = await db().bug.create({
      data: {
        organizationId: orgId,
        title: title.trim(),
        description: description ?? null,
        projectId: projectId ?? null,
        severity: severity ?? "MEDIUM",
        priority: priority ?? "MEDIUM",
        assignedToId: assignedToId ?? null,
        reportedById: req.userId ?? null,
        stepsToRepro: stepsToRepro ?? null,
        expectedResult: expectedResult ?? null,
        actualResult: actualResult ?? null,
        environment: environment ?? null,
        tags: Array.isArray(tags) ? tags : [],
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    created(res, bug);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Update bug ────────────────────────────────────────────────
export async function updateBug(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;

    const existing = await db().bug.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Bug not found"); return; }

    const allowedFields = ["title", "description", "severity", "priority", "status",
      "assignedToId", "stepsToRepro", "expectedResult", "actualResult",
      "environment", "tags", "dueDate", "resolvedAt", "closedAt"];

    const data: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (["dueDate", "resolvedAt", "closedAt"].includes(field)) {
          data[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          data[field] = req.body[field];
        }
      }
    }

    const updated = await db().bug.update({ where: { id }, data });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Delete bug ────────────────────────────────────────────────
export async function deleteBug(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().bug.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Bug not found"); return; }
    await db().bug.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Add comment ───────────────────────────────────────────────
export async function addBugComment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const bugId = req.params.id as string;
    const { comment } = req.body;

    if (!comment?.trim()) { badRequest(res, "Comment is required"); return; }

    const bug = await db().bug.findFirst({ where: { id: bugId, organizationId: orgId } });
    if (!bug) { notFound(res, "Bug not found"); return; }

    const c = await db().bugComment.create({
      data: { bugId, comment: comment.trim(), authorId: req.userId ?? null },
    });

    created(res, c);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Bug stats ─────────────────────────────────────────────────
export async function getBugStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { projectId } = req.query as Record<string, string>;

    const where: any = { organizationId: orgId };
    if (projectId) where.projectId = projectId;

    const [bySeverity, byStatus] = await Promise.all([
      db().bug.groupBy({ by: ["severity"], where, _count: { id: true } }),
      db().bug.groupBy({ by: ["status"], where, _count: { id: true } }),
    ]);

    ok(res, { bySeverity, byStatus });
  } catch (err) {
    serverError(res, err);
  }
}
