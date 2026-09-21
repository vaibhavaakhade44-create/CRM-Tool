import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, notFound, serverError } from "../utils/response";

export async function listQuotations(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = parseInt((req.query.limit as string) || "100");

    const where: any = { organizationId: orgId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { quotationNumber: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
        { party: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const quotations = await prisma.quotation.findMany({
      where,
      include: {
        party: { select: { id: true, name: true, email: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    ok(res, { quotations });
  } catch (e) { serverError(res, e); }
}

export async function getQuotationStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const [total, accepted, sent, draft] = await Promise.all([
      prisma.quotation.count({ where: { organizationId: orgId } }),
      prisma.quotation.count({ where: { organizationId: orgId, status: "ACCEPTED" } }),
      prisma.quotation.count({ where: { organizationId: orgId, status: "SENT" } }),
      prisma.quotation.count({ where: { organizationId: orgId, status: "DRAFT" } }),
    ]);
    const acceptedValue = await prisma.quotation.aggregate({
      where: { organizationId: orgId, status: "ACCEPTED" },
      _sum: { total: true },
    });
    ok(res, { total, accepted, sent, draft, acceptedValue: acceptedValue._sum.total || 0 });
  } catch (e) { serverError(res, e); }
}

export async function getQuotation(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const orgId = req.organizationId!;
    const q = await prisma.quotation.findFirst({
      where: { id, organizationId: orgId },
      include: {
        party: true,
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });
    if (!q) { res.status(404).json({ success: false, message: "Not found" }); return; }
    ok(res, q);
  } catch (e) { serverError(res, e); }
}

export async function createQuotation(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { partyId, subject, validUntil, notes, terms, items } = req.body;

    const count = await prisma.quotation.count({ where: { organizationId: orgId } });
    const quotationNumber = `QT-${String(count + 1).padStart(4, "0")}`;

    const lineItems: any[] = (items || []).map((item: any) => {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unitPrice) || 0;
      const tax = parseFloat(item.taxRate) || 0;
      const disc = parseFloat(item.discount) || 0;
      const taxAmt = (qty * price - disc) * (tax / 100);
      const total = qty * price - disc + taxAmt;
      return {
        description: item.description,
        quantity: qty,
        unitPrice: price,
        taxRate: tax,
        taxAmount: taxAmt,
        discount: disc,
        total,
        productId: item.productId || null,
      };
    });

    const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const taxAmount = lineItems.reduce((s, i) => s + i.taxAmount, 0);
    const discount = lineItems.reduce((s, i) => s + i.discount, 0);
    const total = lineItems.reduce((s, i) => s + i.total, 0);

    const quotation = await prisma.quotation.create({
      data: {
        organizationId: orgId,
        quotationNumber,
        partyId: partyId || null,
        subject: subject || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        subtotal, taxAmount, discount, total,
        notes: notes || null,
        terms: terms || null,
        createdById: (req as any).userId || null,
        items: { create: lineItems },
      },
      include: {
        party: { select: { id: true, name: true, email: true } },
        items: true,
      },
    });
    ok(res, quotation, "Quotation created");
  } catch (e) { serverError(res, e); }
}

export async function updateQuotationStatus(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.quotation.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Quotation not found"); return; }
    const { status } = req.body;
    const quotation = await prisma.quotation.update({
      where: { id },
      data: { status },
      include: { party: { select: { id: true, name: true } } },
    });
    ok(res, quotation);
  } catch (e) { serverError(res, e); }
}

export async function deleteQuotation(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.quotation.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Quotation not found"); return; }
    await prisma.quotation.delete({ where: { id } });
    ok(res, null, "Deleted");
  } catch (e) { serverError(res, e); }
}
