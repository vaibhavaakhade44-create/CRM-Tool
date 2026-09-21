import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";

const db = () => (prisma as any);

// ── List bank transactions ────────────────────────────────────
export async function listTransactions(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { status, from, to, account } = req.query as Record<string, string>;

    const txns = await db().bankTransaction.findMany({
      where: {
        organizationId: orgId,
        ...(status && status !== "ALL" && { reconcileStatus: status }),
        ...(account && { accountName: { contains: account, mode: "insensitive" } }),
        ...(from || to ? { txnDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      },
      orderBy: { txnDate: "desc" },
      take: 200,
    });

    // Stats
    const stats = {
      total: txns.length,
      unmatched: txns.filter((t: any) => t.reconcileStatus === "UNMATCHED").length,
      matched: txns.filter((t: any) => t.reconcileStatus === "MATCHED").length,
      ignored: txns.filter((t: any) => t.reconcileStatus === "IGNORED").length,
      creditTotal: txns.filter((t: any) => t.type === "CREDIT").reduce((s: number, t: any) => s + t.amount, 0),
      debitTotal:  txns.filter((t: any) => t.type === "DEBIT").reduce((s: number, t: any) => s + t.amount, 0),
    };

    ok(res, { transactions: txns, stats });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Import transactions from CSV rows (parsed by frontend) ────
export async function importTransactions(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { accountName, rows } = req.body as {
      accountName: string;
      rows: { txnDate: string; description: string; amount: number; type: "CREDIT" | "DEBIT"; reference?: string }[];
    };

    if (!accountName || !rows?.length) {
      badRequest(res, "accountName and rows[] required");
      return;
    }

    const created = await db().bankTransaction.createMany({
      data: rows.map(r => ({
        organizationId: orgId,
        accountName,
        txnDate: new Date(r.txnDate),
        description: r.description,
        amount: Number(r.amount),
        type: r.type,
        reference: r.reference ?? null,
        reconcileStatus: "UNMATCHED",
      })),
    });

    ok(res, { imported: created.count });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Auto-match: find invoices/payments with matching amounts ──
export async function autoMatch(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;

    const unmatched = await db().bankTransaction.findMany({
      where: { organizationId: orgId, reconcileStatus: "UNMATCHED" },
    });

    let matched = 0;
    for (const txn of unmatched) {
      if (txn.type === "CREDIT") {
        // Match against invoice payments
        const payment = await prisma.payment.findFirst({
          where: {
            organizationId: orgId,
            amount: { gte: txn.amount - 1, lte: txn.amount + 1 },
            paidAt: { gte: new Date(txn.txnDate.getTime() - 2 * 86400000), lte: new Date(txn.txnDate.getTime() + 2 * 86400000) },
          },
        });
        if (payment) {
          await db().bankTransaction.update({
            where: { id: txn.id },
            data: { reconcileStatus: "MATCHED", matchedPaymentId: payment.id },
          });
          matched++;
          continue;
        }
      }

      if (txn.type === "DEBIT") {
        // Match against purchase invoices
        const invoice = await prisma.invoice.findFirst({
          where: {
            organizationId: orgId,
            type: "PURCHASE",
            total: { gte: txn.amount - 1, lte: txn.amount + 1 },
            invoiceDate: { gte: new Date(txn.txnDate.getTime() - 3 * 86400000), lte: new Date(txn.txnDate.getTime() + 3 * 86400000) },
          },
        });
        if (invoice) {
          await db().bankTransaction.update({
            where: { id: txn.id },
            data: { reconcileStatus: "MATCHED", matchedInvoiceId: invoice.id },
          });
          matched++;
        }
      }
    }

    ok(res, { matched, total: unmatched.length });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Manual match / ignore / unmatch ──────────────────────────
export async function updateTransactionStatus(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = String(req.params.id);
    const { reconcileStatus, matchedInvoiceId, matchedPaymentId, notes } = req.body as {
      reconcileStatus: string;
      matchedInvoiceId?: string;
      matchedPaymentId?: string;
      notes?: string;
    };

    const txn = await db().bankTransaction.findFirst({ where: { id, organizationId: orgId } });
    if (!txn) { notFound(res, "Transaction not found"); return; }

    const valid = ["UNMATCHED", "MATCHED", "IGNORED"];
    if (!valid.includes(reconcileStatus)) { badRequest(res, "Invalid status"); return; }

    const updated = await db().bankTransaction.update({
      where: { id },
      data: {
        reconcileStatus,
        ...(matchedInvoiceId !== undefined && { matchedInvoiceId: matchedInvoiceId || null }),
        ...(matchedPaymentId !== undefined && { matchedPaymentId: matchedPaymentId || null }),
        ...(notes !== undefined && { notes }),
      },
    });

    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Delete a transaction ──────────────────────────────────────
export async function deleteTransaction(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = String(req.params.id);

    const txn = await db().bankTransaction.findFirst({ where: { id, organizationId: orgId } });
    if (!txn) { notFound(res, "Transaction not found"); return; }

    await db().bankTransaction.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (err) {
    serverError(res, err);
  }
}
