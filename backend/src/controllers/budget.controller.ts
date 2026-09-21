import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";

// ── List budgets ──────────────────────────────────────────────
export async function listBudgets(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { fy } = req.query as { fy?: string };

    const budgets = await (prisma as any).budget.findMany({
      where: {
        organizationId: orgId,
        ...(fy && { fiscalYear: fy }),
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    // Annotate with computed actuals from invoices (expenses)
    const enriched = await Promise.all(
      budgets.map(async (b: any) => {
        const actualSpend = await prisma.invoice.aggregate({
          where: {
            organizationId: orgId,
            type: "PURCHASE",
            invoiceDate: { gte: b.startDate, lte: b.endDate },
            status: { not: "CANCELLED" },
          },
          _sum: { total: true },
        });
        return {
          ...b,
          actualSpend: actualSpend._sum.total ?? 0,
          utilisation: b.totalBudget > 0
            ? Math.round(((actualSpend._sum.total ?? 0) / b.totalBudget) * 100)
            : 0,
        };
      })
    );

    ok(res, { budgets: enriched });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Create budget ─────────────────────────────────────────────
export async function createBudget(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { name, department, fiscalYear, startDate, endDate, totalBudget, notes, items } =
      req.body as {
        name: string;
        department?: string;
        fiscalYear: string;
        startDate: string;
        endDate: string;
        totalBudget: number;
        notes?: string;
        items?: { category: string; allocatedAmount: number; notes?: string }[];
      };

    if (!name || !fiscalYear || !startDate || !endDate) {
      badRequest(res, "name, fiscalYear, startDate and endDate are required");
      return;
    }

    const budget = await (prisma as any).budget.create({
      data: {
        organizationId: orgId,
        name,
        department: department ?? null,
        fiscalYear,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalBudget: totalBudget ?? 0,
        notes: notes ?? null,
        createdById: req.userId ?? null,
        items: items?.length
          ? { create: items.map(it => ({ category: it.category, allocatedAmount: it.allocatedAmount, notes: it.notes ?? null })) }
          : undefined,
      },
      include: { items: true },
    });

    created(res, budget);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Update budget ─────────────────────────────────────────────
export async function updateBudget(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = String(req.params.id);

    const existing = await (prisma as any).budget.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Budget not found"); return; }

    const { name, department, fiscalYear, startDate, endDate, totalBudget, notes } = req.body;

    const updated = await (prisma as any).budget.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(department !== undefined && { department }),
        ...(fiscalYear && { fiscalYear }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(totalBudget !== undefined && { totalBudget }),
        ...(notes !== undefined && { notes }),
      },
      include: { items: true },
    });

    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Delete budget ─────────────────────────────────────────────
export async function deleteBudget(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = String(req.params.id);

    const existing = await (prisma as any).budget.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Budget not found"); return; }

    await (prisma as any).budget.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Update a budget line item's spent amount ──────────────────
export async function updateBudgetItem(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const itemId = String(req.params.itemId);
    const { spentAmount, allocatedAmount, notes } = req.body;

    // Verify item belongs to this org via its budget
    const item = await (prisma as any).budgetItem.findFirst({
      where: { id: itemId },
      include: { budget: { select: { organizationId: true } } },
    });
    if (!item || item.budget.organizationId !== orgId) { notFound(res, "Budget item not found"); return; }

    const updated = await (prisma as any).budgetItem.update({
      where: { id: itemId },
      data: {
        ...(spentAmount !== undefined && { spentAmount }),
        ...(allocatedAmount !== undefined && { allocatedAmount }),
        ...(notes !== undefined && { notes }),
      },
    });

    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Summary: total allocated vs spent per department this FY ──
export async function getBudgetSummary(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { fy } = req.query as { fy?: string };

    const now = new Date();
    const defaultFY = now.getMonth() >= 3
      ? `${now.getFullYear()}-${now.getFullYear() + 1}`
      : `${now.getFullYear() - 1}-${now.getFullYear()}`;

    const budgets = await (prisma as any).budget.findMany({
      where: { organizationId: orgId, fiscalYear: fy ?? defaultFY },
      include: { items: true },
    });

    const totalAllocated = budgets.reduce((s: number, b: any) => s + (b.totalBudget ?? 0), 0);
    const totalItemSpent = budgets.flatMap((b: any) => b.items).reduce((s: number, i: any) => s + (i.spentAmount ?? 0), 0);

    // Actual from invoices for this FY period
    const fyStart = fy ? new Date(`${fy.split("-")[0]}-04-01`) : new Date(`${now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1}-04-01`);
    const fyEnd   = new Date(fyStart.getFullYear() + 1, 3, 1);

    const actualInvoices = await prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        type: "PURCHASE",
        invoiceDate: { gte: fyStart, lt: fyEnd },
        status: { not: "CANCELLED" },
      },
      _sum: { total: true },
    });

    ok(res, {
      fiscalYear: fy ?? defaultFY,
      budgets: budgets.length,
      totalAllocated,
      totalItemSpent,
      actualInvoiceSpend: actualInvoices._sum.total ?? 0,
    });
  } catch (err) {
    serverError(res, err);
  }
}
