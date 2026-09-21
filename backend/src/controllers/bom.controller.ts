import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";

// ── BOMs ──────────────────────────────────────────────────────

export async function listBOMs(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { productId } = req.query as { productId?: string };

    const boms = await (prisma as any).bOM.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        ...(productId && { productId }),
      },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        items: {
          include: { component: { select: { id: true, name: true, sku: true, unit: true, currentStock: true } } },
        },
        _count: { select: { workOrders: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    ok(res, { boms });
  } catch (err) {
    serverError(res, err);
  }
}

export async function createBOM(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { productId, name, version, notes, items } = req.body as {
      productId: string;
      name: string;
      version?: string;
      notes?: string;
      items: { componentId: string; quantity: number; unit?: string; notes?: string }[];
    };

    if (!productId || !name || !items?.length) {
      badRequest(res, "productId, name and items[] are required");
      return;
    }

    // Verify product belongs to org
    const product = await prisma.product.findFirst({ where: { id: productId, organizationId: orgId } });
    if (!product) { notFound(res, "Product not found"); return; }

    const bom = await (prisma as any).bOM.create({
      data: {
        organizationId: orgId,
        productId,
        name,
        version: version ?? "1.0",
        notes: notes ?? null,
        createdById: req.userId ?? null,
        items: {
          create: items.map(it => ({
            componentId: it.componentId,
            quantity: it.quantity,
            unit: it.unit ?? "PCS",
            notes: it.notes ?? null,
          })),
        },
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        items: { include: { component: { select: { id: true, name: true, sku: true, unit: true } } } },
      },
    });

    created(res, bom);
  } catch (err) {
    serverError(res, err);
  }
}

export async function deleteBOM(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = String(req.params.id);

    const bom = await (prisma as any).bOM.findFirst({ where: { id, organizationId: orgId } });
    if (!bom) { notFound(res, "BOM not found"); return; }

    await (prisma as any).bOM.update({ where: { id }, data: { isActive: false } });
    ok(res, { deleted: true });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Work Orders ───────────────────────────────────────────────

export async function listWorkOrders(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { status } = req.query as { status?: string };

    const workOrders = await (prisma as any).workOrder.findMany({
      where: {
        organizationId: orgId,
        ...(status && { status }),
      },
      include: {
        bom: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            items: { include: { component: { select: { id: true, name: true, sku: true, currentStock: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    ok(res, { workOrders });
  } catch (err) {
    serverError(res, err);
  }
}

export async function createWorkOrder(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { bomId, quantity, startDate, endDate, notes } = req.body as {
      bomId: string;
      quantity: number;
      startDate?: string;
      endDate?: string;
      notes?: string;
    };

    if (!bomId || !quantity) { badRequest(res, "bomId and quantity are required"); return; }

    const bom = await (prisma as any).bOM.findFirst({ where: { id: bomId, organizationId: orgId } });
    if (!bom) { notFound(res, "BOM not found"); return; }

    // Auto-generate work order number
    const count = await (prisma as any).workOrder.count({ where: { organizationId: orgId } });
    const workOrderNo = `WO-${String(count + 1).padStart(5, "0")}`;

    const wo = await (prisma as any).workOrder.create({
      data: {
        organizationId: orgId,
        bomId,
        workOrderNo,
        quantity,
        status: "DRAFT",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        notes: notes ?? null,
        createdById: req.userId ?? null,
      },
      include: {
        bom: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });

    created(res, wo);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateWorkOrderStatus(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = String(req.params.id);
    const { status, notes } = req.body as { status: string; notes?: string };

    const wo = await (prisma as any).workOrder.findFirst({ where: { id, organizationId: orgId } });
    if (!wo) { notFound(res, "Work order not found"); return; }

    const validStatuses = ["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
    if (!validStatuses.includes(status)) { badRequest(res, "Invalid status"); return; }

    const updated = await (prisma as any).workOrder.update({
      where: { id },
      data: {
        status,
        ...(notes !== undefined && { notes }),
        ...(status === "COMPLETED" && { completedAt: new Date() }),
      },
    });

    // If completed, consume component stock
    if (status === "COMPLETED") {
      const bom = await (prisma as any).bOM.findUnique({
        where: { id: wo.bomId },
        include: { items: true },
      });

      if (bom?.items) {
        for (const item of bom.items) {
          await prisma.product.update({
            where: { id: item.componentId },
            data: { currentStock: { decrement: item.quantity * wo.quantity } },
          });
          // Stock movement record
          await prisma.stockMovement.create({
            data: {
              organizationId: orgId,
              productId: item.componentId,
              type: "PRODUCTION_USE" as any,
              quantity: -(item.quantity * wo.quantity),
              balanceAfter: 0,
              referenceType: "WORK_ORDER",
              referenceId: updated.workOrderNo,
              notes: `Consumed for work order ${updated.workOrderNo}`,
            },
          });
        }
        // Add finished goods stock
        await prisma.product.update({
          where: { id: bom.productId },
          data: { currentStock: { increment: wo.quantity } },
        });
        await prisma.stockMovement.create({
          data: {
            organizationId: orgId,
            productId: bom.productId,
            type: "PRODUCTION_IN" as any,
            quantity: wo.quantity,
            balanceAfter: 0,
            referenceType: "WORK_ORDER",
            referenceId: updated.workOrderNo,
            notes: `Produced via work order ${updated.workOrderNo}`,
          },
        });
      }
    }

    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}
