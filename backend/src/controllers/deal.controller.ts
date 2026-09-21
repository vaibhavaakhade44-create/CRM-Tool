import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, notFound, serverError } from "../utils/response";

const STAGE_PROBABILITY: Record<string, number> = {
  PROSPECTING: 10, QUALIFICATION: 20, NEEDS_ANALYSIS: 40,
  PROPOSAL: 60, NEGOTIATION: 80, CLOSED_WON: 100, CLOSED_LOST: 0,
};

export async function listDeals(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const stage = req.query.stage as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = parseInt((req.query.limit as string) || "200");

    const where: any = { organizationId: orgId };
    if (stage) where.stage = stage;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { party: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const deals = await prisma.deal.findMany({
      where,
      include: { party: { select: { id: true, name: true } } },
      orderBy: [{ stage: "asc" }, { createdAt: "desc" }],
      take: limit,
    });
    ok(res, { deals });
  } catch (e) { serverError(res, e); }
}

export async function getDealStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const [total, won, lost, byStage] = await Promise.all([
      prisma.deal.count({ where: { organizationId: orgId } }),
      prisma.deal.count({ where: { organizationId: orgId, stage: "CLOSED_WON" } }),
      prisma.deal.count({ where: { organizationId: orgId, stage: "CLOSED_LOST" } }),
      prisma.deal.groupBy({
        by: ["stage"],
        where: { organizationId: orgId },
        _count: true,
        _sum: { value: true },
      }),
    ]);

    const pipeline = await prisma.deal.aggregate({
      where: { organizationId: orgId, stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
      _sum: { value: true },
    });

    const wonValue = await prisma.deal.aggregate({
      where: { organizationId: orgId, stage: "CLOSED_WON" },
      _sum: { value: true },
    });

    const forecast = await prisma.deal.findMany({
      where: { organizationId: orgId, stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
      select: { value: true, probability: true },
    });
    const forecastValue = forecast.reduce((s, d) => s + (d.value || 0) * (d.probability / 100), 0);

    ok(res, {
      total, won, lost,
      openDeals: total - won - lost,
      pipeline: pipeline._sum.value || 0,
      wonValue: wonValue._sum.value || 0,
      forecastValue,
      byStage: byStage.map(s => ({ stage: s.stage, count: s._count, value: s._sum.value || 0 })),
    });
  } catch (e) { serverError(res, e); }
}

export async function createDeal(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { title, partyId, leadId, stage, value, probability, expectedCloseDate, description, notes } = req.body;

    const deal = await prisma.deal.create({
      data: {
        organizationId: orgId,
        title,
        partyId: partyId || null,
        leadId: leadId || null,
        stage: stage || "PROSPECTING",
        value: value ? parseFloat(value) : null,
        probability: probability ?? STAGE_PROBABILITY[stage || "PROSPECTING"] ?? 20,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        description: description || null,
        notes: notes || null,
        createdById: (req as any).userId || null,
      },
      include: { party: { select: { id: true, name: true } } },
    });
    ok(res, deal, "Deal created");
  } catch (e) { serverError(res, e); }
}

export async function updateDeal(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.deal.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Deal not found"); return; }
    const { title, stage, value, probability, expectedCloseDate, description, notes, partyId } = req.body;

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (stage !== undefined) {
      data.stage = stage;
      data.probability = STAGE_PROBABILITY[stage] ?? probability ?? 20;
      if (stage === "CLOSED_WON" || stage === "CLOSED_LOST") data.closedAt = new Date();
    }
    if (value !== undefined) data.value = value ? parseFloat(value) : null;
    if (probability !== undefined) data.probability = probability;
    if (expectedCloseDate !== undefined) data.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
    if (description !== undefined) data.description = description || null;
    if (notes !== undefined) data.notes = notes || null;
    if (partyId !== undefined) data.partyId = partyId || null;

    const deal = await prisma.deal.update({
      where: { id },
      data,
      include: { party: { select: { id: true, name: true } } },
    });
    ok(res, deal);
  } catch (e) { serverError(res, e); }
}

export async function deleteDeal(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.deal.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Deal not found"); return; }
    await prisma.deal.delete({ where: { id } });
    ok(res, null, "Deleted");
  } catch (e) { serverError(res, e); }
}
