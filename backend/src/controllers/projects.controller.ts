import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("PLANNING"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
  partyId: z.string().optional(),
});

const taskSchema = z.object({
  projectId: z.string().optional(),
  sprintId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assignedToId: z.string().optional(),
  dueDate: z.string().optional(),
  storyPoints: z.number().int().positive().optional(),
  estimatedHours: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
});

export async function listProjects(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status, search, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (status) where.status = status;
    if (search) where.OR = [{ name: { contains: search, mode: "insensitive" } }];
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where, skip, take: parseInt(limit),
        include: {
          _count: { select: { tasks: true } },
          party: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.project.count({ where }),
    ]);
    ok(res, { projects, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { serverError(res, e); }
}

export async function getProject(req: OrgRequest, res: Response): Promise<void> {
  try {
    const project = await prisma.project.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
      include: {
        tasks: { orderBy: { createdAt: "desc" } },
        party: true,
      },
    });
    if (!project) { notFound(res, "Project not found"); return; }
    ok(res, project);
  } catch (e) { serverError(res, e); }
}

export async function createProject(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = projectSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const project = await prisma.project.create({
      data: {
        ...data.data,
        organizationId: req.organizationId!,
        startDate: data.data.startDate ? new Date(data.data.startDate) : undefined,
        endDate: data.data.endDate ? new Date(data.data.endDate) : undefined,
      },
    });
    created(res, project);
  } catch (e) { serverError(res, e); }
}

export async function updateProject(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = projectSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const existing = await prisma.project.findFirst({ where: { id: (req.params.id as string), organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Project not found"); return; }
    const project = await prisma.project.update({
      where: { id: (req.params.id as string) },
      data: {
        ...data.data,
        ...(data.data.startDate && { startDate: new Date(data.data.startDate) }),
        ...(data.data.endDate && { endDate: new Date(data.data.endDate) }),
      },
    });
    ok(res, project);
  } catch (e) { serverError(res, e); }
}

export async function listTasks(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { projectId, status, priority, page = "1", limit = "100" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where, skip, take: parseInt(limit),
        include: { project: { select: { id: true, name: true } }, _count: { select: { comments: true } } },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      }),
      prisma.task.count({ where }),
    ]);
    ok(res, { tasks, total });
  } catch (e) { serverError(res, e); }
}

export async function createTask(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = taskSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const task = await prisma.task.create({
      data: {
        ...data.data,
        organizationId: req.organizationId!,
        dueDate: data.data.dueDate ? new Date(data.data.dueDate) : undefined,
      },
    });
    created(res, task);
  } catch (e) { serverError(res, e); }
}

export async function updateTask(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = taskSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const existing = await prisma.task.findFirst({ where: { id: (req.params.id as string), organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Task not found"); return; }
    const task = await prisma.task.update({
      where: { id: (req.params.id as string) },
      data: {
        ...data.data,
        ...(data.data.dueDate && { dueDate: new Date(data.data.dueDate) }),
        ...(data.data.status === "DONE" && { completedAt: new Date() }),
      },
    });
    ok(res, task);
  } catch (e) { serverError(res, e); }
}

export async function addTaskComment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { comment } = req.body;
    if (!comment) { badRequest(res, "Comment required"); return; }
    const task = await prisma.task.findFirst({ where: { id: (req.params.id as string), organizationId: req.organizationId! } });
    if (!task) { notFound(res, "Task not found"); return; }
    const c = await prisma.taskComment.create({ data: { taskId: (req.params.id as string), comment, authorId: req.userId } });
    created(res, c);
  } catch (e) { serverError(res, e); }
}

// ── PM: projects where current user (by email) is PROJECT_MANAGER ──
export async function getMyProjects(req: OrgRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } });
    if (!user) { notFound(res, "User not found"); return; }

    // Find employee linked to this user
    const emp = await prisma.employee.findFirst({
      where: {
        organizationId: req.organizationId!,
        OR: [{ email: user.email }, { userId: req.userId! }],
      },
    });

    // Admins/owners see all org projects; PM sees only their assigned projects
    const orgMembership = await prisma.organizationMember.findFirst({
      where: { userId: req.userId!, organizationId: req.organizationId! },
      select: { role: true },
    });
    const isAdmin = orgMembership?.role === "OWNER" || orgMembership?.role === "ADMIN";

    const projects = await prisma.project.findMany({
      where: {
        organizationId: req.organizationId!,
        ...(!isAdmin && emp ? {
          members: { some: { employeeId: emp.id, role: "PROJECT_MANAGER" } },
        } : {}),
      },
      include: {
        _count: { select: { tasks: true } },
        members: {
          include: {
            employee: { select: { id: true, name: true, designation: true, orgRole: true, department: true } },
          },
        },
        tasks: { select: { id: true, status: true, dueDate: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate progress for each project
    const result = projects.map((p) => {
      const total = p.tasks.length;
      const done  = p.tasks.filter((t) => t.status === "DONE").length;
      return { ...p, progress: total > 0 ? Math.round((done / total) * 100) : 0 };
    });

    ok(res, result);
  } catch (e) { serverError(res, e); }
}

// ── PM: get full team hierarchy for a project ──────────────
export async function getProjectTeam(req: OrgRequest, res: Response): Promise<void> {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id as string, organizationId: req.organizationId! },
      include: {
        members: {
          include: {
            employee: {
              select: {
                id: true, name: true, designation: true, orgRole: true,
                department: true, email: true, employeeCode: true,
                projectMembers: {
                  where: { projectId: req.params.id as string },
                  select: { role: true },
                },
              },
            },
          },
        },
        tasks: { select: { id: true, status: true, assignedToId: true, title: true, priority: true, dueDate: true } },
      },
    });
    if (!project) { notFound(res, "Project not found"); return; }

    // Group into PM / TLs / Employees
    const pm  = project.members.filter((m) => m.role === "PROJECT_MANAGER");
    const tls = project.members.filter((m) => m.role === "TECH_LEAD");
    const devs = project.members.filter((m) => !["PROJECT_MANAGER","TECH_LEAD"].includes(m.role));

    // Attach tasks count per member
    const withTasks = (members: typeof devs) => members.map((m) => ({
      ...m,
      taskCount: project.tasks.filter((t) => t.assignedToId === m.employeeId).length,
      doneTasks: project.tasks.filter((t) => t.assignedToId === m.employeeId && t.status === "DONE").length,
    }));

    ok(res, {
      project: { id: project.id, name: project.name, status: project.status, endDate: project.endDate },
      pm:       withTasks(pm),
      teamLeads: withTasks(tls),
      employees: withTasks(devs),
      tasks: project.tasks,
    });
  } catch (e) { serverError(res, e); }
}

// ── Add / update project member ─────────────────────────────
export async function upsertProjectMember(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { employeeId, role } = req.body as { employeeId: string; role: string };
    if (!employeeId || !role) { badRequest(res, "employeeId and role required"); return; }

    const project = await prisma.project.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!project) { notFound(res, "Project not found"); return; }

    const emp = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: req.organizationId! } });
    if (!emp) { notFound(res, "Employee not found"); return; }

    const member = await prisma.projectMember.upsert({
      where: { projectId_employeeId: { projectId: req.params.id as string, employeeId } },
      create: { projectId: req.params.id as string, employeeId, role: role as any },
      update: { role: role as any },
    });
    ok(res, member);
  } catch (e) { serverError(res, e); }
}

// ── Remove project member ───────────────────────────────────
export async function removeProjectMember(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { projectId, employeeId } = req.params as { projectId: string; employeeId: string };
    await prisma.projectMember.deleteMany({ where: { projectId, employeeId } });
    ok(res, null, "Member removed");
  } catch (e) { serverError(res, e); }
}

// ── Employee: get my assigned tasks + project context ──────
export async function getMyTasks(req: OrgRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } });
    if (!user) { ok(res, { tasks: [], employee: null, teamLeads: [], projectManagers: [] }); return; }

    const emp = await prisma.employee.findFirst({
      where: { organizationId: req.organizationId!, OR: [{ email: user.email }, { userId: req.userId! }] },
      select: { id: true, name: true, designation: true, orgRole: true, department: true, employeeCode: true },
    });
    if (!emp) { ok(res, { tasks: [], employee: null, teamLeads: [], projectManagers: [] }); return; }

    // Tasks assigned to this employee
    const tasks = await prisma.task.findMany({
      where: { organizationId: req.organizationId!, assignedToId: emp.id },
      include: { project: { select: { id: true, name: true, status: true } } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    });

    // Projects this employee is a member of → find TLs and PMs
    const memberships = await prisma.projectMember.findMany({
      where: { employeeId: emp.id },
      include: {
        project: {
          select: {
            id: true, name: true, status: true, endDate: true,
            members: {
              where: { role: { in: ["PROJECT_MANAGER", "TECH_LEAD"] } },
              include: { employee: { select: { id: true, name: true, designation: true, department: true } } },
            },
          },
        },
      },
    });

    const tlMap = new Map<string, { id: string; name: string; designation?: string; department?: string }>();
    const pmMap = new Map<string, { id: string; name: string; designation?: string; department?: string }>();
    for (const m of memberships) {
      for (const mem of m.project.members) {
        const e = { id: mem.employee.id, name: mem.employee.name, designation: mem.employee.designation ?? undefined, department: mem.employee.department ?? undefined };
        if (mem.role === "TECH_LEAD") tlMap.set(e.id, e);
        if (mem.role === "PROJECT_MANAGER") pmMap.set(e.id, e);
      }
    }

    ok(res, {
      employee: emp,
      tasks,
      teamLeads: Array.from(tlMap.values()),
      projectManagers: Array.from(pmMap.values()),
      projects: memberships.map(m => ({ id: m.project.id, name: m.project.name, status: m.project.status, endDate: m.project.endDate })),
    });
  } catch (e) { serverError(res, e); }
}

// ── TL: get team members reporting to current user ─────────
export async function getMyTeam(req: OrgRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } });
    if (!user) { notFound(res, "User not found"); return; }

    const tlEmp = await prisma.employee.findFirst({
      where: { organizationId: req.organizationId!, OR: [{ email: user.email }, { userId: req.userId! }] },
    });
    if (!tlEmp) { ok(res, { projects: [], members: [] }); return; }

    // Find all projects this user is TECH_LEAD in
    const tlMemberships = await prisma.projectMember.findMany({
      where: { employeeId: tlEmp.id, role: "TECH_LEAD" },
      include: {
        project: {
          include: {
            members: {
              where: { role: { notIn: ["PROJECT_MANAGER", "TECH_LEAD"] } },
              include: {
                employee: {
                  select: { id: true, name: true, designation: true, department: true, employeeCode: true },
                },
              },
            },
            tasks: { select: { id: true, status: true, assignedToId: true, title: true, priority: true, dueDate: true } },
            _count: { select: { tasks: true } },
          },
        },
      },
    });

    ok(res, {
      tlEmployee: { id: tlEmp.id, name: tlEmp.name, designation: tlEmp.designation, department: tlEmp.department },
      projects: tlMemberships.map((m) => ({
        ...m.project,
        progress: (() => {
          const t = m.project.tasks.length;
          const d = m.project.tasks.filter((t) => t.status === "DONE").length;
          return t > 0 ? Math.round((d / t) * 100) : 0;
        })(),
      })),
    });
  } catch (e) { serverError(res, e); }
}

