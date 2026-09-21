import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, notFound, serverError } from "../utils/response";

export async function listGoodsEntries(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const direction = (req.query.direction as string) || "";
    const search = (req.query.search as string) || "";
    const limit = parseInt((req.query.limit as string) || "200");

    const where: any = { organizationId: orgId };
    if (direction) where.direction = direction;
    if (search) {
      where.OR = [
        { materialName: { contains: search, mode: "insensitive" } },
        { partyName: { contains: search, mode: "insensitive" } },
        { entryNumber: { contains: search, mode: "insensitive" } },
        { vehicleNumber: { contains: search, mode: "insensitive" } },
        { referenceNo: { contains: search, mode: "insensitive" } },
        { personName: { contains: search, mode: "insensitive" } },
      ];
    }

    const entries = await prisma.goodsEntry.findMany({
      where,
      include: {
        party: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
    ok(res, entries);
  } catch (e) { serverError(res, e); }
}

export async function createGoodsEntry(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const {
      direction, entryDate, entryTime, materialName, quantity, unit,
      partyName, partyId, vehicleNumber, personName, remarks, referenceNo, warehouseId,
    } = req.body;

    const count = await prisma.goodsEntry.count({ where: { organizationId: orgId, direction } });
    const prefix = direction === "INWARD" ? "GRN" : "DSP";
    const entryNumber = `${prefix}-${String(count + 1).padStart(4, "0")}`;

    const entry = await prisma.goodsEntry.create({
      data: {
        organizationId: orgId,
        entryNumber,
        direction,
        entryDate: new Date(entryDate),
        entryTime: entryTime || null,
        materialName,
        quantity: parseFloat(quantity),
        unit: unit || "PCS",
        partyName: partyName || null,
        partyId: partyId || null,
        vehicleNumber: vehicleNumber || null,
        personName: personName || null,
        remarks: remarks || null,
        referenceNo: referenceNo || null,
        warehouseId: warehouseId || null,
      },
      include: {
        party: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });
    ok(res, entry, "Entry created");
  } catch (e) { serverError(res, e); }
}

export async function updateGoodsEntry(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { id } = req.params;
    const { status, remarks, personName } = req.body;
    // Tenant-isolation guard: only touch rows that belong to the caller's org
    const existing = await prisma.goodsEntry.findFirst({ where: { id: id as string, organizationId: orgId } });
    if (!existing) { notFound(res, "Entry not found"); return; }
    const entry = await prisma.goodsEntry.update({
      where: { id: id as string },
      data: { status, remarks, personName },
    });
    ok(res, entry);
  } catch (e) { serverError(res, e); }
}

export async function deleteGoodsEntry(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { id } = req.params;
    // Tenant-isolation guard: only delete rows that belong to the caller's org
    const existing = await prisma.goodsEntry.findFirst({ where: { id: id as string, organizationId: orgId } });
    if (!existing) { notFound(res, "Entry not found"); return; }
    await prisma.goodsEntry.delete({ where: { id: id as string } });
    ok(res, null, "Deleted");
  } catch (e) { serverError(res, e); }
}
