import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, serverError } from "../utils/response";
import { z } from "zod";
import { createNotification } from "./notifications.controller";

const batchSchema = z.object({
  productId:        z.string(),
  batchNumber:      z.string().min(1),
  lotNumber:        z.string().optional(),
  manufacturingDate: z.string().optional(),
  expiryDate:       z.string().optional(),
  quantity:         z.number().min(0),
  costPrice:        z.number().optional(),
  notes:            z.string().optional(),
});

// ── GET /api/batches  (optionally ?productId=xxx) ─────────────
export async function listBatches(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { productId, expiringSoon } = req.query as Record<string, string>;
    const where: any = { organizationId: req.organizationId!, isActive: true };
    if (productId) where.productId = productId;
    if (expiringSoon === "true") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 30);
      where.expiryDate = { lte: cutoff, not: null };
    }
    const batches = await (prisma.productBatch as any).findMany({
      where,
      include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    ok(res, batches);
  } catch (e) { serverError(res, e); }
}

// ── POST /api/batches ─────────────────────────────────────────
export async function createBatch(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = batchSchema.parse(req.body);
    const batch = await (prisma.productBatch as any).create({
      data: {
        organizationId: req.organizationId!,
        productId: data.productId,
        batchNumber: data.batchNumber,
        lotNumber: data.lotNumber,
        manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        quantity: data.quantity,
        costPrice: data.costPrice,
        notes: data.notes,
      },
      include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
    });

    // Alert if expiring within 30 days
    if (batch.expiryDate) {
      const daysLeft = Math.floor((new Date(batch.expiryDate).getTime() - Date.now()) / 86400000);
      if (daysLeft <= 30) {
        await createNotification({
          organizationId: req.organizationId!,
          type: "EXPIRY_ALERT",
          title: "Batch expiring soon",
          message: `Batch ${batch.batchNumber} of ${batch.product.name} expires in ${daysLeft} days`,
          link: `/inventory?product=${batch.productId}`,
        });
      }
    }

    created(res, batch);
  } catch (e) { serverError(res, e); }
}

// ── PATCH /api/batches/:id ────────────────────────────────────
export async function updateBatch(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const data = batchSchema.partial().parse(req.body);
    const existing = await (prisma.productBatch as any).findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Batch not found"); return; }

    const updated = await (prisma.productBatch as any).update({
      where: { id },
      data: {
        ...data,
        manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      },
      include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
    });
    ok(res, updated);
  } catch (e) { serverError(res, e); }
}

// ── DELETE /api/batches/:id ───────────────────────────────────
export async function deleteBatch(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const existing = await (prisma.productBatch as any).findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Batch not found"); return; }
    await (prisma.productBatch as any).update({ where: { id }, data: { isActive: false } });
    ok(res, { message: "Batch deleted" });
  } catch (e) { serverError(res, e); }
}

// ── GET /api/batches/expiry-alerts ────────────────────────────
// Used by cron to find expiring batches
export async function getExpiryAlerts(req: OrgRequest, res: Response): Promise<void> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 30);
    const batches = await (prisma.productBatch as any).findMany({
      where: {
        organizationId: req.organizationId!,
        isActive: true,
        quantity: { gt: 0 },
        expiryDate: { lte: cutoff, not: null },
      },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { expiryDate: "asc" },
    });
    ok(res, batches);
  } catch (e) { serverError(res, e); }
}
