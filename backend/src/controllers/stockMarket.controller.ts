import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";

const db = () => (prisma as any);

// ────────────────────────────────────────────────────────
//  ADVISORY PLANS
// ────────────────────────────────────────────────────────

export async function listAdvisoryPlans(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const plans = await db().advisoryPlan.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { price: "asc" },
    });
    ok(res, plans);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createAdvisoryPlan(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { name, description, price, billingCycle, features, maxAlerts } = req.body;

    if (!name?.trim()) { badRequest(res, "Plan name is required"); return; }
    if (!price || isNaN(Number(price))) { badRequest(res, "Valid price is required"); return; }

    const plan = await db().advisoryPlan.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        description: description ?? null,
        price: Number(price),
        billingCycle: billingCycle ?? "MONTHLY",
        features: Array.isArray(features) ? features : [],
        maxAlerts: maxAlerts ? Number(maxAlerts) : null,
      },
    });

    created(res, plan);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateAdvisoryPlan(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().advisoryPlan.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Plan not found"); return; }

    const { name, description, price, billingCycle, features, maxAlerts, isActive } = req.body;
    const updated = await db().advisoryPlan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(billingCycle !== undefined && { billingCycle }),
        ...(features !== undefined && { features }),
        ...(maxAlerts !== undefined && { maxAlerts: maxAlerts ? Number(maxAlerts) : null }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  ADVISORY SUBSCRIPTIONS
// ────────────────────────────────────────────────────────

export async function listSubscriptions(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { status, planId } = req.query as Record<string, string>;

    const subs = await db().advisorySubscription.findMany({
      where: {
        organizationId: orgId,
        ...(status && { status }),
        ...(planId && { planId }),
      },
      include: { plan: { select: { id: true, name: true, price: true, billingCycle: true } } },
      orderBy: { createdAt: "desc" },
    });
    ok(res, subs);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createSubscription(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { partyId, planId, startDate, endDate, amount, kycVerified } = req.body;

    if (!planId) { badRequest(res, "planId is required"); return; }

    const plan = await db().advisoryPlan.findFirst({ where: { id: planId, organizationId: orgId } });
    if (!plan) { notFound(res, "Plan not found"); return; }

    const sub = await db().advisorySubscription.create({
      data: {
        organizationId: orgId,
        partyId: partyId ?? null,
        planId,
        status: "ACTIVE",
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        amount: amount ? Number(amount) : plan.price,
        kycVerified: kycVerified ?? false,
      },
    });

    created(res, sub);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateSubscription(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().advisorySubscription.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Subscription not found"); return; }

    const { status, endDate, kycVerified } = req.body;
    const updated = await db().advisorySubscription.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(kycVerified !== undefined && { kycVerified }),
      },
    });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  TRADE CALLS
// ────────────────────────────────────────────────────────

export async function listTradeCalls(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { status, symbol, segment, callType } = req.query as Record<string, string>;

    const calls = await db().tradeCall.findMany({
      where: {
        organizationId: orgId,
        ...(status && status !== "ALL" && { status }),
        ...(symbol && { symbol: { contains: symbol.toUpperCase() } }),
        ...(segment && { segment }),
        ...(callType && { callType }),
      },
      orderBy: { createdAt: "desc" },
    });
    ok(res, calls);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createTradeCall(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { symbol, exchange, callType, segment, entryPrice, entryLow, entryHigh,
            targetPrice, target2, stopLoss, riskReward, rationale, publishedAt, expiresAt } = req.body;

    if (!symbol?.trim()) { badRequest(res, "Symbol is required"); return; }

    const call = await db().tradeCall.create({
      data: {
        organizationId: orgId,
        symbol: symbol.trim().toUpperCase(),
        exchange: exchange ?? null,
        callType: callType ?? "BUY",
        segment: segment ?? "EQUITY",
        entryPrice: entryPrice ? Number(entryPrice) : null,
        entryLow: entryLow ? Number(entryLow) : null,
        entryHigh: entryHigh ? Number(entryHigh) : null,
        targetPrice: targetPrice ? Number(targetPrice) : null,
        target2: target2 ? Number(target2) : null,
        stopLoss: stopLoss ? Number(stopLoss) : null,
        riskReward: riskReward ? Number(riskReward) : null,
        rationale: rationale ?? null,
        calledById: req.userId ?? null,
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    created(res, call);
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateTradeCall(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().tradeCall.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Trade call not found"); return; }

    const { status, outcome, rationale, expiresAt } = req.body;
    const updated = await db().tradeCall.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(outcome !== undefined && { outcome: outcome ? Number(outcome) : null }),
        ...(rationale !== undefined && { rationale }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
    });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  RESEARCH REPORTS
// ────────────────────────────────────────────────────────

export async function listResearchReports(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { symbol, reportType } = req.query as Record<string, string>;

    const reports = await db().researchReport.findMany({
      where: {
        organizationId: orgId,
        ...(symbol && { symbol: { contains: symbol.toUpperCase() } }),
        ...(reportType && { reportType }),
      },
      select: { id: true, title: true, symbol: true, reportType: true, rating: true,
                targetPrice: true, currentPrice: true, isPublic: true, publishedAt: true, authorId: true },
      orderBy: { createdAt: "desc" },
    });
    ok(res, reports);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createResearchReport(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { title, symbol, reportType, summary, content, rating, targetPrice, currentPrice, fileUrl, isPublic, publishedAt } = req.body;

    if (!title?.trim()) { badRequest(res, "Report title is required"); return; }

    const report = await db().researchReport.create({
      data: {
        organizationId: orgId,
        title: title.trim(),
        symbol: symbol ? symbol.toUpperCase() : null,
        reportType: reportType ?? "EQUITY",
        summary: summary ?? null,
        content: content ?? null,
        rating: rating ?? null,
        targetPrice: targetPrice ? Number(targetPrice) : null,
        currentPrice: currentPrice ? Number(currentPrice) : null,
        fileUrl: fileUrl ?? null,
        isPublic: isPublic ?? false,
        authorId: req.userId ?? null,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
      },
    });

    created(res, report);
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  KYC RECORDS
// ────────────────────────────────────────────────────────

export async function listKYCRecords(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { isVerified } = req.query as Record<string, string>;
    const records = await db().kYCRecord.findMany({
      where: {
        organizationId: orgId,
        ...(isVerified !== undefined && { isVerified: isVerified === "true" }),
      },
      orderBy: { createdAt: "desc" },
    });
    ok(res, records);
  } catch (err) {
    serverError(res, err);
  }
}

export async function upsertKYCRecord(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { partyId, panNumber, aadharNumber, bankAccount, ifscCode, bankName,
            dematAccount, dpId, riskProfile, documents } = req.body;

    if (!partyId) { badRequest(res, "partyId is required"); return; }

    const record = await db().kYCRecord.upsert({
      where: { organizationId_partyId: { organizationId: orgId, partyId } },
      create: {
        organizationId: orgId,
        partyId,
        panNumber: panNumber ?? null,
        aadharNumber: aadharNumber ?? null,
        bankAccount: bankAccount ?? null,
        ifscCode: ifscCode ?? null,
        bankName: bankName ?? null,
        dematAccount: dematAccount ?? null,
        dpId: dpId ?? null,
        riskProfile: riskProfile ?? null,
        documents: Array.isArray(documents) ? documents : [],
      },
      update: {
        panNumber: panNumber ?? undefined,
        aadharNumber: aadharNumber ?? undefined,
        bankAccount: bankAccount ?? undefined,
        ifscCode: ifscCode ?? undefined,
        bankName: bankName ?? undefined,
        dematAccount: dematAccount ?? undefined,
        dpId: dpId ?? undefined,
        riskProfile: riskProfile ?? undefined,
        ...(documents !== undefined && { documents }),
      },
    });

    ok(res, record);
  } catch (err) {
    serverError(res, err);
  }
}

export async function verifyKYC(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().kYCRecord.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "KYC record not found"); return; }

    const updated = await db().kYCRecord.update({
      where: { id },
      data: { isVerified: true, verifiedById: req.userId ?? null, verifiedAt: new Date() },
    });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ────────────────────────────────────────────────────────
//  MARKET ALERTS
// ────────────────────────────────────────────────────────

export async function listMarketAlerts(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { symbol, isActive } = req.query as Record<string, string>;

    const alerts = await db().marketAlert.findMany({
      where: {
        organizationId: orgId,
        ...(symbol && { symbol: { contains: symbol.toUpperCase() } }),
        ...(isActive !== undefined && { isActive: isActive === "true" }),
      },
      orderBy: { createdAt: "desc" },
    });
    ok(res, alerts);
  } catch (err) {
    serverError(res, err);
  }
}

export async function createMarketAlert(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { symbol, alertType, condition, triggerValue, message } = req.body;

    if (!symbol?.trim() || !message?.trim()) { badRequest(res, "Symbol and message are required"); return; }

    const alert = await db().marketAlert.create({
      data: {
        organizationId: orgId,
        symbol: symbol.trim().toUpperCase(),
        alertType: alertType ?? "PRICE",
        condition: condition ?? null,
        triggerValue: triggerValue ? Number(triggerValue) : null,
        message: message.trim(),
        createdById: req.userId ?? null,
      },
    });

    created(res, alert);
  } catch (err) {
    serverError(res, err);
  }
}

export async function deleteMarketAlert(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const existing = await db().marketAlert.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Alert not found"); return; }
    await db().marketAlert.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (err) {
    serverError(res, err);
  }
}
