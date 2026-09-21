import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const docSchema = z.object({
  partyId: z.string().optional(),
  type: z.enum(["BILL_OF_LADING", "LETTER_OF_CREDIT", "COMMERCIAL_INVOICE", "PACKING_LIST", "CERTIFICATE_OF_ORIGIN", "INSURANCE_CERTIFICATE", "SHIPPING_BILL", "BILL_OF_ENTRY", "OTHER"]).default("OTHER"),
  documentNumber: z.string().min(1),
  documentDate: z.string().optional(),
  expiryDate: z.string().optional(),
  country: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  vessel: z.string().optional(),
  flightNumber: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().default("USD"),
  description: z.string().optional(),
  fileUrl: z.string().optional(),
  notes: z.string().optional(),
});

export async function listTradeDocuments(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { type, status, search, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { documentNumber: { contains: search, mode: "insensitive" } },
        { vessel: { contains: search, mode: "insensitive" } },
        { portOfLoading: { contains: search, mode: "insensitive" } },
        { portOfDischarge: { contains: search, mode: "insensitive" } },
      ];
    }
    const [docs, total] = await Promise.all([
      prisma.tradeDocument.findMany({
        where, skip, take: parseInt(limit),
        include: { party: { select: { id: true, name: true } } },
        orderBy: { documentDate: "desc" },
      }),
      prisma.tradeDocument.count({ where }),
    ]);
    ok(res, { docs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { serverError(res, e); }
}

export async function getTradeDocument(req: OrgRequest, res: Response): Promise<void> {
  try {
    const doc = await prisma.tradeDocument.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
      include: { party: true },
    });
    if (!doc) { notFound(res, "Document not found"); return; }
    ok(res, doc);
  } catch (e) { serverError(res, e); }
}

export async function createTradeDocument(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = docSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const existing = await prisma.tradeDocument.findUnique({
      where: { organizationId_documentNumber: { organizationId: req.organizationId!, documentNumber: data.data.documentNumber } },
    });
    if (existing) { badRequest(res, "Document number already exists"); return; }

    const doc = await prisma.tradeDocument.create({
      data: {
        ...data.data,
        organizationId: req.organizationId!,
        documentDate: data.data.documentDate ? new Date(data.data.documentDate) : new Date(),
        expiryDate: data.data.expiryDate ? new Date(data.data.expiryDate) : undefined,
      },
    });
    created(res, doc);
  } catch (e) { serverError(res, e); }
}

export async function updateTradeDocument(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = docSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const existing = await prisma.tradeDocument.findFirst({ where: { id: (req.params.id as string), organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Document not found"); return; }
    const doc = await prisma.tradeDocument.update({
      where: { id: (req.params.id as string) },
      data: {
        ...data.data,
        ...(data.data.documentDate && { documentDate: new Date(data.data.documentDate) }),
        ...(data.data.expiryDate && { expiryDate: new Date(data.data.expiryDate) }),
      },
    });
    ok(res, doc);
  } catch (e) { serverError(res, e); }
}

export async function updateDocumentStatus(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    const doc = await prisma.tradeDocument.findFirst({ where: { id: (req.params.id as string), organizationId: req.organizationId! } });
    if (!doc) { notFound(res, "Document not found"); return; }
    const updated = await prisma.tradeDocument.update({ where: { id: (req.params.id as string) }, data: { status } });
    ok(res, updated);
  } catch (e) { serverError(res, e); }
}

export async function deleteTradeDocument(req: OrgRequest, res: Response): Promise<void> {
  try {
    const doc = await prisma.tradeDocument.findFirst({ where: { id: (req.params.id as string), organizationId: req.organizationId! } });
    if (!doc) { notFound(res, "Document not found"); return; }
    await prisma.tradeDocument.delete({ where: { id: (req.params.id as string) } });
    ok(res, null, "Deleted");
  } catch (e) { serverError(res, e); }
}

export async function getTradeSummary(req: OrgRequest, res: Response): Promise<void> {
  try {
    const [total, byType, expiringSoon] = await Promise.all([
      prisma.tradeDocument.count({ where: { organizationId: req.organizationId! } }),
      prisma.tradeDocument.groupBy({ by: ["type"], where: { organizationId: req.organizationId! }, _count: true }),
      prisma.tradeDocument.count({
        where: {
          organizationId: req.organizationId!,
          expiryDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) },
        },
      }),
    ]);
    ok(res, { total, byType, expiringSoon });
  } catch (e) { serverError(res, e); }
}

