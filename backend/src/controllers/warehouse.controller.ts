import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const warehouseSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  isDefault: z.boolean().default(false),
});

const transferSchema = z.object({
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  notes: z.string().optional(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().positive() })).min(1),
});

export async function listWarehouses(req: OrgRequest, res: Response): Promise<void> {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId: req.organizationId!, isActive: true },
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    });
    ok(res, warehouses);
  } catch (e) { serverError(res, e); }
}

export async function createWarehouse(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = warehouseSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const existing = await prisma.warehouse.findUnique({
      where: { organizationId_code: { organizationId: req.organizationId!, code: data.data.code } },
    });
    if (existing) { badRequest(res, "Warehouse code already exists"); return; }

    const wh = await prisma.warehouse.create({ data: { ...data.data, organizationId: req.organizationId! } });
    created(res, wh);
  } catch (e) { serverError(res, e); }
}

export async function updateWarehouse(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = warehouseSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const existing = await prisma.warehouse.findFirst({ where: { id: (req.params.id as string), organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Warehouse not found"); return; }
    const wh = await prisma.warehouse.update({ where: { id: (req.params.id as string) }, data: data.data });
    ok(res, wh);
  } catch (e) { serverError(res, e); }
}

export async function createTransfer(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = transferSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    if (data.data.fromWarehouseId === data.data.toWarehouseId) {
      badRequest(res, "Source and destination warehouses must be different");
      return;
    }

    const [from, to] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: data.data.fromWarehouseId, organizationId: req.organizationId! } }),
      prisma.warehouse.findFirst({ where: { id: data.data.toWarehouseId, organizationId: req.organizationId! } }),
    ]);
    if (!from || !to) { notFound(res, "Warehouse not found"); return; }

    const transfer = await prisma.stockTransfer.create({
      data: {
        organizationId: req.organizationId!,
        fromWarehouseId: data.data.fromWarehouseId,
        toWarehouseId: data.data.toWarehouseId,
        notes: data.data.notes,
        createdById: req.userId,
        status: "DRAFT",
        items: { create: data.data.items },
      },
      include: { items: true },
    });
    created(res, transfer);
  } catch (e) { serverError(res, e); }
}

export async function completeTransfer(req: OrgRequest, res: Response): Promise<void> {
  try {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: (req.params.id as string), organizationId: req.organizationId! },
      include: { items: true },
    });
    if (!transfer) { notFound(res, "Transfer not found"); return; }
    if (transfer.status !== "DRAFT" && transfer.status !== "IN_TRANSIT") {
      badRequest(res, "Transfer cannot be completed in its current state");
      return;
    }

    for (const item of transfer.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;
      const newStock = Math.max(0, product.currentStock - item.quantity);
      await prisma.$transaction([
        prisma.stockMovement.create({
          data: {
            organizationId: req.organizationId!,
            productId: item.productId,
            warehouseId: transfer.fromWarehouseId,
            type: "TRANSFER_OUT",
            quantity: item.quantity,
            balanceAfter: newStock,
            referenceType: "StockTransfer",
            referenceId: transfer.id,
          },
        }),
        prisma.stockMovement.create({
          data: {
            organizationId: req.organizationId!,
            productId: item.productId,
            warehouseId: transfer.toWarehouseId,
            type: "TRANSFER_IN",
            quantity: item.quantity,
            balanceAfter: newStock + item.quantity,
            referenceType: "StockTransfer",
            referenceId: transfer.id,
          },
        }),
        prisma.product.update({ where: { id: item.productId }, data: { currentStock: newStock } }),
      ]);
    }

    const updated = await prisma.stockTransfer.update({
      where: { id: (req.params.id as string) },
      data: { status: "COMPLETED" },
    });
    ok(res, updated);
  } catch (e) { serverError(res, e); }
}

export async function listTransfers(req: OrgRequest, res: Response): Promise<void> {
  try {
    const transfers = await prisma.stockTransfer.findMany({
      where: { organizationId: req.organizationId! },
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    ok(res, transfers);
  } catch (e) { serverError(res, e); }
}

