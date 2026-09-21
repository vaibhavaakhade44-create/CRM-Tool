import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, notFound, serverError } from "../utils/response";
import { createNotification } from "./notifications.controller";
import { z } from "zod";

const actionSchema = z.object({ note: z.string().optional() });

// ── GET /api/approvals/pending ────────────────────────────────
export async function getPendingApprovals(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;

    const [purchaseOrders, expenses] = await Promise.all([
      (prisma.purchaseOrder as any).findMany({
        where: { organizationId: orgId, approvalStatus: "PENDING_APPROVAL" },
        include: { party: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.expense.findMany({
        where: { organizationId: orgId, status: "PENDING" },
        include: { employee: { select: { id: true, name: true, designation: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    ok(res, { purchaseOrders, expenses });
  } catch (e) {
    serverError(res, e);
  }
}

// ── POST /api/approvals/po/:id/approve ───────────────────────
export async function approvePO(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const orgId = req.organizationId!;
    const { note } = actionSchema.parse(req.body);

    const po = await (prisma.purchaseOrder as any).findFirst({ where: { id, organizationId: orgId } });
    if (!po) { notFound(res, "Purchase order not found"); return; }

    const updated = await (prisma.purchaseOrder as any).update({
      where: { id },
      data: {
        approvalStatus: "APPROVED",
        approvedById: req.userId,
        approvalNote: note,
        approvedAt: new Date(),
        status: "SENT",
      },
    });

    await createNotification({
      organizationId: orgId,
      type: "APPROVAL_APPROVED",
      title: `PO ${po.poNumber} approved`,
      message: note ? `Approved with note: ${note}` : "Purchase order has been approved",
      link: "/purchase",
    });

    ok(res, updated);
  } catch (e) {
    serverError(res, e);
  }
}

// ── POST /api/approvals/po/:id/reject ────────────────────────
export async function rejectPO(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const orgId = req.organizationId!;
    const { note } = actionSchema.parse(req.body);

    const po = await (prisma.purchaseOrder as any).findFirst({ where: { id, organizationId: orgId } });
    if (!po) { notFound(res, "Purchase order not found"); return; }

    const updated = await (prisma.purchaseOrder as any).update({
      where: { id },
      data: {
        approvalStatus: "REJECTED",
        approvedById: req.userId,
        approvalNote: note,
        approvedAt: new Date(),
      },
    });

    await createNotification({
      organizationId: orgId,
      type: "APPROVAL_REJECTED",
      title: `PO ${po.poNumber} rejected`,
      message: note ? `Rejected: ${note}` : "Purchase order has been rejected",
      link: "/purchase",
    });

    ok(res, updated);
  } catch (e) {
    serverError(res, e);
  }
}

// ── POST /api/approvals/expense/:id/approve ──────────────────
export async function approveExpense(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const orgId = req.organizationId!;
    const { note } = actionSchema.parse(req.body);

    const expense = await prisma.expense.findFirst({ where: { id, organizationId: orgId } });
    if (!expense) { notFound(res, "Expense not found"); return; }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: req.userId,
        approvedAt: new Date(),
        notes: note ? `${expense.notes ? expense.notes + "\n" : ""}Approval note: ${note}` : expense.notes,
      },
    });

    ok(res, updated);
  } catch (e) {
    serverError(res, e);
  }
}

// ── POST /api/approvals/expense/:id/reject ───────────────────
export async function rejectExpense(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const orgId = req.organizationId!;
    const { note } = actionSchema.parse(req.body);

    const expense = await prisma.expense.findFirst({ where: { id, organizationId: orgId } });
    if (!expense) { notFound(res, "Expense not found"); return; }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        status: "REJECTED",
        notes: note ? `${expense.notes ? expense.notes + "\n" : ""}Rejection note: ${note}` : expense.notes,
      },
    });

    ok(res, updated);
  } catch (e) {
    serverError(res, e);
  }
}
