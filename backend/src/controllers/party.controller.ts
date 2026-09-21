import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import {
  createPartySchema,
  updatePartySchema,
  createContactSchema,
  updateContactSchema,
  createCommunicationSchema,
  partyQuerySchema,
} from "../validators/party.validator";
import { ok, created, badRequest, notFound, serverError, forbidden } from "../utils/response";
import { MemberRole } from "@prisma/client";

// ── Helpers ──────────────────────────────────────────────────

async function findParty(id: string, orgId: string) {
  return prisma.party.findFirst({ where: { id, organizationId: orgId, isActive: true } });
}

// ── Party CRUD ───────────────────────────────────────────────

export async function listParties(req: OrgRequest, res: Response): Promise<void> {
  try {
    const query = partyQuerySchema.safeParse(req.query);
    if (!query.success) { badRequest(res, "Invalid query params"); return; }

    const { type, search, page, limit } = query.data;
    const skip = (page - 1) * limit;

    const where = {
      organizationId: req.organizationId!,
      isActive: true,
      ...(type && { type }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { displayName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
          { mobile: { contains: search } },
          { gstin: { contains: search, mode: "insensitive" as const } },
          { city: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [parties, total] = await Promise.all([
      prisma.party.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        include: {
          contacts: { where: { isPrimary: true }, take: 1, select: { name: true, phone: true, mobile: true } },
          _count: { select: { communications: true } },
        },
      }),
      prisma.party.count({ where }),
    ]);

    ok(res, { parties, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) { serverError(res, err); }
}

export async function getParty(req: OrgRequest, res: Response): Promise<void> {
  try {
    const party = await prisma.party.findFirst({
      where: { id: req.params.id as string, organizationId: req.organizationId!, isActive: true },
      include: {
        contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
        communications: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { createdBy: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });
    if (!party) { notFound(res, "Party not found"); return; }
    ok(res, party);
  } catch (err) { serverError(res, err); }
}

export async function createParty(req: OrgRequest, res: Response): Promise<void> {
  try {
    const parsed = createPartySchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }

    const party = await prisma.party.create({
      data: { ...parsed.data, assignedToId: parsed.data.assignedToId || null, organizationId: req.organizationId! },
    });
    created(res, party, "Party created successfully");
  } catch (err) { serverError(res, err); }
}

export async function updateParty(req: OrgRequest, res: Response): Promise<void> {
  try {
    const party = await findParty(req.params.id as string, req.organizationId!);
    if (!party) { notFound(res, "Party not found"); return; }

    const parsed = updatePartySchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if ("assignedToId" in updateData) updateData.assignedToId = (updateData.assignedToId as string) || null;
    const updated = await prisma.party.update({ where: { id: party.id }, data: updateData });
    ok(res, updated, "Party updated");
  } catch (err) { serverError(res, err); }
}

export async function deleteParty(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (req.memberRole === MemberRole.VIEWER || req.memberRole === MemberRole.STAFF) {
      forbidden(res, "Insufficient permissions to delete"); return;
    }
    const party = await findParty(req.params.id as string, req.organizationId!);
    if (!party) { notFound(res, "Party not found"); return; }

    await prisma.party.update({ where: { id: party.id }, data: { isActive: false } });
    ok(res, null, "Party deleted");
  } catch (err) { serverError(res, err); }
}

// ── Contacts ─────────────────────────────────────────────────

export async function listContacts(req: OrgRequest, res: Response): Promise<void> {
  try {
    const partyId = req.params.id as string;
    const party = await findParty(partyId, req.organizationId!);
    if (!party) { notFound(res, "Party not found"); return; }

    const contacts = await prisma.contact.findMany({
      where: { partyId, organizationId: req.organizationId! },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    });
    ok(res, contacts);
  } catch (err) { serverError(res, err); }
}

export async function createContact(req: OrgRequest, res: Response): Promise<void> {
  try {
    const partyId = req.params.id as string;
    const party = await findParty(partyId, req.organizationId!);
    if (!party) { notFound(res, "Party not found"); return; }

    const parsed = createContactSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }

    // If this contact is primary, clear existing primary
    if (parsed.data.isPrimary) {
      await prisma.contact.updateMany({ where: { partyId, organizationId: req.organizationId! }, data: { isPrimary: false } });
    }

    const contact = await prisma.contact.create({
      data: { ...parsed.data, partyId, organizationId: req.organizationId! },
    });
    created(res, contact, "Contact added");
  } catch (err) { serverError(res, err); }
}

export async function updateContact(req: OrgRequest, res: Response): Promise<void> {
  try {
    const partyId   = req.params.id as string;
    const contactId = req.params.contactId as string;

    const contact = await prisma.contact.findFirst({ where: { id: contactId, partyId, organizationId: req.organizationId! } });
    if (!contact) { notFound(res, "Contact not found"); return; }

    const parsed = updateContactSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }

    if (parsed.data.isPrimary) {
      await prisma.contact.updateMany({ where: { partyId, organizationId: req.organizationId! }, data: { isPrimary: false } });
    }

    const updated = await prisma.contact.update({ where: { id: contactId }, data: parsed.data });
    ok(res, updated, "Contact updated");
  } catch (err) { serverError(res, err); }
}

export async function deleteContact(req: OrgRequest, res: Response): Promise<void> {
  try {
    const contactId = req.params.contactId as string;
    const contact = await prisma.contact.findFirst({ where: { id: contactId, organizationId: req.organizationId! } });
    if (!contact) { notFound(res, "Contact not found"); return; }

    await prisma.contact.delete({ where: { id: contactId } });
    ok(res, null, "Contact deleted");
  } catch (err) { serverError(res, err); }
}

// ── Communication Log ────────────────────────────────────────

export async function listCommunications(req: OrgRequest, res: Response): Promise<void> {
  try {
    const partyId = req.params.id as string;
    const party = await findParty(partyId, req.organizationId!);
    if (!party) { notFound(res, "Party not found"); return; }

    const comms = await prisma.communication.findMany({
      where: { partyId, organizationId: req.organizationId! },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true, avatar: true } } },
    });
    ok(res, comms);
  } catch (err) { serverError(res, err); }
}

export async function createCommunication(req: OrgRequest, res: Response): Promise<void> {
  try {
    const partyId = req.params.id as string;
    const party = await findParty(partyId, req.organizationId!);
    if (!party) { notFound(res, "Party not found"); return; }

    const parsed = createCommunicationSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }

    const comm = await prisma.communication.create({
      data: {
        ...parsed.data,
        followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null,
        partyId,
        organizationId: req.organizationId!,
        createdById: req.userId!,
      },
      include: { createdBy: { select: { id: true, name: true, avatar: true } } },
    });
    created(res, comm, "Log entry added");
  } catch (err) { serverError(res, err); }
}

export async function deleteCommunication(req: OrgRequest, res: Response): Promise<void> {
  try {
    const commId = req.params.commId as string;
    const comm = await prisma.communication.findFirst({ where: { id: commId, organizationId: req.organizationId! } });
    if (!comm) { notFound(res, "Log entry not found"); return; }
    if (comm.createdById !== req.userId && req.memberRole !== MemberRole.OWNER && req.memberRole !== MemberRole.ADMIN) {
      forbidden(res, "You can only delete your own log entries"); return;
    }
    await prisma.communication.delete({ where: { id: commId } });
    ok(res, null, "Log entry deleted");
  } catch (err) { serverError(res, err); }
}

export async function listAllCommunications(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const limit = parseInt((req.query.limit as string) || "300");
    const communications = await prisma.communication.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        party: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    ok(res, { communications });
  } catch (err) { serverError(res, err); }
}

// ── Follow-ups (across all parties) ─────────────────────────
// Powers the "My Follow-ups" list — every logged communication that has
// a follow-up date set, across every customer/supplier, in one place.
export async function listFollowUps(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const filter = (req.query.filter as string) || "upcoming"; // "upcoming" | "overdue" | "all"
    const now = new Date();

    const where: any = { organizationId: orgId, followUpDate: { not: null } };
    if (filter === "upcoming") where.followUpDate = { gte: now };
    else if (filter === "overdue") where.followUpDate = { lt: now };

    const followUps = await prisma.communication.findMany({
      where,
      orderBy: { followUpDate: filter === "overdue" ? "desc" : "asc" },
      take: 200,
      include: {
        party: { select: { id: true, name: true, type: true, phone: true, mobile: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    ok(res, { followUps });
  } catch (err) { serverError(res, err); }
}

// ── CRM Stats ────────────────────────────────────────────────

export async function getCrmStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const [customers, suppliers, both, followUps] = await Promise.all([
      prisma.party.count({ where: { organizationId: orgId, type: "CUSTOMER", isActive: true } }),
      prisma.party.count({ where: { organizationId: orgId, type: "SUPPLIER", isActive: true } }),
      prisma.party.count({ where: { organizationId: orgId, type: "BOTH", isActive: true } }),
      prisma.communication.count({
        where: {
          organizationId: orgId,
          followUpDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);
    ok(res, { customers, suppliers, both, total: customers + suppliers + both, followUpsThisWeek: followUps });
  } catch (err) { serverError(res, err); }
}

export async function bulkImportParties(req: OrgRequest, res: Response): Promise<void> {
  try {
    const rows: Record<string, string>[] = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) { badRequest(res, "No rows provided"); return; }

    const errors: string[] = [];
    let created = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = (r["Name"] || r["name"] || "").trim();
      if (!name) { errors.push(`Row ${i + 2}: Name is required`); continue; }

      const rawType = (r["Type"] || r["type"] || "CUSTOMER").trim().toUpperCase();
      const type = ["CUSTOMER", "SUPPLIER", "BOTH"].includes(rawType) ? rawType as any : "CUSTOMER";

      try {
        await prisma.party.create({
          data: {
            organizationId: req.organizationId!,
            name,
            displayName: r["Display Name"] || r["displayName"] || name,
            type,
            email: r["Email"] || r["email"] || null,
            phone: r["Phone"] || r["phone"] || null,
            mobile: r["Mobile"] || r["mobile"] || null,
            gstin: r["GSTIN"] || r["gstin"] || null,
            city: r["City"] || r["city"] || null,
            state: r["State"] || r["state"] || null,
            country: r["Country"] || r["country"] || null,
            notes: r["Notes"] || r["notes"] || null,
          },
        });
        created++;
      } catch {
        errors.push(`Row ${i + 2}: Failed to create (duplicate or invalid data)`);
      }
    }

    ok(res, { created, errors });
  } catch (err) { serverError(res, err); }
}
