import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ok, notFound } from "../utils/response";

const db = () => (prisma as any);

// Public read — no auth, keyed by publicToken
export async function getPublicProject(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params;

    const project = await db().project.findUnique({
      where: { publicToken: token },
      include: {
        members: {
          include: {
            employee: { select: { name: true, designation: true, department: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
        milestones: { orderBy: { dueDate: "asc" } },
        sprints: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { _count: { select: { tasks: true } } },
        },
      },
    });

    if (!project) { notFound(res, "Project not found or link has been revoked."); return; }

    // Task completion stats
    const taskStats = await db().task.groupBy({
      by: ["status"],
      where: { projectId: project.id },
      _count: { id: true },
    });

    const total = taskStats.reduce((s: number, t: any) => s + t._count.id, 0);
    const done  = taskStats.find((t: any) => t.status === "DONE")?._count?.id ?? 0;
    const inProgress = taskStats.find((t: any) => t.status === "IN_PROGRESS")?._count?.id ?? 0;

    // Active sprint board
    const activeSprint = project.sprints.find((s: any) => s.status === "ACTIVE") ?? null;
    let sprintBoard = null;
    if (activeSprint) {
      const tasks = await db().task.findMany({
        where: { sprintId: activeSprint.id },
        select: { id: true, title: true, status: true, priority: true, storyPoints: true },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      });
      const totalPoints = tasks.reduce((s: number, t: any) => s + (t.storyPoints ?? 0), 0);
      const donePoints  = tasks.filter((t: any) => t.status === "DONE")
        .reduce((s: number, t: any) => s + (t.storyPoints ?? 0), 0);

      sprintBoard = {
        sprint: activeSprint,
        board: {
          TODO:        tasks.filter((t: any) => t.status === "TODO"),
          IN_PROGRESS: tasks.filter((t: any) => t.status === "IN_PROGRESS"),
          IN_REVIEW:   tasks.filter((t: any) => t.status === "IN_REVIEW"),
          DONE:        tasks.filter((t: any) => t.status === "DONE"),
        },
        velocity: { totalPoints, donePoints, pct: totalPoints ? Math.round((donePoints / totalPoints) * 100) : 0 },
      };
    }

    // Strip sensitive fields before returning
    const { publicToken, publicSharedAt, partyId, managerId, createdById, ...safeProject } = project;

    ok(res, {
      ...safeProject,
      taskProgress: { total, done, inProgress, pct: total ? Math.round((done / total) * 100) : 0 },
      sprintBoard,
      sharedAt: publicSharedAt,
    });
  } catch (err) {
    console.error("[public-project]", err);
    res.status(500).json({ success: false, message: "Could not load project." });
  }
}
