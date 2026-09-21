import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";

const db = () => (prisma as any);

// ────────────────────────────────────────────────────────
//  CALL LOGS
// ────────────────────────────────────────────────────────

export async function listCallLogs(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { agentId, leadId, campaignId, outcome, from, to, page = "1", limit = "50" } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {
      organizationId: orgId,
      ...(agentId && { agentId }),
      ...(leadId && { leadId }),
      ...(campaignId && { campaignId }),
      ...(outcome && { outcome }),
      ...(from || to ? { calledAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}),
    };

    const [logs, total] = await Promise.all([
      db().callLog.findMany({ where, orderBy: { calledAt: "desc" }, skip, take: parseInt(limit) }),
      db().callLog.count({ where }),
    ]);

    ok(res, { logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    serverError(res, err);
  }
}

export async function createCallLog(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { leadId, partyId, phone, direction, outcome, duration, notes, recordingUrl, campaignId, calledAt } = req.body;

    if (!phone?.trim()) { badRequest(res, "Phone number is required"); return; }

    const log = await db().callLog.create({
      data: {
        organizationId: orgId,
        agentId: req.userId ?? null,
        leadId: leadId ?? null,
        partyId: partyId ?? null,
        phone: phone.trim(),
        direction: direction ?? "OUTBOUND",
        outcome: outcome ?? null,
        duration: duration ? Number(duration) : null,
        notes: notes ?? null,
        recordingUrl: recordingUrl ?? null,
        campaignId: campaignId ?? null,
        calledAt: calledAt ? new Date(calledAt) : new Date(),
      },
    });

    created(res, log);
  } catch (err) {
    serverError(res, err);
  }
}

export async function getCallStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { from, to, agentId } = req.query as Record<string, string>;

    const where: any = { organizationId: orgId };
    if (agentId) where.agentId = agentId;
    if (from || to) where.calledAt = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };

    const [byOutcome, byAgent, total] = await Promise.all([
      db().callLog.groupBy({ by: ["outcome"], where, _count: { id: true } }),
      db().callLog.groupBy({ by: ["agentId"], where, _count: { id: true }, _sum: { duration: true } }),
      db().callLog.count({ where }),
    ]);

    ok(res, { total, byOutcome, byAgent });
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  CALL SCRIPTS
// ────────────────────────────────────────────────────────

export async function listCallScripts(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const scripts = await db().callScript.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { name: "asc" },
    });
    ok(res, scripts);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createCallScript(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { name, category, content, objections } = req.body;

    if (!name?.trim() || !content?.trim()) { badRequest(res, "Name and content are required"); return; }

    const script = await db().callScript.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        category: category ?? null,
        content: content.trim(),
        objections: objections ?? null,
        createdById: req.userId ?? null,
      },
    });

    created(res, script);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateCallScript(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().callScript.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Script not found"); return; }

    const { name, category, content, objections, isActive } = req.body;
    const updated = await db().callScript.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(content !== undefined && { content }),
        ...(objections !== undefined && { objections }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  DNC (DO NOT CALL)
// ────────────────────────────────────────────────────────

export async function listDNC(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { search } = req.query as Record<string, string>;
    const entries = await db().dNCEntry.findMany({
      where: {
        organizationId: orgId,
        ...(search && { phone: { contains: search } }),
      },
      orderBy: { createdAt: "desc" },
    });
    ok(res, entries);
  } catch (err) {
    serverError(res, err);
  }
}

export async function addDNC(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { phone, reason } = req.body;

    if (!phone?.trim()) { badRequest(res, "Phone number is required"); return; }

    const entry = await db().dNCEntry.upsert({
      where: { organizationId_phone: { organizationId: orgId, phone: phone.trim() } },
      create: { organizationId: orgId, phone: phone.trim(), reason: reason ?? null, addedById: req.userId ?? null },
      update: { reason: reason ?? null },
    });

    ok(res, entry);
  } catch (err) {
    serverError(res, err);
  }
}

export async function removeDNC(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().dNCEntry.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "DNC entry not found"); return; }
    await db().dNCEntry.delete({ where: { id } });
    ok(res, { removed: true });
  } catch (err) {
    serverError(res, err);
  }
}

export async function checkDNC(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const phone = req.query.phone as string;
    if (!phone) { badRequest(res, "Phone required"); return; }

    const entry = await db().dNCEntry.findFirst({ where: { organizationId: orgId, phone } });
    ok(res, { isDNC: !!entry, entry });
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  DIALER CAMPAIGNS
// ────────────────────────────────────────────────────────

export async function listDialerCampaigns(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const campaigns = await db().dialerCampaign.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });
    ok(res, campaigns);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createDialerCampaign(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { name, description, scriptId, startDate, endDate } = req.body;

    if (!name?.trim()) { badRequest(res, "Campaign name is required"); return; }

    const campaign = await db().dialerCampaign.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        description: description ?? null,
        scriptId: scriptId ?? null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        createdById: req.userId ?? null,
      },
    });

    created(res, campaign);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateDialerCampaign(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().dialerCampaign.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Campaign not found"); return; }

    const { name, description, status, scriptId, targetCount, dialedCount, connectedCount, convertedCount, startDate, endDate } = req.body;
    const updated = await db().dialerCampaign.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(scriptId !== undefined && { scriptId }),
        ...(targetCount !== undefined && { targetCount: Number(targetCount) }),
        ...(dialedCount !== undefined && { dialedCount: Number(dialedCount) }),
        ...(connectedCount !== undefined && { connectedCount: Number(connectedCount) }),
        ...(convertedCount !== undefined && { convertedCount: Number(convertedCount) }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      },
    });

    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}
