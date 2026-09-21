import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const ticketSchema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  partyId: z.string().optional(),
  slaHours: z.number().optional(),
});

const replySchema = z.object({
  message: z.string().min(1),
  isInternal: z.boolean().default(false),
});

async function generateTicketNumber(orgId: string): Promise<string> {
  const count = await prisma.supportTicket.count({ where: { organizationId: orgId } });
  return `TKT-${String(count + 1).padStart(5, "0")}`;
}

export async function listTickets(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status, priority, search, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
        { party: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where, skip, take: parseInt(limit),
        include: {
          party: { select: { id: true, name: true } },
          _count: { select: { replies: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.supportTicket.count({ where }),
    ]);
    ok(res, { tickets, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { serverError(res, e); }
}

export async function getTicket(req: OrgRequest, res: Response): Promise<void> {
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
      include: { party: true, replies: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket) { notFound(res, "Ticket not found"); return; }
    ok(res, ticket);
  } catch (e) { serverError(res, e); }
}

export async function createTicket(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = ticketSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const ticketNumber = await generateTicketNumber(req.organizationId!);
    const slaDeadline = data.data.slaHours
      ? new Date(Date.now() + data.data.slaHours * 3600000)
      : undefined;

    const ticket = await prisma.supportTicket.create({
      data: {
        organizationId: req.organizationId!,
        ticketNumber,
        subject: data.data.subject,
        description: data.data.description,
        priority: data.data.priority,
        partyId: data.data.partyId,
        slaDeadline,
      },
    });
    created(res, ticket);
  } catch (e) { serverError(res, e); }
}

export async function updateTicketStatus(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status, assignedToId } = req.body;
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
    });
    if (!ticket) { notFound(res, "Ticket not found"); return; }
    const updated = await prisma.supportTicket.update({
      where: { id: (req.params.id as string) },
      data: {
        ...(status && { status }),
        ...(assignedToId && { assignedToId }),
        ...(status === "RESOLVED" && { resolvedAt: new Date() }),
      },
    });
    ok(res, updated);
  } catch (e) { serverError(res, e); }
}

export async function addReply(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = replySchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
    });
    if (!ticket) { notFound(res, "Ticket not found"); return; }
    const reply = await prisma.ticketReply.create({
      data: { ticketId: (req.params.id as string), message: data.data.message, isInternal: data.data.isInternal, authorId: req.userId },
    });
    if (ticket.status === "WAITING") {
      await prisma.supportTicket.update({ where: { id: (req.params.id as string) }, data: { status: "IN_PROGRESS" } });
    }
    created(res, reply);
  } catch (e) { serverError(res, e); }
}

export async function getSupportStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const [open, inProgress, resolved, urgent] = await Promise.all([
      prisma.supportTicket.count({ where: { organizationId: req.organizationId!, status: "OPEN" } }),
      prisma.supportTicket.count({ where: { organizationId: req.organizationId!, status: "IN_PROGRESS" } }),
      prisma.supportTicket.count({ where: { organizationId: req.organizationId!, status: "RESOLVED" } }),
      prisma.supportTicket.count({ where: { organizationId: req.organizationId!, priority: "URGENT", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    ]);
    ok(res, { open, inProgress, resolved, urgent });
  } catch (e) { serverError(res, e); }
}

