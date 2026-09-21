import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const itemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).default(0),
});

const poSchema = z.object({
  partyId: z.string().optional(),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  warehouseId: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

async function generatePONumber(orgId: string): Promise<string> {
  const count = await prisma.purchaseOrder.count({ where: { organizationId: orgId } });
  return `PO-${String(count + 1).padStart(5, "0")}`;
}

function calcItems(items: z.infer<typeof itemSchema>[]) {
  let subtotal = 0, taxAmount = 0;
  const computed = items.map((item) => {
    const lineTotal = item.quantity * item.unitPrice;
    const tax = (lineTotal * item.taxRate) / 100;
    subtotal += lineTotal;
    taxAmount += tax;
    return { ...item, taxAmount: tax, total: lineTotal + tax };
  });
  return { computed, subtotal, taxAmount, total: subtotal + taxAmount };
}

export async function listPurchaseOrders(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status, search, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: "insensitive" } },
        { party: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: { party: { select: { id: true, name: true } }, _count: { select: { items: true } } },
        skip, take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);
    ok(res, { orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { serverError(res, e); }
}

export async function getPurchaseOrder(req: OrgRequest, res: Response): Promise<void> {
  try {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
      include: { party: true, items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } } },
    });
    if (!po) { notFound(res, "Purchase order not found"); return; }
    ok(res, po);
  } catch (e) { serverError(res, e); }
}

export async function createPurchaseOrder(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = poSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const poNumber = await generatePONumber(req.organizationId!);
    const { computed, subtotal, taxAmount, total } = calcItems(data.data.items);

    const po = await prisma.purchaseOrder.create({
      data: {
        organizationId: req.organizationId!,
        partyId: data.data.partyId,
        poNumber,
        orderDate: data.data.orderDate ? new Date(data.data.orderDate) : new Date(),
        expectedDate: data.data.expectedDate ? new Date(data.data.expectedDate) : undefined,
        warehouseId: data.data.warehouseId,
        notes: data.data.notes,
        subtotal, taxAmount, total,
        items: { create: computed },
      },
      include: { items: true },
    });
    created(res, po);
  } catch (e) { serverError(res, e); }
}

export async function updatePurchaseOrderStatus(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!status) { badRequest(res, "Status required"); return; }

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
      include: { items: true },
    });
    if (!po) { notFound(res, "Purchase order not found"); return; }

    const updated = await prisma.purchaseOrder.update({
      where: { id: (req.params.id as string) },
      data: { status },
    });

    // Auto-receive stock if status = RECEIVED
    if (status === "RECEIVED" && po.status !== "RECEIVED") {
      for (const item of po.items) {
        if (!item.productId) continue;
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;
        const qty = item.quantity - item.receivedQty;
        if (qty <= 0) continue;
        const newStock = product.currentStock + qty;
        await prisma.$transaction([
          prisma.stockMovement.create({
            data: {
              organizationId: req.organizationId!,
              productId: item.productId,
              warehouseId: po.warehouseId ?? undefined,
              type: "PURCHASE_IN",
              quantity: qty,
              balanceAfter: newStock,
              referenceType: "PurchaseOrder",
              referenceId: po.id,
            },
          }),
          prisma.product.update({ where: { id: item.productId }, data: { currentStock: newStock } }),
          prisma.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: item.quantity } }),
        ]);
      }
    }

    ok(res, updated);
  } catch (e) { serverError(res, e); }
}

export async function deletePurchaseOrder(req: OrgRequest, res: Response): Promise<void> {
  try {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
    });
    if (!po) { notFound(res, "Not found"); return; }
    if (po.status !== "DRAFT") { badRequest(res, "Only DRAFT orders can be deleted"); return; }
    await prisma.purchaseOrder.delete({ where: { id: (req.params.id as string) } });
    ok(res, null, "Deleted");
  } catch (e) { serverError(res, e); }
}

