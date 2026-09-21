import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const collectionSchema = z.object({
  name: z.string().min(1),
  season: z.string().optional(),
  year: z.number().int().optional(),
  description: z.string().optional(),
});

const variantSchema = z.object({
  productId: z.string(),
  collectionId: z.string().optional(),
  sku: z.string().min(1),
  size: z.string().optional(),
  color: z.string().optional(),
  material: z.string().optional(),
  costPrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  mrp: z.number().optional(),
  stock: z.number().min(0).default(0),
  barcode: z.string().optional(),
});

const posSessionSchema = z.object({
  warehouseId: z.string().optional(),
  openingCash: z.number().min(0).default(0),
});

const posSaleSchema = z.object({
  sessionId: z.string(),
  partyId: z.string().optional(),
  discount: z.number().min(0).default(0),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"]).default("CASH"),
  paidAmount: z.number().min(0),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().optional(),
    variantId: z.string().optional(),
    name: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    taxRate: z.number().min(0).default(0),
    discount: z.number().min(0).default(0),
  })).min(1),
});

// â”€â”€ Collections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listCollections(req: OrgRequest, res: Response): Promise<void> {
  try {
    const collections = await prisma.collection.findMany({
      where: { organizationId: req.organizationId!, isActive: true },
      include: { _count: { select: { variants: true } } },
      orderBy: [{ year: "desc" }, { name: "asc" }],
    });
    ok(res, collections);
  } catch (e) { serverError(res, e); }
}

export async function createCollection(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = collectionSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const col = await prisma.collection.create({ data: { ...data.data, organizationId: req.organizationId! } });
    created(res, col);
  } catch (e) { serverError(res, e); }
}

// â”€â”€ Variants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listVariants(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { productId, collectionId } = req.query as Record<string, string>;
    const where: any = {
      product: { organizationId: req.organizationId! },
      isActive: true,
    };
    if (productId) where.productId = productId;
    if (collectionId) where.collectionId = collectionId;
    const variants = await prisma.productVariant.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        collection: { select: { id: true, name: true, season: true } },
      },
      orderBy: [{ product: { name: "asc" } }, { color: "asc" }, { size: "asc" }],
    });
    ok(res, variants);
  } catch (e) { serverError(res, e); }
}

export async function createVariant(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = variantSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const product = await prisma.product.findFirst({ where: { id: data.data.productId, organizationId: req.organizationId! } });
    if (!product) { notFound(res, "Product not found"); return; }

    const variant = await prisma.productVariant.create({ data: data.data });
    created(res, variant);
  } catch (e) { serverError(res, e); }
}

export async function updateVariant(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = variantSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const existing = await prisma.productVariant.findFirst({
      where: { id: (req.params.id as string), product: { organizationId: req.organizationId! } },
    });
    if (!existing) { notFound(res, "Variant not found"); return; }
    const variant = await prisma.productVariant.update({ where: { id: (req.params.id as string) }, data: data.data });
    ok(res, variant);
  } catch (e) { serverError(res, e); }
}

// â”€â”€ POS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function openPOSSession(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = posSessionSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const session = await prisma.pOSSession.create({
      data: {
        organizationId: req.organizationId!,
        warehouseId: data.data.warehouseId,
        openingCash: data.data.openingCash,
        createdById: req.userId,
      },
    });
    created(res, session);
  } catch (e) { serverError(res, e); }
}

export async function closePOSSession(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { closingCash } = req.body;
    const session = await prisma.pOSSession.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
    });
    if (!session) { notFound(res, "Session not found"); return; }
    const updated = await prisma.pOSSession.update({
      where: { id: (req.params.id as string) },
      data: { status: "CLOSED", closedAt: new Date(), closingCash },
    });
    ok(res, updated);
  } catch (e) { serverError(res, e); }
}

export async function listPOSSessions(req: OrgRequest, res: Response): Promise<void> {
  try {
    const sessions = await prisma.pOSSession.findMany({
      where: { organizationId: req.organizationId! },
      include: { _count: { select: { sales: true } } },
      orderBy: { openedAt: "desc" },
    });
    ok(res, sessions);
  } catch (e) { serverError(res, e); }
}

export async function createPOSSale(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = posSaleSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const session = await prisma.pOSSession.findFirst({
      where: { id: data.data.sessionId, organizationId: req.organizationId!, status: "OPEN" },
    });
    if (!session) { notFound(res, "Open POS session not found"); return; }

    // Tenant-isolation: an optional linked party must belong to this org.
    if (data.data.partyId) {
      const owns = await prisma.party.findFirst({
        where: { id: data.data.partyId, organizationId: req.organizationId! },
        select: { id: true },
      });
      if (!owns) { notFound(res, "Party not found"); return; }
    }

    const count = await prisma.pOSSale.count({ where: { organizationId: req.organizationId! } });
    const receiptNumber = `RCP-${String(count + 1).padStart(6, "0")}`;

    let subtotal = 0, taxAmount = 0;
    const computedItems = data.data.items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice;
      const disc = (lineTotal * item.discount) / 100;
      const afterDisc = lineTotal - disc;
      const tax = (afterDisc * item.taxRate) / 100;
      subtotal += lineTotal;
      taxAmount += tax;
      return { ...item, taxAmount: tax, total: afterDisc + tax };
    });
    const total = subtotal - data.data.discount + taxAmount;
    const changeAmount = Math.max(0, data.data.paidAmount - total);

    const sale = await prisma.pOSSale.create({
      data: {
        organizationId: req.organizationId!,
        sessionId: data.data.sessionId,
        receiptNumber,
        partyId: data.data.partyId,
        subtotal, taxAmount, discount: data.data.discount, total,
        paidAmount: data.data.paidAmount,
        changeAmount,
        paymentMethod: data.data.paymentMethod,
        notes: data.data.notes,
        items: { create: computedItems },
      },
      include: { items: true },
    });

    await prisma.pOSSession.update({
      where: { id: data.data.sessionId },
      data: { totalSales: { increment: total } },
    });

    // Deduct stock — only for products that belong to this organization.
    for (const item of data.data.items) {
      if (item.productId) {
        const product = await prisma.product.findFirst({ where: { id: item.productId, organizationId: req.organizationId! } });
        if (product) {
          const newStock = Math.max(0, product.currentStock - item.quantity);
          await prisma.$transaction([
            prisma.stockMovement.create({
              data: {
                organizationId: req.organizationId!,
                productId: item.productId,
                type: "SALES_OUT",
                quantity: item.quantity,
                balanceAfter: newStock,
                referenceType: "POSSale",
                referenceId: sale.id,
              },
            }),
            prisma.product.update({ where: { id: item.productId }, data: { currentStock: newStock } }),
          ]);
        }
      }
    }

    created(res, sale);
  } catch (e) { serverError(res, e); }
}

export async function listPOSSales(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { sessionId, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (sessionId) where.sessionId = sessionId;
    const [sales, total] = await Promise.all([
      prisma.pOSSale.findMany({
        where, skip, take: parseInt(limit),
        include: { party: { select: { id: true, name: true } }, _count: { select: { items: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.pOSSale.count({ where }),
    ]);
    ok(res, { sales, total });
  } catch (e) { serverError(res, e); }
}

