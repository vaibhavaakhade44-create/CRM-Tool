import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
});

const invoiceSchema = z.object({
  partyId: z.string().optional(),
  salesOrderId: z.string().optional(),
  type: z.enum(["SALES", "PURCHASE", "CREDIT_NOTE", "DEBIT_NOTE"]).default("SALES"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

const paymentSchema = z.object({
  invoiceId: z.string().optional(),
  partyId: z.string().optional(),
  method: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]).default("BANK_TRANSFER"),
  amount: z.number().positive(),
  referenceNumber: z.string().optional(),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
});

async function generateInvoiceNumber(orgId: string, type: string): Promise<string> {
  const count = await prisma.invoice.count({ where: { organizationId: orgId, type: type as never } });
  const prefix = type === "SALES" ? "INV" : type === "PURCHASE" ? "BILL" : type === "CREDIT_NOTE" ? "CN" : "DN";
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

function calcItems(items: z.infer<typeof itemSchema>[]) {
  let subtotal = 0, taxAmount = 0, discount = 0;
  const computed = items.map((item) => {
    const lineTotal = item.quantity * item.unitPrice;
    const discAmt = (lineTotal * item.discount) / 100;
    const afterDisc = lineTotal - discAmt;
    const tax = (afterDisc * item.taxRate) / 100;
    subtotal += lineTotal;
    taxAmount += tax;
    discount += discAmt;
    return { description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate, taxAmount: tax, discount: discAmt, total: afterDisc + tax };
  });
  return { computed, subtotal, taxAmount, discount };
}

export async function listInvoices(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { type, status, search, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { party: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { party: { select: { id: true, name: true } } },
        skip, take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.count({ where }),
    ]);
    ok(res, { invoices, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { serverError(res, e); }
}

export async function getInvoice(req: OrgRequest, res: Response): Promise<void> {
  try {
    const inv = await prisma.invoice.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
      include: {
        party: true,
        items: true,
        payments: { orderBy: { paymentDate: "desc" } },
      },
    });
    if (!inv) { notFound(res, "Invoice not found"); return; }
    ok(res, inv);
  } catch (e) { serverError(res, e); }
}

export async function createInvoice(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = invoiceSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const invoiceNumber = await generateInvoiceNumber(req.organizationId!, data.data.type);
    const { computed, subtotal, taxAmount, discount } = calcItems(data.data.items);
    const total = subtotal - discount + taxAmount;

    const inv = await prisma.invoice.create({
      data: {
        organizationId: req.organizationId!,
        partyId: data.data.partyId,
        salesOrderId: data.data.salesOrderId,
        type: data.data.type,
        invoiceNumber,
        invoiceDate: data.data.invoiceDate ? new Date(data.data.invoiceDate) : new Date(),
        dueDate: data.data.dueDate ? new Date(data.data.dueDate) : undefined,
        notes: data.data.notes,
        terms: data.data.terms,
        subtotal, taxAmount, discount, total, balanceDue: total,
        items: { create: computed },
      },
      include: { items: true },
    });
    created(res, inv);
  } catch (e) { serverError(res, e); }
}

export async function addPayment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = paymentSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    // Tenant-isolation: every foreign key on the payment must belong to the
    // caller's organization. Without this, an authenticated user in org A could
    // post a payment against org B's invoice ID and flip its balance/status.
    if (data.data.invoiceId) {
      const owns = await prisma.invoice.findFirst({
        where: { id: data.data.invoiceId, organizationId: req.organizationId! },
        select: { id: true },
      });
      if (!owns) { notFound(res, "Invoice not found"); return; }
    }
    if (data.data.partyId) {
      const owns = await prisma.party.findFirst({
        where: { id: data.data.partyId, organizationId: req.organizationId! },
        select: { id: true },
      });
      if (!owns) { notFound(res, "Party not found"); return; }
    }

    const payment = await prisma.payment.create({
      data: {
        organizationId: req.organizationId!,
        invoiceId: data.data.invoiceId,
        partyId: data.data.partyId,
        method: data.data.method,
        amount: data.data.amount,
        referenceNumber: data.data.referenceNumber,
        paymentDate: data.data.paymentDate ? new Date(data.data.paymentDate) : new Date(),
        notes: data.data.notes,
      },
    });

    if (data.data.invoiceId) {
      const inv = await prisma.invoice.findFirst({
        where: { id: data.data.invoiceId, organizationId: req.organizationId! },
      });
      if (inv) {
        const paidAmount = inv.paidAmount + data.data.amount;
        const balanceDue = Math.max(0, inv.total - paidAmount);
        const status = balanceDue === 0 ? "PAID" : "PARTIAL";
        await prisma.invoice.update({
          where: { id: data.data.invoiceId },
          data: { paidAmount, balanceDue, status },
        });
      }
    }

    created(res, payment);
  } catch (e) { serverError(res, e); }
}

export async function listPayments(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { organizationId: req.organizationId! };
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          invoice: { select: { invoiceNumber: true } },
          party: { select: { id: true, name: true } },
        },
        skip, take: parseInt(limit),
        orderBy: { paymentDate: "desc" },
      }),
      prisma.payment.count({ where }),
    ]);
    ok(res, { payments, total });
  } catch (e) { serverError(res, e); }
}

export async function getFinanceSummary(req: OrgRequest, res: Response): Promise<void> {
  try {
    const [totalReceivable, totalPayable, paidInvoices, overdueInvoices] = await Promise.all([
      prisma.invoice.aggregate({
        where: { organizationId: req.organizationId!, type: "SALES", status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
        _sum: { balanceDue: true },
      }),
      prisma.invoice.aggregate({
        where: { organizationId: req.organizationId!, type: "PURCHASE", status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
        _sum: { balanceDue: true },
      }),
      prisma.invoice.count({
        where: { organizationId: req.organizationId!, status: "PAID" },
      }),
      prisma.invoice.count({
        where: { organizationId: req.organizationId!, status: "OVERDUE" },
      }),
    ]);
    ok(res, {
      totalReceivable: totalReceivable._sum.balanceDue || 0,
      totalPayable: totalPayable._sum.balanceDue || 0,
      paidInvoices,
      overdueInvoices,
    });
  } catch (e) { serverError(res, e); }
}

// ── Recurring Invoices ───────────────────────────────────────

const recurringSchema = z.object({
  partyId: z.string().optional(),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]).default("MONTHLY"),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  nextRunDate: z.string(),
  subject: z.string().optional(),
  items: z.array(itemSchema),
  subtotal: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  total: z.number().min(0).default(0),
  notes: z.string().optional(),
  autoSend: z.boolean().default(false),
});

export async function listRecurringInvoices(req: OrgRequest, res: Response): Promise<void> {
  try {
    const list = await prisma.recurringInvoice.findMany({
      where: { organizationId: req.organizationId! },
      include: { party: { select: { id: true, name: true } } },
      orderBy: { nextRunDate: "asc" },
    });
    ok(res, { items: list });
  } catch (e) { serverError(res, e); }
}

export async function createRecurringInvoice(req: OrgRequest, res: Response): Promise<void> {
  try {
    const parsed = recurringSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Invalid data", parsed.error.flatten()); return; }
    const d = parsed.data;
    const item = await prisma.recurringInvoice.create({
      data: {
        organizationId: req.organizationId!,
        partyId: d.partyId || null,
        frequency: d.frequency,
        dayOfMonth: d.dayOfMonth,
        nextRunDate: new Date(d.nextRunDate),
        subject: d.subject || null,
        items: d.items,
        subtotal: d.subtotal,
        taxAmount: d.taxAmount,
        total: d.total,
        notes: d.notes || null,
        autoSend: d.autoSend,
      },
      include: { party: { select: { id: true, name: true } } },
    });
    created(res, item);
  } catch (e) { serverError(res, e); }
}

export async function updateRecurringInvoice(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.recurringInvoice.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Recurring invoice not found"); return; }
    const updated = await prisma.recurringInvoice.update({
      where: { id },
      data: {
        isActive: req.body.isActive !== undefined ? req.body.isActive : existing.isActive,
        ...(req.body.nextRunDate && { nextRunDate: new Date(req.body.nextRunDate) }),
        ...(req.body.frequency && { frequency: req.body.frequency }),
        ...(req.body.autoSend !== undefined && { autoSend: req.body.autoSend }),
      },
      include: { party: { select: { id: true, name: true } } },
    });
    ok(res, updated);
  } catch (e) { serverError(res, e); }
}

export async function deleteRecurringInvoice(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.recurringInvoice.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Recurring invoice not found"); return; }
    await prisma.recurringInvoice.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (e) { serverError(res, e); }
}

export async function updateInvoice(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.invoice.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Invoice not found"); return; }
    const { status, dueDate, notes, terms } = req.body as Record<string, string>;
    const inv = await prisma.invoice.update({
      where: { id },
      data: {
        ...(status   ? { status: status as never }        : {}),
        ...(dueDate  ? { dueDate: new Date(dueDate) }     : {}),
        ...(notes    ? { notes }                          : {}),
        ...(terms    ? { terms }                          : {}),
      },
      include: { items: true, payments: true },
    });
    ok(res, inv);
  } catch (e) { serverError(res, e); }
}

export async function deleteInvoice(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.invoice.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Invoice not found"); return; }
    await prisma.invoice.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (e) { serverError(res, e); }
}

export async function deletePayment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const payment = await prisma.payment.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!payment) { notFound(res, "Payment not found"); return; }
    await prisma.payment.delete({ where: { id } });
    // Reverse the balance on the linked invoice if any
    if (payment.invoiceId) {
      const inv = await prisma.invoice.findUnique({ where: { id: payment.invoiceId } });
      if (inv) {
        const paidAmount = Math.max(0, inv.paidAmount - payment.amount);
        const balanceDue = Math.max(0, inv.total - paidAmount);
        const status = paidAmount === 0 ? "UNPAID" : "PARTIAL";
        await prisma.invoice.update({ where: { id: payment.invoiceId }, data: { paidAmount, balanceDue, status: status as never } });
      }
    }
    ok(res, { deleted: true });
  } catch (e) { serverError(res, e); }
}

