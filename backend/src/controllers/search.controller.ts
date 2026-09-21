import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, serverError } from "../utils/response";

export async function globalSearch(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) { ok(res, { parties: [], leads: [], deals: [], invoices: [], products: [], patients: [] }); return; }

    const mode = "insensitive" as const;
    const take = 5;

    const [parties, leads, deals, invoices, products, patients] = await Promise.all([
      prisma.party.findMany({
        where: {
          organizationId: orgId, isActive: true,
          OR: [{ name: { contains: q, mode } }, { email: { contains: q, mode } }, { phone: { contains: q, mode } }, { gstin: { contains: q, mode } }],
        },
        select: { id: true, name: true, type: true, email: true, phone: true },
        take,
      }),
      prisma.lead.findMany({
        where: {
          organizationId: orgId,
          OR: [{ name: { contains: q, mode } }, { company: { contains: q, mode } }, { email: { contains: q, mode } }],
        },
        select: { id: true, name: true, company: true, status: true, value: true },
        take,
      }),
      prisma.deal.findMany({
        where: {
          organizationId: orgId,
          OR: [{ title: { contains: q, mode } }, { description: { contains: q, mode } }],
        },
        select: { id: true, title: true, stage: true, value: true, party: { select: { name: true } } },
        take,
      }),
      prisma.invoice.findMany({
        where: {
          organizationId: orgId,
          OR: [{ invoiceNumber: { contains: q, mode } }, { party: { name: { contains: q, mode } } }],
        },
        select: { id: true, invoiceNumber: true, status: true, total: true, party: { select: { name: true } } },
        take,
      }),
      prisma.product.findMany({
        where: {
          organizationId: orgId,
          OR: [{ name: { contains: q, mode } }, { sku: { contains: q, mode } }],
        },
        select: { id: true, name: true, sku: true, currentStock: true, sellingPrice: true },
        take,
      }),
      (prisma as any).patient.findMany({
        where: {
          organizationId: orgId, isActive: true,
          OR: [{ name: { contains: q, mode } }, { phone: { contains: q, mode } }, { patientCode: { contains: q, mode } }],
        },
        select: { id: true, name: true, patientCode: true, phone: true },
        take,
      }),
    ]);

    ok(res, { parties, leads, deals, invoices, products, patients });
  } catch (e) { serverError(res, e); }
}
