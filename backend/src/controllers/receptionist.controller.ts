import { Response } from "express";
import { prisma } from "../lib/prisma";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";
import { AuthRequest } from "../middleware/auth";

const db = prisma as any;

function orgId(req: AuthRequest) {
  return (req as any).organizationId as string;
}

// ═══════════════════════════════════════════════════════════════
//  VISITORS
// ═══════════════════════════════════════════════════════════════

export async function listVisitors(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { search, status, date } = req.query as Record<string, string>;

    const where: any = { organizationId: org };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { company: { contains: search, mode: "insensitive" } },
        { whomToMeet: { contains: search, mode: "insensitive" } },
      ];
    }
    if (date) {
      const d = new Date(date); const next = new Date(d); next.setDate(next.getDate() + 1);
      where.checkInTime = { gte: d, lt: next };
    }

    const visitors = await db.visitor.findMany({ where, orderBy: { checkInTime: "desc" }, take: 100 });
    ok(res, visitors);
  } catch (e) { serverError(res, e); }
}

export async function getVisitor(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { id } = req.params;
    const visitor = await db.visitor.findFirst({ where: { id, organizationId: org } });
    if (!visitor) return notFound(res, "Visitor not found");
    ok(res, visitor);
  } catch (e) { serverError(res, e); }
}

export async function createVisitor(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { name, phone, email, company, purpose, whomToMeet, department, idType, idNumber, vehicleNumber, notes } = req.body;
    if (!name?.trim()) return badRequest(res, "Visitor name is required");

    const count = await db.visitor.count({ where: { organizationId: org } });
    const badgeNumber = `VIS-${String(count + 1).padStart(5, "0")}`;

    const visitor = await db.visitor.create({
      data: {
        organizationId: org,
        name: name.trim(),
        phone: phone || null,
        email: email || null,
        company: company || null,
        purpose: purpose || null,
        whomToMeet: whomToMeet || null,
        department: department || null,
        idType: idType || null,
        idNumber: idNumber || null,
        vehicleNumber: vehicleNumber || null,
        notes: notes || null,
        badgeNumber,
        status: "CHECKED_IN",
        checkInTime: new Date(),
      },
    });
    created(res, visitor, "Visitor checked in");
  } catch (e) { serverError(res, e); }
}

export async function updateVisitor(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { id } = req.params;
    const existing = await db.visitor.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Visitor not found");

    const allowed = ["name", "phone", "email", "company", "purpose", "whomToMeet", "department", "idType", "idNumber", "vehicleNumber", "notes", "status"];
    const data: Record<string, any> = {};
    for (const f of allowed) if (req.body[f] !== undefined) data[f] = req.body[f];

    const updated = await db.visitor.update({ where: { id }, data });
    ok(res, updated, "Visitor updated");
  } catch (e) { serverError(res, e); }
}

export async function checkOutVisitor(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { id } = req.params;
    const existing = await db.visitor.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Visitor not found");
    if (existing.status === "CHECKED_OUT") return badRequest(res, "Visitor is already checked out");

    const updated = await db.visitor.update({
      where: { id }, data: { status: "CHECKED_OUT", checkOutTime: new Date() },
    });
    ok(res, updated, "Visitor checked out");
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
//  COURIER / PACKAGE LOG
// ═══════════════════════════════════════════════════════════════

export async function listCouriers(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { type, status } = req.query as Record<string, string>;

    const where: any = { organizationId: org };
    if (type) where.type = type;
    if (status) where.status = status;

    const couriers = await db.courierLog.findMany({ where, orderBy: { loggedAt: "desc" }, take: 100 });
    ok(res, couriers);
  } catch (e) { serverError(res, e); }
}

export async function createCourier(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { type, courierCompany, trackingNumber, senderName, senderCompany, recipientName, recipientDept, description, handledBy, notes } = req.body;
    if (!type || !["INCOMING", "OUTGOING"].includes(type)) return badRequest(res, "type must be INCOMING or OUTGOING");

    const courier = await db.courierLog.create({
      data: {
        organizationId: org, type,
        courierCompany: courierCompany || null,
        trackingNumber: trackingNumber || null,
        senderName: senderName || null,
        senderCompany: senderCompany || null,
        recipientName: recipientName || null,
        recipientDept: recipientDept || null,
        description: description || null,
        handledBy: handledBy || null,
        notes: notes || null,
        status: type === "OUTGOING" ? "DELIVERED" : "PENDING",
        resolvedAt: type === "OUTGOING" ? new Date() : null,
      },
    });
    created(res, courier, "Courier logged");
  } catch (e) { serverError(res, e); }
}

export async function updateCourierStatus(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const { id } = req.params;
    const { status } = req.body;
    if (!["PENDING", "DELIVERED", "RETURNED"].includes(status)) return badRequest(res, "Invalid status");

    const existing = await db.courierLog.findFirst({ where: { id, organizationId: org } });
    if (!existing) return notFound(res, "Courier log not found");

    const updated = await db.courierLog.update({
      where: { id }, data: { status, resolvedAt: status !== "PENDING" ? new Date() : null },
    });
    ok(res, updated, "Courier status updated");
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════

export async function getReceptionistStats(req: AuthRequest, res: Response) {
  try {
    const org = orgId(req);
    if (!org) return badRequest(res, "Organization required");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [visitorsToday, currentlyIn, couriersToday, couriersPending] = await Promise.all([
      db.visitor.count({ where: { organizationId: org, checkInTime: { gte: today, lt: tomorrow } } }),
      db.visitor.count({ where: { organizationId: org, status: "CHECKED_IN" } }),
      db.courierLog.count({ where: { organizationId: org, loggedAt: { gte: today, lt: tomorrow } } }),
      db.courierLog.count({ where: { organizationId: org, status: "PENDING" } }),
    ]);

    ok(res, { visitorsToday, currentlyIn, couriersToday, couriersPending });
  } catch (e) { serverError(res, e); }
}
