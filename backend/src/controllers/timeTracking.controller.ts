import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";

const db = () => (prisma as any);

// ── List time entries ─────────────────────────────────────────
export async function listTimeEntries(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { projectId, userId, from, to, billable } = req.query as Record<string, string>;

    const entries = await db().projectTimeEntry.findMany({
      where: {
        organizationId: orgId,
        ...(projectId && { projectId }),
        ...(userId && { userId }),
        ...(billable !== undefined && { billable: billable === "true" }),
        ...(from || to ? {
          date: {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(to) }),
          },
        } : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    const totalHours = entries.reduce((s: number, e: any) => s + e.hours, 0);
    ok(res, { entries, totalHours });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Create time entry ─────────────────────────────────────────
export async function createTimeEntry(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { projectId, taskId, userId, description, hours, date, billable } = req.body;

    if (!projectId) { badRequest(res, "projectId is required"); return; }
    if (!hours || isNaN(Number(hours)) || Number(hours) <= 0) { badRequest(res, "Valid hours required"); return; }

    const project = await db().project.findFirst({ where: { id: projectId, organizationId: orgId } });
    if (!project) { notFound(res, "Project not found"); return; }

    const entry = await db().projectTimeEntry.create({
      data: {
        organizationId: orgId,
        projectId,
        taskId: taskId ?? null,
        userId: userId ?? req.userId ?? "",
        description: description ?? null,
        hours: Number(hours),
        date: date ? new Date(date) : new Date(),
        billable: billable !== false,
      },
    });

    created(res, entry);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Update time entry ─────────────────────────────────────────
export async function updateTimeEntry(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;

    const existing = await db().projectTimeEntry.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Time entry not found"); return; }

    const { description, hours, date, billable, approved, approvedById } = req.body;
    const updated = await db().projectTimeEntry.update({
      where: { id },
      data: {
        ...(description !== undefined && { description }),
        ...(hours !== undefined && { hours: Number(hours) }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(billable !== undefined && { billable }),
        ...(approved !== undefined && { approved, approvedById: approvedById ?? null, approvedAt: approved ? new Date() : null }),
      },
    });

    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Delete time entry ─────────────────────────────────────────
export async function deleteTimeEntry(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().projectTimeEntry.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Time entry not found"); return; }
    await db().projectTimeEntry.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Project time summary ──────────────────────────────────────
export async function getTimeSummary(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { projectId, from, to } = req.query as Record<string, string>;

    const where: any = { organizationId: orgId };
    if (projectId) where.projectId = projectId;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const entries = await db().projectTimeEntry.findMany({ where });
    const byProject: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    for (const e of entries) {
      byProject[e.projectId] = (byProject[e.projectId] ?? 0) + e.hours;
      byUser[e.userId] = (byUser[e.userId] ?? 0) + e.hours;
    }

    const totalHours = entries.reduce((s: number, e: any) => s + e.hours, 0);
    const billableHours = entries.filter((e: any) => e.billable).reduce((s: number, e: any) => s + e.hours, 0);

    ok(res, { totalHours, billableHours, byProject, byUser });
  } catch (err) {
    serverError(res, err);
  }
}

// ── SLA Policies ──────────────────────────────────────────────
export async function listSLAPolicies(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const policies = await db().sLAPolicy.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { tickets: true } } },
      orderBy: { name: "asc" },
    });
    ok(res, policies);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createSLAPolicy(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { name, description, firstResponseHours, resolutionHours, escalationHours, appliesTo } = req.body;

    if (!name?.trim()) { badRequest(res, "Policy name is required"); return; }

    const policy = await db().sLAPolicy.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        description: description ?? null,
        firstResponseHours: Number(firstResponseHours ?? 4),
        resolutionHours: Number(resolutionHours ?? 24),
        escalationHours: escalationHours ? Number(escalationHours) : null,
        appliesTo: appliesTo ?? "SUPPORT",
      },
    });

    created(res, policy);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateSLAPolicy(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().sLAPolicy.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Policy not found"); return; }

    const { name, description, firstResponseHours, resolutionHours, escalationHours, appliesTo, isActive } = req.body;
    const updated = await db().sLAPolicy.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(firstResponseHours !== undefined && { firstResponseHours: Number(firstResponseHours) }),
        ...(resolutionHours !== undefined && { resolutionHours: Number(resolutionHours) }),
        ...(escalationHours !== undefined && { escalationHours: escalationHours ? Number(escalationHours) : null }),
        ...(appliesTo !== undefined && { appliesTo }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

export async function deleteSLAPolicy(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().sLAPolicy.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Policy not found"); return; }
    await db().sLAPolicy.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Resource Allocation ───────────────────────────────────────
export async function listAllocations(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { projectId, userId } = req.query as Record<string, string>;

    const allocs = await db().resourceAllocation.findMany({
      where: {
        organizationId: orgId,
        ...(projectId && { projectId }),
        ...(userId && { userId }),
      },
      include: { project: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });

    ok(res, allocs);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createAllocation(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { projectId, userId, role, allocationPct, startDate, endDate, notes } = req.body;

    if (!projectId || !userId) { badRequest(res, "projectId and userId are required"); return; }

    const project = await db().project.findFirst({ where: { id: projectId, organizationId: orgId } });
    if (!project) { notFound(res, "Project not found"); return; }

    const alloc = await db().resourceAllocation.create({
      data: {
        organizationId: orgId,
        projectId,
        userId,
        role: role ?? null,
        allocationPct: Number(allocationPct ?? 100),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        notes: notes ?? null,
      },
    });

    created(res, alloc);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateAllocation(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().resourceAllocation.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Allocation not found"); return; }

    const { role, allocationPct, startDate, endDate, notes } = req.body;
    const updated = await db().resourceAllocation.update({
      where: { id },
      data: {
        ...(role !== undefined && { role }),
        ...(allocationPct !== undefined && { allocationPct: Number(allocationPct) }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(notes !== undefined && { notes }),
      },
    });

    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

export async function deleteAllocation(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().resourceAllocation.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Allocation not found"); return; }
    await db().resourceAllocation.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (err) {
    serverError(res, err);
  }
}
