import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, badRequest, notFound, serverError, conflict } from "../utils/response";
import { bustCache } from "../middleware/cacheMiddleware";
import { writeAuditLog, getIp } from "../utils/auditLog";

const db = () => (prisma as any);

function computeWarrantyEndDate(soldAt: Date | undefined | null, warrantyMonths: number | undefined | null): Date | undefined {
  if (!warrantyMonths) return undefined;
  const base = soldAt ?? new Date();
  const end = new Date(base);
  end.setMonth(end.getMonth() + warrantyMonths);
  return end;
}

// ── Validators ───────────────────────────────────────────────
const carLeadSchema = z.object({
  leadType: z.enum(["BUYER", "SELLER"]).default("BUYER"),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  interestedMake: z.string().optional(),
  interestedModel: z.string().optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  tradeInVehicle: z.string().optional(),
  source: z.enum(["WALK_IN", "PHONE", "WEBSITE", "INSTAGRAM", "META_ADS", "SEO", "REFERRAL", "RS", "DS", "CTE", "OTHER"]).default("OTHER"),
  status: z.enum(["NEW", "HOT", "WARM", "COLD", "URGENT", "CONTACTED", "NOT_INTERESTED", "CONVERTED", "LOST"]).default("NEW"),
  notes: z.string().optional(),
  isDoNotCall: z.boolean().optional(),
  testDriveDone: z.boolean().optional(),
  lastContactedAt: z.string().optional(),
  assignedToId: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
  convertedVehicleId: z.string().optional(),
});

const vehicleSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  variant: z.string().optional(),
  year: z.number().int().optional(),
  registrationNo: z.string().optional(),
  chassisNo: z.string().optional(),
  engineNo: z.string().optional(),
  color: z.string().optional(),
  odometer: z.number().int().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  purchasePrice: z.number().optional(),
  sellerName: z.string().optional(),
  sellerPhone: z.string().optional(),
  sellerEmail: z.string().email().optional().or(z.literal("")),
  purchasedAt: z.string().optional(),
  registrationDate: z.string().optional(),
  salePrice: z.number().optional(),
  status: z.enum(["IN_STOCK", "RESERVED", "SOLD"]).default("IN_STOCK"),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  ownerEmail: z.string().email().optional().or(z.literal("")),
  ownerAddress: z.string().optional(),
  soldAt: z.string().optional(),
  warrantyMonths: z.number().int().optional(),
  assignedToId: z.string().optional(),
  notes: z.string().optional(),
});

const insuranceSchema = z.object({
  provider: z.string().min(1),
  policyNumber: z.string().optional(),
  type: z.enum(["THIRD_PARTY", "COMPREHENSIVE", "ZERO_DEP"]).default("THIRD_PARTY"),
  startDate: z.string(),
  endDate: z.string(),
  premium: z.number().optional(),
  idv: z.number().optional(),
  odAmount: z.number().optional(),
  ncb: z.number().optional(),
  paymentMode: z.string().optional(),
  sharing: z.string().optional(),
  notes: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════
// Leads
// ═══════════════════════════════════════════════════════════════

export async function listCarLeads(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status, search, assignedToId, dnc, followUp, leadType, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (dnc === "true") where.isDoNotCall = true;
    // "Due today or overdue" worklist — same shape as the CRM Leads module's
    // equivalent filter, used by the dashboard's Today's Follow-ups panel.
    if (followUp === "due") {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      where.status = { notIn: ["CONVERTED", "LOST", "NOT_INTERESTED"] };
      where.isDoNotCall = false;
      where.nextFollowUpDate = { lte: endOfToday };
    }
    // Follow-ups tab: every open lead with any follow-up date at all — past,
    // today, or scheduled far in the future — buyer and seller leads both.
    if (followUp === "all") {
      where.status = { notIn: ["CONVERTED", "LOST", "NOT_INTERESTED"] };
      where.nextFollowUpDate = { not: null };
    }
    // Buyer Leads tab defaults to BUYER for backward compatibility; Seller
    // Leads passes leadType=SELLER; the Follow-ups tab (followUp=all) shows
    // both unless a specific leadType is also requested.
    if (leadType) where.leadType = leadType;
    else if (followUp !== "all") where.leadType = "BUYER";
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
        { interestedMake: { contains: search, mode: "insensitive" } },
        { interestedModel: { contains: search, mode: "insensitive" } },
      ];
    }
    const orderBy: any = (followUp === "due" || followUp === "all") ? [{ nextFollowUpDate: "asc" }] : { createdAt: "desc" };
    const [leads, total] = await Promise.all([
      db().carLead.findMany({ where, skip, take: parseInt(limit), orderBy }),
      db().carLead.count({ where }),
    ]);

    // assignedToId has no Prisma relation to User — attach display names
    // manually for the cross-assignee follow-up worklists.
    let leadsOut: any[] = leads;
    if (followUp === "due" || followUp === "all") {
      const assigneeIds = [...new Set(leads.map((l: any) => l.assignedToId).filter(Boolean))];
      const assignees = assigneeIds.length
        ? await prisma.user.findMany({ where: { id: { in: assigneeIds as string[] } }, select: { id: true, name: true } })
        : [];
      const nameById = new Map(assignees.map((u) => [u.id, u.name]));
      leadsOut = leads.map((l: any) => ({ ...l, assignedTo: l.assignedToId ? { name: nameById.get(l.assignedToId) ?? "Unknown" } : null }));
    }

    ok(res, { leads: leadsOut, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { serverError(res, e); }
}

export async function getCarLead(req: OrgRequest, res: Response): Promise<void> {
  try {
    const lead = await db().carLead.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!lead) { notFound(res, "Lead not found"); return; }
    ok(res, lead);
  } catch (e) { serverError(res, e); }
}

export async function createCarLead(req: OrgRequest, res: Response): Promise<void> {
  try {
    const parsed = carLeadSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }
    const data = parsed.data;
    const lead = await db().carLead.create({
      data: {
        organizationId: req.organizationId!,
        leadType: data.leadType,
        name: data.name,
        phone: data.phone || undefined,
        email: data.email || undefined,
        interestedMake: data.interestedMake || undefined,
        interestedModel: data.interestedModel || undefined,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        tradeInVehicle: data.tradeInVehicle || undefined,
        source: data.source,
        status: data.status,
        notes: data.notes || undefined,
        isDoNotCall: data.isDoNotCall ?? false,
        testDriveDone: data.testDriveDone ?? false,
        lastContactedAt: data.lastContactedAt ? new Date(data.lastContactedAt) : undefined,
        assignedToId: data.assignedToId || undefined,
        nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : undefined,
      },
    });
    bustCache(req.organizationId!, "/api/cars");
    writeAuditLog({ organizationId: req.organizationId!, userId: req.userId, userEmail: req.userEmail, action: "CAR_LEAD_CREATED", resource: "CarLead", resourceId: lead.id, description: `Lead added: ${lead.name}`, ipAddress: getIp(req as any) });
    created(res, lead, "Lead added");
  } catch (e) { serverError(res, e); }
}

export async function updateCarLead(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().carLead.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Lead not found"); return; }
    const parsed = carLeadSchema.partial().safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }
    const data = parsed.data;
    const lead = await db().carLead.update({
      where: { id: existing.id },
      data: {
        ...data,
        email: data.email === "" ? null : data.email,
        nextFollowUpDate: data.nextFollowUpDate !== undefined ? (data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null) : undefined,
        lastContactedAt: data.lastContactedAt !== undefined ? (data.lastContactedAt ? new Date(data.lastContactedAt) : null) : undefined,
      },
    });
    bustCache(req.organizationId!, "/api/cars");
    ok(res, lead, "Lead updated");
  } catch (e) { serverError(res, e); }
}

export async function deleteCarLead(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().carLead.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Lead not found"); return; }
    await db().carLead.delete({ where: { id: existing.id } });
    bustCache(req.organizationId!, "/api/cars");
    ok(res, null, "Lead deleted");
  } catch (e) { serverError(res, e); }
}

// Manual paste / CSV import — mirrors leads.controller.ts's bulkImportLeads.
// Header aliases a real client's own tracking sheet is likely to use, mapped
// to the CarLead field they mean — deliberately generous, since the whole
// point is not silently dropping columns just because they're not exactly
// "phone" or "model". Every recognized field is checked with `pick()`, and
// anything left over goes into `notes` labeled by its own header, so a
// completely unrecognized column still shows up somewhere rather than
// vanishing.
const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "customer name", "customer"],
  phone: ["phone", "contact", "mobile", "contact no", "contact no.", "contact number", "mobile number", "phone number"],
  email: ["email", "email address", "e-mail"],
  model: ["requirement", "model", "car", "vehicle", "interested model", "interested_model"],
  make: ["make", "brand", "interested make", "interested_make"],
  budget: ["budget", "budget range"],
  hotStatus: ["hot", "h", "status"],
};

function pick(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function parseBudgetRange(raw: string): { min?: number; max?: number } {
  if (!raw) return {};
  const s = raw.toLowerCase().replace(/,/g, "");
  const isLac = /lac|lakh|\bl\b/.test(s);
  const mult = isLac ? 100000 : 1;
  const range = s.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (range) return { min: parseFloat(range[1]) * mult, max: parseFloat(range[2]) * mult };
  const single = s.match(/(\d+(?:\.\d+)?)/);
  if (single) { const v = parseFloat(single[1]) * mult; return { min: v, max: v }; }
  return {};
}

const STATUS_CODE_MAP: Record<string, string> = {
  H: "HOT", HOT: "HOT", W: "WARM", WARM: "WARM", C: "COLD", COLD: "COLD",
  U: "URGENT", URGENT: "URGENT", NEW: "NEW", LOST: "LOST", CONTACTED: "CONTACTED",
  "NOT INT": "NOT_INTERESTED", "NOT INTERESTED": "NOT_INTERESTED",
};

export async function bulkImportCarLeads(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { leads: rawLeads, assignedToId } = req.body;
    if (!Array.isArray(rawLeads) || rawLeads.length === 0) { badRequest(res, "leads array is required"); return; }
    if (rawLeads.length > 1000) { badRequest(res, "Max 1000 leads per import"); return; }

    const orgId = req.organizationId!;
    const results = { created: 0, skipped: 0, errors: [] as string[] };
    const batchSize = 50;
    const recognizedKeys = new Set(Object.values(FIELD_ALIASES).flat());

    for (let i = 0; i < rawLeads.length; i += batchSize) {
      const batch = rawLeads.slice(i, i + batchSize);
      const toCreate: any[] = [];

      for (const rawRow of batch) {
        // Defensive lowercase — the frontend already normalises keys, but
        // don't assume every caller does. Object.create(null) means a
        // sheet column literally named "__proto__" just becomes an own
        // property here instead of polluting Object.prototype.
        const row: Record<string, any> = Object.create(null);
        for (const [k, v] of Object.entries(rawRow)) row[k.trim().toLowerCase()] = v;

        const name = pick(row, FIELD_ALIASES.name);
        if (!name) { results.skipped++; continue; }
        const phone = pick(row, FIELD_ALIASES.phone);

        if (phone) {
          const exists = await db().carLead.findFirst({ where: { organizationId: orgId, phone } });
          if (exists) { results.skipped++; continue; }
        }

        const budget = parseBudgetRange(pick(row, FIELD_ALIASES.budget));
        const rawStatus = pick(row, FIELD_ALIASES.hotStatus).toUpperCase();
        const status = STATUS_CODE_MAP[rawStatus] || "NEW";

        // Anything not mapped to a real column is preserved as a labeled
        // note line, so bulk-importing a client's own sheet never silently
        // drops data just because a header doesn't match a known alias.
        const noteLines: string[] = [];
        if (rawStatus && !STATUS_CODE_MAP[rawStatus]) noteLines.push(`Status (from sheet): ${rawStatus}`);
        for (const [key, value] of Object.entries(row)) {
          if (recognizedKeys.has(key)) continue;
          const v = (value ?? "").toString().trim();
          if (v) noteLines.push(`${key}: ${v}`);
        }

        toCreate.push({
          organizationId: orgId,
          name,
          phone: phone || undefined,
          email: pick(row, FIELD_ALIASES.email) || undefined,
          interestedMake: pick(row, FIELD_ALIASES.make) || undefined,
          interestedModel: pick(row, FIELD_ALIASES.model) || undefined,
          budgetMin: budget.min,
          budgetMax: budget.max,
          source: "OTHER",
          status,
          notes: noteLines.length > 0 ? noteLines.join("\n") : undefined,
          assignedToId: assignedToId || undefined,
        });
      }

      if (toCreate.length > 0) {
        await db().carLead.createMany({ data: toCreate, skipDuplicates: true });
        results.created += toCreate.length;
      }
    }

    bustCache(req.organizationId!, "/api/cars");
    ok(res, results);
  } catch (e) { serverError(res, e); }
}

// Convert a lead directly into a sold Vehicle (+ its first insurance policy).
export async function convertCarLead(req: OrgRequest, res: Response): Promise<void> {
  try {
    const lead = await db().carLead.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!lead) { notFound(res, "Lead not found"); return; }
    if (lead.convertedVehicleId) { conflict(res, "This lead was already converted"); return; }

    const vParsed = vehicleSchema.safeParse(req.body.vehicle);
    if (!vParsed.success) { badRequest(res, "Vehicle details are required", vParsed.error.flatten().fieldErrors); return; }
    const v = vParsed.data;

    let insuranceInput: z.infer<typeof insuranceSchema> | null = null;
    if (req.body.insurance) {
      const iParsed = insuranceSchema.safeParse(req.body.insurance);
      if (!iParsed.success) { badRequest(res, "Insurance details invalid", iParsed.error.flatten().fieldErrors); return; }
      insuranceInput = iParsed.data;
    }

    const result = await prisma.$transaction(async (tx) => {
      const vehicle = await (tx as any).vehicle.create({
        data: {
          organizationId: req.organizationId!,
          make: v.make, model: v.model, variant: v.variant, year: v.year,
          registrationNo: v.registrationNo, chassisNo: v.chassisNo, engineNo: v.engineNo,
          color: v.color, odometer: v.odometer, fuelType: v.fuelType, transmission: v.transmission,
          purchasePrice: v.purchasePrice, salePrice: v.salePrice,
          status: "SOLD",
          ownerName: v.ownerName || lead.name,
          ownerPhone: v.ownerPhone || lead.phone,
          ownerEmail: v.ownerEmail || lead.email,
          soldAt: v.soldAt ? new Date(v.soldAt) : new Date(),
          notes: v.notes,
        },
      });

      if (insuranceInput) {
        await (tx as any).vehicleInsurance.create({
          data: {
            organizationId: req.organizationId!,
            vehicleId: vehicle.id,
            provider: insuranceInput.provider,
            policyNumber: insuranceInput.policyNumber,
            type: insuranceInput.type,
            startDate: new Date(insuranceInput.startDate),
            endDate: new Date(insuranceInput.endDate),
            premium: insuranceInput.premium,
            notes: insuranceInput.notes,
          },
        });
      }

      await (tx as any).carLead.update({
        where: { id: lead.id },
        data: { status: "CONVERTED", convertedVehicleId: vehicle.id },
      });

      return vehicle;
    });

    bustCache(req.organizationId!, "/api/cars");
    writeAuditLog({ organizationId: req.organizationId!, userId: req.userId, userEmail: req.userEmail, action: "CAR_LEAD_CONVERTED", resource: "Vehicle", resourceId: result.id, description: `Lead ${lead.name} converted to a sale: ${v.make} ${v.model}`, ipAddress: getIp(req as any) });
    created(res, result, "Lead converted to a sale");
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
// Vehicles
// ═══════════════════════════════════════════════════════════════

export async function listVehicles(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status, search, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { make: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { registrationNo: { contains: search, mode: "insensitive" } },
        { ownerName: { contains: search, mode: "insensitive" } },
        { ownerPhone: { contains: search } },
      ];
    }
    const [vehicles, total] = await Promise.all([
      db().vehicle.findMany({
        where, skip, take: parseInt(limit),
        include: { insurances: { orderBy: { endDate: "desc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
      }),
      db().vehicle.count({ where }),
    ]);
    ok(res, { vehicles, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { serverError(res, e); }
}

export async function getVehicle(req: OrgRequest, res: Response): Promise<void> {
  try {
    const vehicle = await db().vehicle.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: { insurances: { orderBy: { endDate: "desc" } }, sourceLead: true },
    });
    if (!vehicle) { notFound(res, "Vehicle not found"); return; }
    ok(res, vehicle);
  } catch (e) { serverError(res, e); }
}

export async function createVehicle(req: OrgRequest, res: Response): Promise<void> {
  try {
    const parsed = vehicleSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }
    const v = parsed.data;
    const soldAt = v.soldAt ? new Date(v.soldAt) : undefined;
    const vehicle = await db().vehicle.create({
      data: {
        organizationId: req.organizationId!,
        make: v.make, model: v.model, variant: v.variant, year: v.year,
        registrationNo: v.registrationNo, chassisNo: v.chassisNo, engineNo: v.engineNo,
        color: v.color, odometer: v.odometer, fuelType: v.fuelType, transmission: v.transmission,
        purchasePrice: v.purchasePrice, salePrice: v.salePrice, status: v.status,
        sellerName: v.sellerName, sellerPhone: v.sellerPhone, sellerEmail: v.sellerEmail || undefined,
        purchasedAt: v.purchasedAt ? new Date(v.purchasedAt) : undefined,
        registrationDate: v.registrationDate ? new Date(v.registrationDate) : undefined,
        ownerName: v.ownerName, ownerPhone: v.ownerPhone, ownerEmail: v.ownerEmail || undefined,
        ownerAddress: v.ownerAddress,
        soldAt,
        warrantyMonths: v.warrantyMonths,
        warrantyEndDate: computeWarrantyEndDate(soldAt, v.warrantyMonths),
        assignedToId: v.assignedToId || undefined,
        notes: v.notes,
      },
    });
    bustCache(req.organizationId!, "/api/cars");
    created(res, vehicle, "Vehicle added");
  } catch (e) { serverError(res, e); }
}

export async function updateVehicle(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().vehicle.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Vehicle not found"); return; }
    const parsed = vehicleSchema.partial().safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }
    const data = parsed.data;
    const soldAt = data.soldAt !== undefined ? (data.soldAt ? new Date(data.soldAt) : null) : undefined;
    // Recompute warranty end date if either warrantyMonths or soldAt changed
    // in this update, using whichever soldAt is now in effect.
    const effectiveSoldAt = soldAt !== undefined ? soldAt : existing.soldAt;
    const warrantyEndDate = (data.warrantyMonths !== undefined || soldAt !== undefined)
      ? (computeWarrantyEndDate(effectiveSoldAt, data.warrantyMonths ?? existing.warrantyMonths) ?? null)
      : undefined;
    const vehicle = await db().vehicle.update({
      where: { id: existing.id },
      data: {
        ...data,
        ownerEmail: data.ownerEmail === "" ? null : data.ownerEmail,
        sellerEmail: data.sellerEmail === "" ? null : data.sellerEmail,
        soldAt,
        purchasedAt: data.purchasedAt !== undefined ? (data.purchasedAt ? new Date(data.purchasedAt) : null) : undefined,
        registrationDate: data.registrationDate !== undefined ? (data.registrationDate ? new Date(data.registrationDate) : null) : undefined,
        warrantyEndDate,
      },
    });
    bustCache(req.organizationId!, "/api/cars");
    ok(res, vehicle, "Vehicle updated");
  } catch (e) { serverError(res, e); }
}

// Header aliases for a real client's vehicle+insurance tracking sheet
// (NAME/MOB NUMBER/REG NO/DATE OF REG/ADDRESS/ENG NO/CHASSIS NO/MAKE/
// MODEL-VAR/FUEL/INS TYPE/INS CO NAME/IDV/OD/NCB/PREM/EXPIRY-RENEWAL/
// PAYMENT MODE/SHARING) — same generous-matching + notes-fallback approach
// as bulkImportCarLeads, so nothing gets silently dropped here either.
const VEHICLE_FIELD_ALIASES: Record<string, string[]> = {
  ownerName: ["name", "owner name", "customer name"],
  ownerPhone: ["mob numb", "mobile", "mob number", "mobile number", "contact", "phone"],
  registrationNo: ["reg no", "registration no", "registration number", "reg. no"],
  registrationDate: ["date of reg", "date of registration", "reg date"],
  ownerAddress: ["address"],
  engineNo: ["eng no", "engine no", "engine number"],
  chassisNo: ["chassis no", "chassis number"],
  make: ["make"],
  model: ["model/var", "model", "model / variant", "variant"],
  fuelType: ["fuel"],
  insType: ["ins type", "insurance type"],
  insProvider: ["ins co nam", "ins co name", "insurance company", "insurer"],
  idv: ["idv"],
  odAmount: ["od"],
  ncb: ["ncb"],
  premium: ["prem", "premium"],
  expiry: ["expiry/reni", "expiry", "renewal", "expiry/renewal"],
  paymentMode: ["payment m", "payment mode"],
  sharing: ["sharing"],
};

function vpick(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s && s.toUpperCase() !== "NA") return s;
    }
  }
  return "";
}

function parseSheetDate(raw: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d;
}

const INS_TYPE_MAP: Record<string, string> = {
  "THIRD PARTY": "THIRD_PARTY", "TP": "THIRD_PARTY", "COMPREHENSIVE": "COMPREHENSIVE",
  "COMP": "COMPREHENSIVE", "ZERO DEP": "ZERO_DEP", "ZERO DEPRECIATION": "ZERO_DEP", "BUMPER TO BUMPER": "ZERO_DEP",
};

// Bulk-import vehicles (+ their insurance, if present) from a client's own
// tracking sheet. Each row creates one SOLD Vehicle (since it names an
// owner) and, when insurance columns are present, one VehicleInsurance too.
export async function bulkImportVehicles(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { vehicles: rawRows, assignedToId } = req.body;
    if (!Array.isArray(rawRows) || rawRows.length === 0) { badRequest(res, "vehicles array is required"); return; }
    if (rawRows.length > 1000) { badRequest(res, "Max 1000 rows per import"); return; }

    const orgId = req.organizationId!;
    const results = { created: 0, skipped: 0, errors: [] as string[] };
    const recognizedKeys = new Set(Object.values(VEHICLE_FIELD_ALIASES).flat());

    for (const rawRow of rawRows) {
      // Object.create(null): a sheet column literally named "__proto__"
      // must not be able to pollute Object.prototype via row[k] = v below.
      const row: Record<string, any> = Object.create(null);
      for (const [k, v] of Object.entries(rawRow)) row[k.trim().toLowerCase()] = v;

      const ownerName = vpick(row, VEHICLE_FIELD_ALIASES.ownerName);
      const make = vpick(row, VEHICLE_FIELD_ALIASES.make);
      const regNo = vpick(row, VEHICLE_FIELD_ALIASES.registrationNo);
      if (!ownerName && !regNo) { results.skipped++; continue; }

      if (regNo) {
        const exists = await db().vehicle.findFirst({ where: { organizationId: orgId, registrationNo: regNo } });
        if (exists) { results.skipped++; continue; }
      }

      const noteLines: string[] = [];
      for (const [key, value] of Object.entries(row)) {
        if (recognizedKeys.has(key)) continue;
        const v = (value ?? "").toString().trim();
        if (v && v.toUpperCase() !== "NA") noteLines.push(`${key}: ${v}`);
      }

      const vehicle = await db().vehicle.create({
        data: {
          organizationId: orgId,
          make: make || "Unknown",
          model: vpick(row, VEHICLE_FIELD_ALIASES.model) || "Unknown",
          registrationNo: regNo || undefined,
          registrationDate: parseSheetDate(vpick(row, VEHICLE_FIELD_ALIASES.registrationDate)),
          engineNo: vpick(row, VEHICLE_FIELD_ALIASES.engineNo) || undefined,
          chassisNo: vpick(row, VEHICLE_FIELD_ALIASES.chassisNo) || undefined,
          fuelType: vpick(row, VEHICLE_FIELD_ALIASES.fuelType) || undefined,
          status: "SOLD",
          ownerName: ownerName || undefined,
          ownerPhone: vpick(row, VEHICLE_FIELD_ALIASES.ownerPhone) || undefined,
          ownerAddress: vpick(row, VEHICLE_FIELD_ALIASES.ownerAddress) || undefined,
          assignedToId: assignedToId || undefined,
          notes: noteLines.length > 0 ? noteLines.join("\n") : undefined,
        },
      });

      const insProvider = vpick(row, VEHICLE_FIELD_ALIASES.insProvider);
      const expiryRaw = vpick(row, VEHICLE_FIELD_ALIASES.expiry);
      const expiryDate = parseSheetDate(expiryRaw);
      if (insProvider && expiryDate) {
        const insTypeRaw = vpick(row, VEHICLE_FIELD_ALIASES.insType).toUpperCase();
        await db().vehicleInsurance.create({
          data: {
            organizationId: orgId,
            vehicleId: vehicle.id,
            provider: insProvider,
            type: INS_TYPE_MAP[insTypeRaw] || "THIRD_PARTY",
            startDate: expiryDate > new Date() ? new Date(new Date(expiryDate).setFullYear(expiryDate.getFullYear() - 1)) : new Date(),
            endDate: expiryDate,
            premium: parseFloat(vpick(row, VEHICLE_FIELD_ALIASES.premium)) || undefined,
            idv: parseFloat(vpick(row, VEHICLE_FIELD_ALIASES.idv)) || undefined,
            odAmount: parseFloat(vpick(row, VEHICLE_FIELD_ALIASES.odAmount)) || undefined,
            ncb: parseFloat(vpick(row, VEHICLE_FIELD_ALIASES.ncb)) || undefined,
            paymentMode: vpick(row, VEHICLE_FIELD_ALIASES.paymentMode) || undefined,
            sharing: vpick(row, VEHICLE_FIELD_ALIASES.sharing) || undefined,
          },
        });
      }

      results.created++;
    }

    bustCache(req.organizationId!, "/api/cars");
    ok(res, results);
  } catch (e) { serverError(res, e); }
}

// Warranty tab: every sold vehicle that has warranty info, soonest-expiring first.
export async function listWarranties(req: OrgRequest, res: Response): Promise<void> {
  try {
    const vehicles = await db().vehicle.findMany({
      where: { organizationId: req.organizationId!, status: "SOLD", warrantyEndDate: { not: null } },
      orderBy: { warrantyEndDate: "asc" },
    });
    ok(res, { vehicles, total: vehicles.length });
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
// Insurance
// ═══════════════════════════════════════════════════════════════

export async function addInsurance(req: OrgRequest, res: Response): Promise<void> {
  try {
    const vehicle = await db().vehicle.findFirst({ where: { id: req.params.vehicleId, organizationId: req.organizationId! } });
    if (!vehicle) { notFound(res, "Vehicle not found"); return; }
    const parsed = insuranceSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }
    const data = parsed.data;
    if (new Date(data.endDate) <= new Date(data.startDate)) { badRequest(res, "End date must be after start date"); return; }
    const insurance = await db().vehicleInsurance.create({
      data: {
        organizationId: req.organizationId!,
        vehicleId: vehicle.id,
        provider: data.provider,
        policyNumber: data.policyNumber,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        premium: data.premium,
        idv: data.idv, odAmount: data.odAmount, ncb: data.ncb,
        paymentMode: data.paymentMode, sharing: data.sharing,
        notes: data.notes,
      },
    });
    bustCache(req.organizationId!, "/api/cars");
    created(res, insurance, "Insurance policy added");
  } catch (e) { serverError(res, e); }
}

export async function updateInsurance(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().vehicleInsurance.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Insurance policy not found"); return; }
    const parsed = insuranceSchema.partial().safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }
    const data = parsed.data;
    const insurance = await db().vehicleInsurance.update({
      where: { id: existing.id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });
    bustCache(req.organizationId!, "/api/cars");
    ok(res, insurance, "Insurance policy updated");
  } catch (e) { serverError(res, e); }
}

// Vehicles whose most current insurance policy is expiring within `days`
// (default 30) or has already lapsed — drives the red-alert panel.
export async function listExpiringInsurance(req: OrgRequest, res: Response): Promise<void> {
  try {
    const days = parseInt((req.query.days as string) || "30");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    cutoff.setHours(23, 59, 59, 999);

    // Latest policy per vehicle, only where that policy ends before the cutoff.
    const vehicles = await db().vehicle.findMany({
      where: { organizationId: req.organizationId!, insurances: { some: { endDate: { lte: cutoff } } } },
      include: { insurances: { orderBy: { endDate: "desc" }, take: 1 } },
    });
    // Only keep vehicles whose LATEST (most recent) policy is the one expiring —
    // a vehicle that already renewed shouldn't show as expiring on its old policy.
    const expiring = vehicles
      .filter((v: any) => v.insurances[0] && new Date(v.insurances[0].endDate) <= cutoff)
      .sort((a: any, b: any) => new Date(a.insurances[0].endDate).getTime() - new Date(b.insurances[0].endDate).getTime());

    ok(res, { vehicles: expiring, total: expiring.length });
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
// Stats
// ═══════════════════════════════════════════════════════════════

// Sales performance for a given period — powers the "how much sold last
// month" filter. `period` is one of this_month | last_month | this_year | all,
// or pass explicit `from`/`to` (ISO dates) for a custom range.
export async function getSalesReport(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { period = "this_month", from, to } = req.query as Record<string, string>;

    let start: Date | undefined;
    let end: Date | undefined;
    const now = new Date();
    if (from || to) {
      start = from ? new Date(from) : undefined;
      end = to ? new Date(to) : undefined;
    } else if (period === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (period === "last_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "this_year") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
    } // period === "all" leaves start/end undefined — no date filter

    const where: any = { organizationId: orgId, status: "SOLD" };
    if (start || end) {
      where.soldAt = {};
      if (start) where.soldAt.gte = start;
      if (end) where.soldAt.lt = end;
    }

    const [count, agg, vehicles] = await Promise.all([
      db().vehicle.count({ where }),
      db().vehicle.aggregate({ where, _sum: { salePrice: true } }),
      db().vehicle.findMany({ where, orderBy: { soldAt: "desc" }, take: 50, select: { id: true, make: true, model: true, registrationNo: true, ownerName: true, salePrice: true, soldAt: true } }),
    ]);

    ok(res, { period, from: start ?? null, to: end ?? null, count, totalRevenue: agg._sum.salePrice ?? 0, vehicles });
  } catch (e) { serverError(res, e); }
}

// Month-by-month lead funnel — mirrors the client's own tracking sheet
// (enquiries by source, by status, test drives done, conversion %).
export async function getMonthlyLeadReport(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const months = Math.min(parseInt((req.query.months as string) || "12"), 24);

    const rangeStart = new Date();
    rangeStart.setMonth(rangeStart.getMonth() - (months - 1));
    rangeStart.setDate(1);
    rangeStart.setHours(0, 0, 0, 0);

    const historical = await db().carHistoricalStat.findMany({ where: { organizationId: orgId }, orderBy: { month: "asc" } });

    // Historical months can reach further back than the default rolling
    // window (e.g. a client's pre-software tracking sheet) — extend the
    // range to cover the earliest one instead of silently dropping it.
    if (historical.length > 0) {
      const earliest = historical[0].month; // "YYYY-MM", sorted ascending
      const [ey, em] = earliest.split("-").map(Number);
      const earliestDate = new Date(ey, em - 1, 1);
      if (earliestDate < rangeStart) rangeStart.setTime(earliestDate.getTime());
    }
    const now = new Date();
    const totalMonths = Math.max(months, (now.getFullYear() - rangeStart.getFullYear()) * 12 + (now.getMonth() - rangeStart.getMonth()) + 1);

    const leads = await db().carLead.findMany({
      where: { organizationId: orgId, createdAt: { gte: rangeStart } },
      select: { createdAt: true, source: true, status: true, testDriveDone: true },
    });

    // Build one bucket per month, oldest first, even if empty.
    const buckets: Record<string, { month: string; totalEnquiries: number; bySource: Record<string, number>; byStatus: Record<string, number>; testDrivesDone: number; converted: number; salesBySource?: Record<string, number>; isHistorical?: boolean }> = {};
    for (let i = 0; i < totalMonths; i++) {
      const d = new Date(rangeStart); d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = { month: key, totalEnquiries: 0, bySource: {}, byStatus: {}, testDrivesDone: 0, converted: 0 };
    }

    for (const l of leads) {
      const d = new Date(l.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = buckets[key];
      if (!b) continue; // outside range (shouldn't happen given the query filter)
      b.totalEnquiries++;
      b.bySource[l.source] = (b.bySource[l.source] ?? 0) + 1;
      b.byStatus[l.status] = (b.byStatus[l.status] ?? 0) + 1;
      if (l.testDriveDone) b.testDrivesDone++;
      if (l.status === "CONVERTED") b.converted++;
    }

    // A historical row, where present, is the authoritative source of truth
    // for that month (it represents real pre-software business, not a
    // fallback) — it replaces whatever the live computation produced.
    for (const h of historical) {
      buckets[h.month] = {
        month: h.month,
        totalEnquiries: h.totalEnquiries,
        bySource: h.bySource as Record<string, number>,
        byStatus: { HOT: h.hot, WARM: h.warm, COLD: h.cold, NOT_INTERESTED: h.notInterested, LOST: h.lost, CONVERTED: h.converted },
        testDrivesDone: h.testDrivesDone,
        converted: h.converted,
        salesBySource: h.salesBySource as Record<string, number>,
        isHistorical: true,
      };
    }

    const rows = Object.values(buckets)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((b) => ({
        ...b,
        conversionRate: b.totalEnquiries > 0 ? Math.round((b.converted / b.totalEnquiries) * 100) : 0,
      }));

    ok(res, { months: rows });
  } catch (e) { serverError(res, e); }
}

// ═══════════════════════════════════════════════════════════════
// Historical stats (pre-software monthly totals, bulk-imported)
// ═══════════════════════════════════════════════════════════════

const SOURCE_KEYS = ["INSTAGRAM", "RS", "DS", "CTE", "META_ADS", "SEO", "REFERRAL"];

export async function listHistoricalStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const rows = await db().carHistoricalStat.findMany({ where: { organizationId: req.organizationId! }, orderBy: { month: "asc" } });
    ok(res, rows);
  } catch (e) { serverError(res, e); }
}

export async function bulkImportHistoricalStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { rows } = req.body as { rows: any[] };
    if (!Array.isArray(rows) || rows.length === 0) { badRequest(res, "rows array is required"); return; }
    const orgId = req.organizationId!;
    let created = 0, skipped = 0;
    const errors: string[] = [];

    for (const r of rows) {
      const month = (r.month || "").toString().trim();
      if (!/^\d{4}-\d{2}$/.test(month)) { skipped++; errors.push(`Skipped row with invalid month: "${r.month}"`); continue; }

      const bySource: Record<string, number> = {};
      const salesBySource: Record<string, number> = {};
      for (const key of SOURCE_KEYS) {
        bySource[key] = Number(r.bySource?.[key]) || 0;
        salesBySource[key] = Number(r.salesBySource?.[key]) || 0;
      }
      const converted = Object.values(salesBySource).reduce((s, n) => s + n, 0);

      await db().carHistoricalStat.upsert({
        where: { organizationId_month: { organizationId: orgId, month } },
        create: {
          organizationId: orgId, month, bySource, salesBySource,
          hot: Number(r.hot) || 0, warm: Number(r.warm) || 0, cold: Number(r.cold) || 0,
          notInterested: Number(r.notInterested) || 0, testDrivesDone: Number(r.testDrivesDone) || 0,
          totalEnquiries: Number(r.totalEnquiries) || 0, lost: Number(r.lost) || 0, converted,
          notes: r.notes || undefined,
        },
        update: {
          bySource, salesBySource,
          hot: Number(r.hot) || 0, warm: Number(r.warm) || 0, cold: Number(r.cold) || 0,
          notInterested: Number(r.notInterested) || 0, testDrivesDone: Number(r.testDrivesDone) || 0,
          totalEnquiries: Number(r.totalEnquiries) || 0, lost: Number(r.lost) || 0, converted,
          notes: r.notes || undefined,
        },
      });
      created++;
    }

    bustCache(req.organizationId!, "/api/cars");
    ok(res, { created, skipped, errors });
  } catch (e) { serverError(res, e); }
}

export async function deleteHistoricalStat(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().carHistoricalStat.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Historical stat not found"); return; }
    await db().carHistoricalStat.delete({ where: { id: existing.id } });
    bustCache(req.organizationId!, "/api/cars");
    ok(res, null, "Deleted");
  } catch (e) { serverError(res, e); }
}

export async function getCarsStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() + 30); cutoff30.setHours(23, 59, 59, 999);

    const [totalLeads, byStatus, totalVehicles, inStock, sold, allVehiclesWithLatestPolicy] = await Promise.all([
      db().carLead.count({ where: { organizationId: orgId } }),
      db().carLead.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: true }),
      db().vehicle.count({ where: { organizationId: orgId } }),
      db().vehicle.count({ where: { organizationId: orgId, status: "IN_STOCK" } }),
      db().vehicle.count({ where: { organizationId: orgId, status: "SOLD" } }),
      db().vehicle.findMany({
        where: { organizationId: orgId },
        include: { insurances: { orderBy: { endDate: "desc" }, take: 1 } },
      }),
    ]);

    const expiringSoon = allVehiclesWithLatestPolicy.filter(
      (v: any) => v.insurances[0] && new Date(v.insurances[0].endDate) <= cutoff30
    ).length;

    ok(res, { totalLeads, byStatus, totalVehicles, inStock, sold, expiringSoon });
  } catch (e) { serverError(res, e); }
}
