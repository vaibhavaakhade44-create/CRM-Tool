import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, serverError, badRequest } from "../utils/response";

export async function getBranding(req: OrgRequest, res: Response): Promise<void> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: {
        id: true, name: true, logo: true, brandingColor: true,
        email: true, phone: true, address: true, city: true, state: true,
        country: true, pincode: true, taxId: true, website: true, currency: true,
      },
    });
    ok(res, org);
  } catch (err) { serverError(res, err); }
}

export async function updateBranding(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { logo, brandingColor, invoiceHeader, invoiceFooter, invoiceNotes } = req.body;

    if (brandingColor && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(brandingColor)) {
      badRequest(res, "brandingColor must be a valid hex color (e.g. #6366f1)"); return;
    }

    const data: Record<string, any> = {};
    if (logo !== undefined)          data.logo = logo ?? null;
    if (brandingColor !== undefined)  data.brandingColor = brandingColor ?? null;

    // Store invoice template fields inside complianceConfig alongside compliance settings
    if (invoiceHeader !== undefined || invoiceFooter !== undefined || invoiceNotes !== undefined) {
      const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { complianceConfig: true } });
      const existing = (org?.complianceConfig as Record<string, any>) ?? {};
      data.complianceConfig = {
        ...existing,
        ...(invoiceHeader !== undefined && { invoiceHeader }),
        ...(invoiceFooter !== undefined && { invoiceFooter }),
        ...(invoiceNotes  !== undefined && { invoiceNotes  }),
      };
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data,
      select: { id: true, name: true, logo: true, brandingColor: true, complianceConfig: true },
    });

    ok(res, updated);
  } catch (err) { serverError(res, err); }
}
