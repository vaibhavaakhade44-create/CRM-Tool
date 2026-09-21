import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, serverError } from "../utils/response";
import { z } from "zod";

const entrySchema = z.object({
  type:          z.enum(["TDS", "TCS"]).default("TDS"),
  partyId:       z.string().optional(),
  invoiceId:     z.string().optional(),
  section:       z.string().min(1),
  description:   z.string().optional(),
  baseAmount:    z.number().positive(),
  tdsRate:       z.number().min(0),
  paymentDate:   z.string().optional(),
  challanNumber: z.string().optional(),
  isDeposited:   z.boolean().optional().default(false),
  depositedAt:   z.string().optional(),
  notes:         z.string().optional(),
});

// ── GET /api/tds  (with ?type=TDS/TCS, ?isDeposited=true/false) ──
export async function listTDS(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { type, isDeposited, partyId, page = "1", limit = "100" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (type) where.type = type;
    if (isDeposited !== undefined) where.isDeposited = isDeposited === "true";
    if (partyId) where.partyId = partyId;

    const [entries, total] = await Promise.all([
      (prisma as any).tDSEntry.findMany({
        where, skip, take: parseInt(limit),
        include: { party: { select: { id: true, name: true } } },
        orderBy: { paymentDate: "desc" },
      }),
      (prisma as any).tDSEntry.count({ where }),
    ]);

    ok(res, { entries, total });
  } catch (e) { serverError(res, e); }
}

// ── GET /api/tds/summary ─────────────────────────────────────
export async function getTDSSummary(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const fy = req.query.fy as string;

    let dateFilter: any = {};
    if (fy) {
      const [startY] = fy.split("-").map(Number);
      dateFilter = { gte: new Date(`${startY}-04-01`), lt: new Date(`${startY + 1}-04-01`) };
    }

    const where: any = { organizationId: orgId };
    if (dateFilter.gte) where.paymentDate = dateFilter;

    const all = await (prisma as any).tDSEntry.findMany({ where });

    const summary = {
      totalTDS: { entries: 0, base: 0, amount: 0, deposited: 0, pending: 0 },
      totalTCS: { entries: 0, base: 0, amount: 0, deposited: 0, pending: 0 },
      bySection: {} as Record<string, { base: number; amount: number; count: number }>,
    };

    for (const e of all) {
      const t = e.type === "TDS" ? summary.totalTDS : summary.totalTCS;
      t.entries++;
      t.base += e.baseAmount;
      t.amount += e.tdsAmount;
      if (e.isDeposited) t.deposited += e.tdsAmount;
      else t.pending += e.tdsAmount;

      if (!summary.bySection[e.section]) summary.bySection[e.section] = { base: 0, amount: 0, count: 0 };
      summary.bySection[e.section].base += e.baseAmount;
      summary.bySection[e.section].amount += e.tdsAmount;
      summary.bySection[e.section].count++;
    }

    ok(res, summary);
  } catch (e) { serverError(res, e); }
}

// ── POST /api/tds ─────────────────────────────────────────────
export async function createTDS(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = entrySchema.parse(req.body);
    const tdsAmount = (data.baseAmount * data.tdsRate) / 100;

    const entry = await (prisma as any).tDSEntry.create({
      data: {
        organizationId: req.organizationId!,
        type: data.type,
        partyId: data.partyId,
        invoiceId: data.invoiceId,
        section: data.section,
        description: data.description,
        baseAmount: data.baseAmount,
        tdsRate: data.tdsRate,
        tdsAmount,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
        challanNumber: data.challanNumber,
        isDeposited: data.isDeposited,
        depositedAt: data.depositedAt ? new Date(data.depositedAt) : undefined,
        notes: data.notes,
        createdById: req.userId,
      },
      include: { party: { select: { id: true, name: true } } },
    });
    created(res, entry);
  } catch (e) { serverError(res, e); }
}

// ── PATCH /api/tds/:id ───────────────────────────────────────
export async function updateTDS(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const existing = await (prisma as any).tDSEntry.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "TDS entry not found"); return; }

    const data = entrySchema.partial().parse(req.body);
    const tdsAmount = data.baseAmount !== undefined && data.tdsRate !== undefined
      ? (data.baseAmount * data.tdsRate) / 100
      : data.baseAmount !== undefined
        ? (data.baseAmount * existing.tdsRate) / 100
        : undefined;

    const updated = await (prisma as any).tDSEntry.update({
      where: { id },
      data: { ...data, ...(tdsAmount !== undefined ? { tdsAmount } : {}), depositedAt: data.depositedAt ? new Date(data.depositedAt) : undefined },
      include: { party: { select: { id: true, name: true } } },
    });
    ok(res, updated);
  } catch (e) { serverError(res, e); }
}

// ── DELETE /api/tds/:id ──────────────────────────────────────
export async function deleteTDS(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const existing = await (prisma as any).tDSEntry.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "TDS entry not found"); return; }
    await (prisma as any).tDSEntry.delete({ where: { id } });
    ok(res, { message: "Deleted" });
  } catch (e) { serverError(res, e); }
}
