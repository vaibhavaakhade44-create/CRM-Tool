import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, serverError } from "../utils/response";

// Groups parties with identical (case-insensitive) email, phone, mobile, or very similar name.
// Returns array of groups: each group has a "field" (what matched) and "parties" array.
export async function findDuplicateParties(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;

    // Duplicate emails
    const emailDups: any[] = await prisma.$queryRaw`
      SELECT p.id, p.name, p."displayName", p.email, p.phone, p.mobile, p.gstin, p.type, p."city", p."createdAt"
      FROM "Party" p
      WHERE p."organizationId" = ${orgId}
        AND p."isActive" = true
        AND p.email IS NOT NULL AND p.email != ''
        AND EXISTS (
          SELECT 1 FROM "Party" p2
          WHERE p2."organizationId" = ${orgId}
            AND p2."isActive" = true
            AND p2.id != p.id
            AND LOWER(p2.email) = LOWER(p.email)
        )
      ORDER BY LOWER(p.email), p."createdAt"
    `;

    // Duplicate phones (mobile or phone)
    const phoneDups: any[] = await prisma.$queryRaw`
      SELECT p.id, p.name, p."displayName", p.email, p.phone, p.mobile, p.gstin, p.type, p."city", p."createdAt"
      FROM "Party" p
      WHERE p."organizationId" = ${orgId}
        AND p."isActive" = true
        AND (p.phone IS NOT NULL OR p.mobile IS NOT NULL)
        AND EXISTS (
          SELECT 1 FROM "Party" p2
          WHERE p2."organizationId" = ${orgId}
            AND p2."isActive" = true
            AND p2.id != p.id
            AND (
              (p.phone IS NOT NULL AND p.phone != '' AND p2.phone = p.phone) OR
              (p.mobile IS NOT NULL AND p.mobile != '' AND p2.mobile = p.mobile)
            )
        )
      ORDER BY COALESCE(p.phone, p.mobile), p."createdAt"
    `;

    // Duplicate GSTIN
    const gstinDups: any[] = await prisma.$queryRaw`
      SELECT p.id, p.name, p."displayName", p.email, p.phone, p.mobile, p.gstin, p.type, p."city", p."createdAt"
      FROM "Party" p
      WHERE p."organizationId" = ${orgId}
        AND p."isActive" = true
        AND p.gstin IS NOT NULL AND p.gstin != ''
        AND EXISTS (
          SELECT 1 FROM "Party" p2
          WHERE p2."organizationId" = ${orgId}
            AND p2."isActive" = true
            AND p2.id != p.id
            AND LOWER(p2.gstin) = LOWER(p.gstin)
        )
      ORDER BY LOWER(p.gstin), p."createdAt"
    `;

    // Similar names — exact same name (case-insensitive)
    const nameDups: any[] = await prisma.$queryRaw`
      SELECT p.id, p.name, p."displayName", p.email, p.phone, p.mobile, p.gstin, p.type, p."city", p."createdAt"
      FROM "Party" p
      WHERE p."organizationId" = ${orgId}
        AND p."isActive" = true
        AND EXISTS (
          SELECT 1 FROM "Party" p2
          WHERE p2."organizationId" = ${orgId}
            AND p2."isActive" = true
            AND p2.id != p.id
            AND LOWER(TRIM(p2.name)) = LOWER(TRIM(p.name))
        )
      ORDER BY LOWER(TRIM(p.name)), p."createdAt"
    `;

    // Group results by the matching field value
    function groupBy(rows: any[], keyFn: (r: any) => string, field: string) {
      const map = new Map<string, any[]>();
      for (const row of rows) {
        const k = keyFn(row);
        if (!k) continue;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(row);
      }
      const groups: any[] = [];
      for (const [key, parties] of map) {
        if (parties.length >= 2) {
          groups.push({ field, matchValue: key, parties });
        }
      }
      return groups;
    }

    const groups = [
      ...groupBy(nameDups,  r => r.name?.toLowerCase().trim() ?? "",          "name"),
      ...groupBy(emailDups, r => r.email?.toLowerCase() ?? "",                "email"),
      ...groupBy(phoneDups, r => (r.phone || r.mobile) ?? "",                 "phone"),
      ...groupBy(gstinDups, r => r.gstin?.toLowerCase() ?? "",                "gstin"),
    ];

    // Deduplicate groups that have exact same party id sets
    const seen = new Set<string>();
    const unique = groups.filter(g => {
      const key = g.field + "|" + g.parties.map((p: any) => p.id).sort().join(",");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    ok(res, { groups: unique, total: unique.length });
  } catch (err) {
    serverError(res, err);
  }
}

// Merge: keep one party, mark rest as inactive (soft-delete)
export async function mergeParties(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { keepId, mergeIds } = req.body as { keepId: string; mergeIds: string[] };

    if (!keepId || !Array.isArray(mergeIds) || mergeIds.length === 0) {
      res.status(400).json({ success: false, message: "keepId and mergeIds[] required" });
      return;
    }

    // Verify all belong to this org
    const parties = await prisma.party.findMany({
      where: { id: { in: [keepId, ...mergeIds] }, organizationId: orgId, isActive: true },
      select: { id: true },
    });
    if (parties.length !== mergeIds.length + 1) {
      res.status(400).json({ success: false, message: "Some parties not found in this organization" });
      return;
    }

    // Soft-delete the merge targets
    await prisma.party.updateMany({
      where: { id: { in: mergeIds }, organizationId: orgId },
      data: { isActive: false },
    });

    const kept = await prisma.party.findUnique({ where: { id: keepId } });
    ok(res, { message: `Merged ${mergeIds.length} duplicate(s) into ${kept?.name}`, kept });
  } catch (err) {
    serverError(res, err);
  }
}

// Find duplicate products by name within same org
export async function findDuplicateProducts(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;

    const nameDups: any[] = await prisma.$queryRaw`
      SELECT pr.id, pr.name, pr.sku, pr.category, pr."sellingPrice", pr."createdAt"
      FROM "Product" pr
      WHERE pr."organizationId" = ${orgId}
        AND pr."isActive" = true
        AND EXISTS (
          SELECT 1 FROM "Product" pr2
          WHERE pr2."organizationId" = ${orgId}
            AND pr2."isActive" = true
            AND pr2.id != pr.id
            AND LOWER(TRIM(pr2.name)) = LOWER(TRIM(pr.name))
        )
      ORDER BY LOWER(TRIM(pr.name)), pr."createdAt"
    `;

    const skuDups: any[] = await prisma.$queryRaw`
      SELECT pr.id, pr.name, pr.sku, pr.category, pr."sellingPrice", pr."createdAt"
      FROM "Product" pr
      WHERE pr."organizationId" = ${orgId}
        AND pr."isActive" = true
        AND pr.sku IS NOT NULL AND pr.sku != ''
        AND EXISTS (
          SELECT 1 FROM "Product" pr2
          WHERE pr2."organizationId" = ${orgId}
            AND pr2."isActive" = true
            AND pr2.id != pr.id
            AND LOWER(pr2.sku) = LOWER(pr.sku)
        )
      ORDER BY LOWER(pr.sku), pr."createdAt"
    `;

    function groupBy(rows: any[], keyFn: (r: any) => string, field: string) {
      const map = new Map<string, any[]>();
      for (const row of rows) {
        const k = keyFn(row);
        if (!k) continue;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(row);
      }
      const groups: any[] = [];
      for (const [key, products] of map) {
        if (products.length >= 2) groups.push({ field, matchValue: key, products });
      }
      return groups;
    }

    const groups = [
      ...groupBy(nameDups, r => r.name?.toLowerCase().trim() ?? "", "name"),
      ...groupBy(skuDups,  r => r.sku?.toLowerCase() ?? "",          "sku"),
    ];

    const seen = new Set<string>();
    const unique = groups.filter(g => {
      const key = g.field + "|" + g.products.map((p: any) => p.id).sort().join(",");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    ok(res, { groups: unique, total: unique.length });
  } catch (err) {
    serverError(res, err);
  }
}
