import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, serverError, badRequest, notFound } from "../utils/response";

// ConsentLog added after last generate — access via (prisma as any)
const db = () => (prisma as any);

// ── Compliance Config ────────────────────────────────────────

export async function getComplianceConfig(req: OrgRequest, res: Response): Promise<void> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: { complianceConfig: true },
    });

    const defaults = {
      dpdpConsentRequired:    true,
      dataRetentionDays:      365,
      privacyPolicyUrl:       "",
      termsUrl:               "",
      cookieConsentEnabled:   true,
      traiCallingHoursOnly:   true,
      traiDndCheckEnabled:    true,
      sebiRegistered:         false,
      sebiRegNumber:          "",
      sebiDisclaimer:         "This platform is for internal use only. Trade calls/Research are for informational purposes only and do not constitute SEBI-registered investment advice.",
      hipaaMode:              false,
      patientConsentRequired: true,
      dataExportEnabled:      true,
      rightToErasureEnabled:  true,
      invoiceHeader:          "",
      invoiceFooter:          "",
      invoiceNotes:           "",
    };

    ok(res, { ...defaults, ...((org?.complianceConfig as object) ?? {}) });
  } catch (err) { serverError(res, err); }
}

export async function updateComplianceConfig(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { complianceConfig: true } });
    const existing = (org?.complianceConfig as Record<string, unknown>) ?? {};

    const allowed = [
      "dpdpConsentRequired","dataRetentionDays","privacyPolicyUrl","termsUrl","cookieConsentEnabled",
      "traiCallingHoursOnly","traiDndCheckEnabled","sebiRegistered","sebiRegNumber","sebiDisclaimer",
      "hipaaMode","patientConsentRequired","dataExportEnabled","rightToErasureEnabled",
      "invoiceHeader","invoiceFooter","invoiceNotes",
    ];

    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { complianceConfig: { ...existing, ...patch } as any },
      select: { complianceConfig: true },
    });

    ok(res, updated.complianceConfig);
  } catch (err) { serverError(res, err); }
}

// ── Consent Logs ─────────────────────────────────────────────

export async function logConsent(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { entityType, entityId, consentType, consentGiven = true, notes } = req.body;

    if (!entityType || !entityId || !consentType) {
      badRequest(res, "entityType, entityId and consentType are required"); return;
    }

    const log = await db().consentLog.create({
      data: {
        organizationId: orgId,
        entityType,
        entityId,
        consentType,
        consentGiven: Boolean(consentGiven),
        notes: notes ?? null,
      },
    });

    created(res, log);
  } catch (err) { serverError(res, err); }
}

export async function listConsents(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const entityType = req.query.entityType as string | undefined;
    const entityId   = req.query.entityId   as string | undefined;

    const logs = await db().consentLog.findMany({
      where: {
        organizationId: orgId,
        ...(entityType && { entityType }),
        ...(entityId   && { entityId   }),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    ok(res, logs);
  } catch (err) { serverError(res, err); }
}

// ── Data Export (DPDP Right to Access) ───────────────────────

export async function exportOrgData(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;

    const [org, parties, leads, invoices, employees, supportTickets] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, email: true, phone: true, address: true, createdAt: true },
      }),
      prisma.party.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, email: true, phone: true, createdAt: true }, take: 1000 }),
      prisma.lead.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, email: true, phone: true, createdAt: true }, take: 1000 }),
      prisma.invoice.findMany({ where: { organizationId: orgId }, select: { id: true, invoiceNumber: true, total: true, status: true, createdAt: true }, take: 1000 }),
      prisma.employee.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, email: true, phone: true, createdAt: true }, take: 500 }),
      prisma.supportTicket.findMany({ where: { organizationId: orgId }, select: { id: true, subject: true, status: true, createdAt: true }, take: 500 }),
    ]);

    ok(res, {
      exportedAt: new Date().toISOString(),
      organization: org,
      summary: { parties: parties.length, leads: leads.length, invoices: invoices.length, employees: employees.length, supportTickets: supportTickets.length },
      data: { parties, leads, invoices, employees, supportTickets },
    });
  } catch (err) { serverError(res, err); }
}

// ── Data Deletion / Anonymisation (DPDP Right to Erasure) ────

export async function deletePartyData(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId   = req.organizationId!;
    const partyId = req.params.partyId as string;

    const party = await prisma.party.findFirst({ where: { id: partyId, organizationId: orgId } });
    if (!party) { notFound(res, "Party not found"); return; }

    // Anonymise PII — replace with anonymised placeholders, keep record skeleton for audit
    await prisma.party.update({
      where: { id: partyId },
      data: {
        name:     "DELETED_USER",
        email:    null,
        phone:    null,
        address:  null,
        website:  null,
        pan:      null,
        gstin:    null,
        notes:    null,
        isActive: false,
      },
    });

    await db().consentLog.create({
      data: {
        organizationId: orgId,
        entityType:     "PARTY",
        entityId:       partyId,
        consentType:    "RIGHT_TO_ERASURE",
        notes:          "PII anonymised per DPDP Act 2023 erasure request",
      },
    });

    ok(res, { anonymised: true, partyId, note: "Personal data anonymised per DPDP Act 2023" });
  } catch (err) { serverError(res, err); }
}
