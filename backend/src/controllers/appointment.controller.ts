import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const db = () => (prisma as any);

const appointmentSchema = z.object({
  leadId: z.string().optional(),
  partyId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  scheduledAt: z.string(),
  duration: z.number().int().positive().default(30),
  location: z.string().optional(),
  meetingLink: z.string().optional(),
  assignedToId: z.string().optional(),
  remindAt: z.string().optional(),
});

// ── List appointments ─────────────────────────────────────────
export async function listAppointments(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { from, to, status, assignedToId, leadId } = req.query as Record<string, string>;
    const where: any = { organizationId: req.organizationId! };
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (leadId) where.leadId = leadId;
    if (from || to) {
      where.scheduledAt = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      };
    }

    const appointments = await db().appointment.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      take: 200,
    });
    ok(res, appointments);
  } catch (e) { serverError(res, e); }
}

// ── Create appointment ────────────────────────────────────────
export async function createAppointment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = appointmentSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const { scheduledAt, remindAt, ...rest } = data.data;

    const appt = await db().appointment.create({
      data: {
        id: require("crypto").randomUUID().replace(/-/g, "").substring(0, 25),
        organizationId: req.organizationId!,
        ...rest,
        scheduledAt: new Date(scheduledAt),
        remindAt: remindAt ? new Date(remindAt) : new Date(new Date(scheduledAt).getTime() - 30 * 60000),
        createdById: req.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    created(res, appt);
  } catch (e) { serverError(res, e); }
}

// ── Update appointment ────────────────────────────────────────
export async function updateAppointment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = appointmentSchema.partial().extend({ status: z.string().optional(), outcome: z.string().optional() }).safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const existing = await db().appointment.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Appointment not found"); return; }

    const { scheduledAt, remindAt, ...rest } = data.data;
    const appt = await db().appointment.update({
      where: { id: req.params.id as string },
      data: {
        ...rest,
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(remindAt && { remindAt: new Date(remindAt) }),
        updatedAt: new Date(),
      },
    });
    ok(res, appt);
  } catch (e) { serverError(res, e); }
}

// ── Delete appointment ────────────────────────────────────────
export async function deleteAppointment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().appointment.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Appointment not found"); return; }
    await db().appointment.delete({ where: { id: req.params.id as string } });
    ok(res, { deleted: true });
  } catch (e) { serverError(res, e); }
}

// ── Today's appointments ──────────────────────────────────────
export async function getTodayAppointments(req: OrgRequest, res: Response): Promise<void> {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    const appointments = await db().appointment.findMany({
      where: {
        organizationId: req.organizationId!,
        scheduledAt: { gte: startOfDay, lt: endOfDay },
        status: { not: "CANCELLED" },
      },
      orderBy: { scheduledAt: "asc" },
    });
    ok(res, appointments);
  } catch (e) { serverError(res, e); }
}
