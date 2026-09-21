import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";

const db = () => (prisma as any);

// ── List sprints for a project ────────────────────────────────
export async function listSprints(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { projectId } = req.query as Record<string, string>;

    const sprints = await db().sprint.findMany({
      where: { organizationId: orgId, ...(projectId && { projectId }) },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          select: { id: true, status: true, storyPoints: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    ok(res, sprints);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Get sprint board (tasks grouped by status) ────────────────
export async function getSprintBoard(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const sprintId = req.params.id;

    const sprint = await db().sprint.findFirst({
      where: { id: sprintId, organizationId: orgId },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!sprint) { notFound(res, "Sprint not found"); return; }

    const tasks = await db().task.findMany({
      where: { sprintId, organizationId: orgId },
      include: {
        project: { select: { id: true, name: true } },
        timeLogs: {
          select: { hours: true, employeeId: true, logDate: true },
          orderBy: { logDate: "desc" },
          take: 5,
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    const board = {
      TODO: tasks.filter((t: any) => t.status === "TODO"),
      IN_PROGRESS: tasks.filter((t: any) => t.status === "IN_PROGRESS"),
      IN_REVIEW: tasks.filter((t: any) => t.status === "IN_REVIEW"),
      DONE: tasks.filter((t: any) => t.status === "DONE"),
    };

    // Velocity / story points
    const totalPoints = tasks.reduce((s: number, t: any) => s + (t.storyPoints ?? 0), 0);
    const donePoints = tasks.filter((t: any) => t.status === "DONE").reduce((s: number, t: any) => s + (t.storyPoints ?? 0), 0);

    ok(res, { sprint, board, stats: { totalPoints, donePoints, totalTasks: tasks.length } });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Create sprint ─────────────────────────────────────────────
export async function createSprint(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { projectId, name, goal, startDate, endDate } = req.body;

    if (!projectId || !name || !startDate || !endDate) {
      badRequest(res, "projectId, name, startDate, endDate required");
      return;
    }

    const project = await db().project.findFirst({ where: { id: projectId, organizationId: orgId } });
    if (!project) { notFound(res, "Project not found"); return; }

    const sprint = await db().sprint.create({
      data: {
        organizationId: orgId,
        projectId,
        name,
        goal: goal ?? null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: "PLANNED",
      },
    });

    created(res, sprint);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Update sprint status ──────────────────────────────────────
export async function updateSprint(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id;

    const existing = await db().sprint.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Sprint not found"); return; }

    const { name, goal, startDate, endDate, status } = req.body;
    const updated = await db().sprint.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(goal !== undefined && { goal }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(status !== undefined && { status }),
      },
    });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Add task to sprint ────────────────────────────────────────
export async function assignTaskToSprint(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const sprintId = req.params.id;
    const { taskId } = req.body;

    const sprint = await db().sprint.findFirst({ where: { id: sprintId, organizationId: orgId } });
    if (!sprint) { notFound(res, "Sprint not found"); return; }

    const task = await prisma.task.findFirst({ where: { id: taskId, organizationId: orgId } });
    if (!task) { notFound(res, "Task not found"); return; }

    await db().task.update({ where: { id: taskId }, data: { sprintId } });
    ok(res, { assigned: true });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Log time against a task ───────────────────────────────────
export async function logTime(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { taskId, employeeId, hours, notes, logDate } = req.body;

    if (!taskId || !employeeId || !hours) {
      badRequest(res, "taskId, employeeId, hours required");
      return;
    }

    const task = await prisma.task.findFirst({ where: { id: taskId, organizationId: orgId } });
    if (!task) { notFound(res, "Task not found"); return; }

    // Tenant-isolation: the employee being logged against must be in this org.
    const emp = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: orgId }, select: { id: true } });
    if (!emp) { notFound(res, "Employee not found"); return; }

    const log = await db().timeLog.create({
      data: {
        taskId,
        employeeId,
        hours: Number(hours),
        notes: notes ?? null,
        logDate: logDate ? new Date(logDate) : new Date(),
      },
    });

    // Update task actualHours
    const totalLogs = await db().timeLog.aggregate({
      where: { taskId },
      _sum: { hours: true },
    });
    await db().task.update({
      where: { id: taskId },
      data: { actualHours: totalLogs._sum.hours ?? 0 },
    });

    created(res, log);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Get time logs for an employee ─────────────────────────────
export async function getTimeLogs(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { employeeId, from, to } = req.query as Record<string, string>;

    const logs = await db().timeLog.findMany({
      where: {
        employee: { organizationId: orgId },
        ...(employeeId && { employeeId }),
        ...(from || to ? { logDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}),
      },
      include: {
        task: { select: { id: true, title: true, project: { select: { id: true, name: true } } } },
        employee: { select: { id: true, name: true, designation: true } },
      },
      orderBy: { logDate: "desc" },
      take: 100,
    });

    const totalHours = logs.reduce((s: number, l: any) => s + l.hours, 0);
    ok(res, { logs, totalHours });
  } catch (err) {
    serverError(res, err);
  }
}
