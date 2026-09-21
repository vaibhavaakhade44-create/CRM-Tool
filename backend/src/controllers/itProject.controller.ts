import { Response } from "express";
import { prisma } from "../lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";

const db = () => (prisma as any);

// ── List projects ─────────────────────────────────────────────
export async function listProjects(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { status, type, search } = req.query as Record<string, string>;

    const projects = await db().project.findMany({
      where: {
        organizationId: orgId,
        ...(status && status !== "ALL" && { status }),
        ...(type && type !== "ALL" && { projectType: type }),
        ...(search && { name: { contains: search, mode: "insensitive" } }),
      },
      include: {
        members: {
          include: { employee: { select: { id: true, name: true, designation: true } } },
        },
        milestones: { orderBy: { dueDate: "asc" } },
        sprints: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { tasks: true, members: true, sprints: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Augment with task completion stats
    const enriched = await Promise.all(projects.map(async (p: any) => {
      const taskStats = await db().task.groupBy({
        by: ["status"],
        where: { projectId: p.id },
        _count: { id: true },
      });
      const total = taskStats.reduce((s: number, t: any) => s + t._count.id, 0);
      const done = taskStats.find((t: any) => t.status === "DONE")?._count?.id ?? 0;
      return { ...p, taskStats: { total, done, pct: total ? Math.round((done / total) * 100) : 0 } };
    }));

    ok(res, enriched);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Get single project ────────────────────────────────────────
export async function getProject(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id;

    const project = await db().project.findFirst({
      where: { id, organizationId: orgId },
      include: {
        members: {
          include: { employee: { select: { id: true, name: true, designation: true, department: true, email: true } } },
          orderBy: { joinedAt: "asc" },
        },
        milestones: { orderBy: { dueDate: "asc" } },
        sprints: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { tasks: true } } },
        },
      },
    });

    if (!project) { notFound(res, "Project not found"); return; }

    // Task stats by status
    const taskStats = await db().task.groupBy({
      by: ["status"],
      where: { projectId: id },
      _count: { id: true },
    });

    ok(res, { ...project, taskStats });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Create project ────────────────────────────────────────────
export async function createProject(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const {
      name, description, projectType, priority, status,
      clientName, startDate, endDate, budget, totalEstHours,
      techStack, repoUrl, liveUrl, partyId, managerId,
    } = req.body;

    if (!name?.trim()) { badRequest(res, "Project name is required"); return; }

    const project = await db().project.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        description: description ?? null,
        projectType: projectType ?? "OTHER",
        priority: priority ?? "MEDIUM",
        status: status ?? "PLANNING",
        clientName: clientName ?? null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        budget: budget ? Number(budget) : null,
        totalEstHours: totalEstHours ? Number(totalEstHours) : null,
        techStack: Array.isArray(techStack) ? techStack : (techStack ? techStack.split(",").map((s: string) => s.trim()).filter(Boolean) : []),
        repoUrl: repoUrl ?? null,
        liveUrl: liveUrl ?? null,
        partyId: partyId ?? null,
        managerId: managerId ?? null,
      },
    });

    created(res, project);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Update project ────────────────────────────────────────────
export async function updateProject(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id;
    const existing = await db().project.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Project not found"); return; }

    const { techStack, ...rest } = req.body;
    const updated = await db().project.update({
      where: { id },
      data: {
        ...Object.fromEntries(
          Object.entries(rest)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => {
              if (["startDate", "endDate"].includes(k) && v) return [k, new Date(v as string)];
              if (["budget", "totalEstHours"].includes(k) && v) return [k, Number(v)];
              return [k, v];
            })
        ),
        ...(techStack !== undefined && {
          techStack: Array.isArray(techStack) ? techStack : techStack.split(",").map((s: string) => s.trim()).filter(Boolean),
        }),
      },
    });

    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Add project member ────────────────────────────────────────
export async function addMember(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const projectId = req.params.id;
    const { employeeId, role } = req.body;

    const project = await db().project.findFirst({ where: { id: projectId, organizationId: orgId } });
    if (!project) { notFound(res, "Project not found"); return; }

    const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: orgId } });
    if (!employee) { notFound(res, "Employee not found"); return; }

    const member = await db().projectMember.upsert({
      where: { projectId_employeeId: { projectId, employeeId } },
      create: { projectId, employeeId, role: role ?? "DEVELOPER" },
      update: { role: role ?? "DEVELOPER" },
      include: { employee: { select: { id: true, name: true, designation: true } } },
    });

    ok(res, member);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Remove project member ─────────────────────────────────────
export async function removeMember(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const projectId = req.params.id;
    const memberId = req.params.memberId;

    const project = await db().project.findFirst({ where: { id: projectId, organizationId: orgId } });
    if (!project) { notFound(res, "Project not found"); return; }

    await db().projectMember.deleteMany({ where: { id: memberId, projectId } });
    ok(res, { removed: true });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Milestones ────────────────────────────────────────────────
export async function addMilestone(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const projectId = req.params.id;
    const { title, description, dueDate } = req.body;

    const project = await db().project.findFirst({ where: { id: projectId, organizationId: orgId } });
    if (!project) { notFound(res, "Project not found"); return; }

    if (!title || !dueDate) { badRequest(res, "title and dueDate required"); return; }

    const ms = await db().projectMilestone.create({
      data: { projectId, title, description: description ?? null, dueDate: new Date(dueDate) },
    });
    created(res, ms);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateMilestone(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { id, msId } = req.params;
    const project = await db().project.findFirst({ where: { id, organizationId: orgId } });
    if (!project) { notFound(res, "Project not found"); return; }

    const { title, description, dueDate, completedAt } = req.body;
    const updated = await db().projectMilestone.update({
      where: { id: msId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
        ...(completedAt !== undefined && { completedAt: completedAt ? new Date(completedAt) : null }),
      },
    });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Team dashboard (HR view) ──────────────────────────────────
export async function getTeamDashboard(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;

    const [employees, projects] = await Promise.all([
      db().employee.findMany({
        where: { organizationId: orgId, status: "ACTIVE" },
        include: {
          projectMembers: {
            include: { project: { select: { id: true, name: true, status: true, projectType: true } } },
          },
        },
        orderBy: { name: "asc" },
      }),
      db().project.findMany({
        where: { organizationId: orgId },
        include: {
          members: { include: { employee: { select: { id: true, name: true } } } },
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    // Task counts per employee
    const taskCounts = await db().task.groupBy({
      by: ["assignedToId", "status"],
      where: { organizationId: orgId, assignedToId: { not: null } },
      _count: { id: true },
    });

    const taskMap: Record<string, { todo: number; inProgress: number; done: number; total: number }> = {};
    for (const t of taskCounts) {
      if (!t.assignedToId) continue;
      if (!taskMap[t.assignedToId]) taskMap[t.assignedToId] = { todo: 0, inProgress: 0, done: 0, total: 0 };
      taskMap[t.assignedToId].total += t._count.id;
      if (t.status === "TODO") taskMap[t.assignedToId].todo += t._count.id;
      if (t.status === "IN_PROGRESS") taskMap[t.assignedToId].inProgress += t._count.id;
      if (t.status === "DONE") taskMap[t.assignedToId].done += t._count.id;
    }

    // Today's attendance
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const attendance = await prisma.attendance.findMany({
      where: { organizationId: orgId, date: { gte: today } },
      select: { employeeId: true, status: true },
    });
    const attMap: Record<string, string> = {};
    for (const a of attendance) attMap[a.employeeId] = a.status;

    const enrichedEmployees = employees.map((e: any) => ({
      ...e,
      tasks: taskMap[e.id] ?? { todo: 0, inProgress: 0, done: 0, total: 0 },
      todayAttendance: attMap[e.id] ?? "ABSENT",
    }));

    ok(res, { employees: enrichedEmployees, projects });
  } catch (err) {
    serverError(res, err);
  }
}

// ── My work: tasks assigned to a given employeeId ─────────────
export async function getMyWork(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { employeeId } = req.query as Record<string, string>;

    const tasks = await db().task.findMany({
      where: { organizationId: orgId, assignedToId: employeeId },
      include: { project: { select: { id: true, name: true, projectType: true } } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    });

    // Group by status
    const board = {
      TODO: tasks.filter((t: any) => t.status === "TODO"),
      IN_PROGRESS: tasks.filter((t: any) => t.status === "IN_PROGRESS"),
      IN_REVIEW: tasks.filter((t: any) => t.status === "IN_REVIEW"),
      DONE: tasks.filter((t: any) => t.status === "DONE"),
    };

    // Recent time logs
    const timeLogs = await db().timeLog.findMany({
      where: { employeeId },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { logDate: "desc" },
      take: 10,
    });

    ok(res, { board, tasks, timeLogs });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Generate public share link ────────────────────────────────
export async function generateShareLink(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { id } = req.params;

    const project = await db().project.findFirst({ where: { id, organizationId: orgId } });
    if (!project) { notFound(res, "Project not found"); return; }

    // Reuse existing token or mint a new one
    const token: string = project.publicToken ?? uuidv4();
    await db().project.update({
      where: { id },
      data: { publicToken: token, publicSharedAt: new Date() },
    });

    ok(res, { token, url: `/public/project/${token}` });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Revoke public share link ──────────────────────────────────
export async function revokeShareLink(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { id } = req.params;

    const project = await db().project.findFirst({ where: { id, organizationId: orgId } });
    if (!project) { notFound(res, "Project not found"); return; }

    await db().project.update({
      where: { id },
      data: { publicToken: null, publicSharedAt: null },
    });

    ok(res, { revoked: true });
  } catch (err) {
    serverError(res, err);
  }
}
