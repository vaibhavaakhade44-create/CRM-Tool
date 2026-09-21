import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const itemSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
});

const soSchema = z.object({
  partyId: z.string().optional(),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  shippingAddress: z.string().optional(),
  shippingCharge: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

const shipmentSchema = z.object({
  salesOrderId: z.string().optional(),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  shipDate: z.string().optional(),
  weight: z.number().optional(),
  packages: z.number().int().default(1),
  notes: z.string().optional(),
});

async function generateSONumber(orgId: string): Promise<string> {
  const count = await prisma.salesOrder.count({ where: { organizationId: orgId } });
  return `SO-${String(count + 1).padStart(5, "0")}`;
}

async function generateShipmentNumber(orgId: string): Promise<string> {
  const count = await prisma.shipment.count({ where: { organizationId: orgId } });
  return `SHP-${String(count + 1).padStart(5, "0")}`;
}

function calcItems(items: z.infer<typeof itemSchema>[]) {
  let subtotal = 0, taxAmount = 0, totalDiscount = 0;
  const computed = items.map((item) => {
    const lineTotal = item.quantity * item.unitPrice;
    const discAmt = (lineTotal * item.discount) / 100;
    const afterDisc = lineTotal - discAmt;
    const tax = (afterDisc * item.taxRate) / 100;
    subtotal += lineTotal;
    taxAmount += tax;
    totalDiscount += discAmt;
    return { ...item, taxAmount: tax, total: afterDisc + tax };
  });
  return { computed, subtotal, taxAmount, discount: totalDiscount };
}

export async function listSalesOrders(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status, search, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { soNumber: { contains: search, mode: "insensitive" } },
        { party: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    const [orders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: { party: { select: { id: true, name: true } }, _count: { select: { items: true } } },
        skip, take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.salesOrder.count({ where }),
    ]);
    ok(res, { orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { serverError(res, e); }
}

export async function getSalesOrder(req: OrgRequest, res: Response): Promise<void> {
  try {
    const so = await prisma.salesOrder.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
      include: {
        party: true,
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
        shipments: true,
        invoices: { select: { id: true, invoiceNumber: true, status: true, total: true } },
      },
    });
    if (!so) { notFound(res, "Sales order not found"); return; }
    ok(res, so);
  } catch (e) { serverError(res, e); }
}

export async function createSalesOrder(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = soSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const soNumber = await generateSONumber(req.organizationId!);
    const { computed, subtotal, taxAmount, discount } = calcItems(data.data.items);
    const total = subtotal - discount + taxAmount + data.data.shippingCharge;

    const so = await prisma.salesOrder.create({
      data: {
        organizationId: req.organizationId!,
        partyId: data.data.partyId,
        soNumber,
        orderDate: data.data.orderDate ? new Date(data.data.orderDate) : new Date(),
        expectedDate: data.data.expectedDate ? new Date(data.data.expectedDate) : undefined,
        shippingAddress: data.data.shippingAddress,
        shippingCharge: data.data.shippingCharge,
        notes: data.data.notes,
        subtotal, taxAmount, discount, total,
        items: { create: computed },
      },
      include: { items: true },
    });
    created(res, so);
  } catch (e) { serverError(res, e); }
}

export async function updateSalesOrderStatus(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!status) { badRequest(res, "Status required"); return; }
    const so = await prisma.salesOrder.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
    });
    if (!so) { notFound(res, "Sales order not found"); return; }
    const updated = await prisma.salesOrder.update({ where: { id: (req.params.id as string) }, data: { status } });
    ok(res, updated);
  } catch (e) { serverError(res, e); }
}

export async function listShipments(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };
    if (status) where.status = status;
    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: { salesOrder: { select: { id: true, soNumber: true, party: { select: { name: true } } } } },
        skip, take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.shipment.count({ where }),
    ]);
    ok(res, { shipments, total });
  } catch (e) { serverError(res, e); }
}

export async function createShipment(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = shipmentSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    // Tenant-isolation: the referenced sales order must belong to this org,
    // otherwise a user could dispatch another org's order by guessing its id.
    if (data.data.salesOrderId) {
      const owns = await prisma.salesOrder.findFirst({
        where: { id: data.data.salesOrderId, organizationId: req.organizationId! },
        select: { id: true },
      });
      if (!owns) { notFound(res, "Sales order not found"); return; }
    }

    const shipmentNumber = await generateShipmentNumber(req.organizationId!);
    const shipment = await prisma.shipment.create({
      data: {
        organizationId: req.organizationId!,
        shipmentNumber,
        salesOrderId: data.data.salesOrderId,
        carrier: data.data.carrier,
        trackingNumber: data.data.trackingNumber,
        shipDate: data.data.shipDate ? new Date(data.data.shipDate) : undefined,
        weight: data.data.weight,
        packages: data.data.packages,
        notes: data.data.notes,
        status: "PENDING",
      },
    });

    if (data.data.salesOrderId) {
      await prisma.salesOrder.update({
        where: { id: data.data.salesOrderId },
        data: { status: "DISPATCHED" },
      });
    }

    created(res, shipment);
  } catch (e) { serverError(res, e); }
}

export async function updateShipmentStatus(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status, trackingNumber } = req.body;
    const shipment = await prisma.shipment.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
    });
    if (!shipment) { notFound(res, "Shipment not found"); return; }
    const updated = await prisma.shipment.update({
      where: { id: (req.params.id as string) },
      data: {
        ...(status && { status }),
        ...(trackingNumber && { trackingNumber }),
        ...(status === "DELIVERED" && { deliveryDate: new Date() }),
      },
    });
    if (status === "DELIVERED" && shipment.salesOrderId) {
      await prisma.salesOrder.update({
        where: { id: shipment.salesOrderId },
        data: { status: "DELIVERED" },
      });
    }
    ok(res, updated);
  } catch (e) { serverError(res, e); }
}

