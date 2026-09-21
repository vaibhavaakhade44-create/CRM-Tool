import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";
import { bustCache } from "../middleware/cacheMiddleware";
import { isWBAOrgId, LEAD_DEFAULT_FOLLOWUP_MS } from "../utils/wbaOrg";

const db = () => (prisma as any);

const leadSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  source: z.enum(["WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "EMAIL", "PHONE", "EXHIBITION", "JUSTDIAL", "INDIAMART", "FACEBOOK", "INSTAGRAM", "WHATSAPP", "OTHER"]).default("OTHER"),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]).default("NEW"),
  value: z.number().optional(),
  campaignId: z.string().optional(),
  assignedToId: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  score: z.number().int().min(0).max(100).optional(),
  leadGrade: z.enum(["A", "B", "C", "D"]).optional(),
  isDoNotCall: z.boolean().optional(),
  nextFollowUpDate: z.string().optional(),
  lastContactedAt: z.string().optional(),
});

const activitySchema = z.object({
  type: z.string().min(1),
  subject: z.string().optional(),
  description: z.string().min(1),
  outcome: z.string().optional(),
  callOutcome: z.enum(["ANSWERED", "NO_ANSWER", "BUSY", "CALLBACK_REQUESTED", "WRONG_NUMBER", "VOICEMAIL"]).optional(),
  duration: z.number().int().positive().optional(),
  followUpDate: z.string().optional(),
  noFollowUp: z.boolean().optional(), // "no follow-up needed" — suppresses the auto-overdue rule
});

const campaignSchema = z.object({
  name: z.string().min(1),
  type: z.string().default("Email"),
  status: z.string().default("Draft"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
  description: z.string().optional(),
});

// ── List leads ────────────────────────────────────────────────
export async function listLeads(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status, source, search, assignedToId, grade, myQueue, followUp, page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId! };

    if (status) where.status = status;
    if (source) where.source = source;
    if (grade) where.leadGrade = grade;
    if (assignedToId) where.assignedToId = assignedToId;
    if (myQueue === "true") {
      where.assignedToId = req.userId;
      where.status = { notIn: ["WON", "LOST"] };
    }
    // "Due today" worklist: anything with a follow-up date at or before the end
    // of today, not already won/lost, and not explicitly flagged no-follow-up.
    // Used by the dashboard's Today's Follow-ups panel — platform-wide, not WBA-specific.
    if (followUp === "due") {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      where.status = { notIn: ["WON", "LOST"] };
      where.noFollowUp = false;
      where.nextFollowUpDate = { lte: endOfToday };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { phone2: { contains: search } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    // White Band Associates: once a lead's client has reached Service Delivery
    // (a WBAProject exists for its party), drop it out of Lead Management.
    if (await isWBAOrgId(req.organizationId!)) {
      const sdProjects = await db().wBAProject.findMany({
        where: { organizationId: req.organizationId!, partyId: { not: null } },
        select: { partyId: true },
      });
      const sdPartyIds = [...new Set(sdProjects.map((p: { partyId: string | null }) => p.partyId).filter(Boolean))];
      if (sdPartyIds.length > 0) {
        where.AND = [...(where.AND ?? []), { OR: [{ partyId: null }, { partyId: { notIn: sdPartyIds } }] }];
      }
    }

    const orderBy: any = (myQueue === "true" || followUp === "due")
      ? [{ nextFollowUpDate: "asc" }, { score: "desc" }]
      : { createdAt: "desc" };

    const [leads, total] = await Promise.all([
      db().lead.findMany({
        where, skip, take: parseInt(limit),
        include: { _count: { select: { activities: true, appointments: true } }, campaign: { select: { id: true, name: true } } },
        orderBy,
      }),
      db().lead.count({ where }),
    ]);

    // assignedToId has no Prisma relation to User, so for the "due today"
    // worklist (which spans assignees) we attach display names manually.
    let leadsOut: any[] = leads;
    if (followUp === "due") {
      const assigneeIds = [...new Set(leads.map((l: any) => l.assignedToId).filter(Boolean))];
      const assignees = assigneeIds.length
        ? await prisma.user.findMany({ where: { id: { in: assigneeIds as string[] } }, select: { id: true, name: true } })
        : [];
      const nameById = new Map(assignees.map((u) => [u.id, u.name]));
      leadsOut = leads.map((l: any) => ({ ...l, assignedTo: l.assignedToId ? { name: nameById.get(l.assignedToId) ?? "Unknown" } : null }));
    }

    ok(res, { leads: leadsOut, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { serverError(res, e); }
}

// ── Get single lead ───────────────────────────────────────────
export async function getLead(req: OrgRequest, res: Response): Promise<void> {
  try {
    const lead = await db().lead.findFirst({
      where: { id: req.params.id as string, organizationId: req.organizationId! },
      include: {
        activities: { orderBy: { createdAt: "desc" } },
        appointments: { orderBy: { scheduledAt: "asc" }, where: { status: { not: "CANCELLED" } } },
        campaign: true,
      },
    });
    if (!lead) { notFound(res, "Lead not found"); return; }
    ok(res, lead);
  } catch (e) { serverError(res, e); }
}

// ── Create lead ───────────────────────────────────────────────
export async function createLead(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = leadSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const { nextFollowUpDate, lastContactedAt, email, ...rest } = data.data;
    const lead = await db().lead.create({
      data: {
        ...rest,
        email: email || undefined,
        organizationId: req.organizationId!,
        ...(nextFollowUpDate && { nextFollowUpDate: new Date(nextFollowUpDate) }),
        ...(lastContactedAt && { lastContactedAt: new Date(lastContactedAt) }),
      },
    });
    bustCache(req.organizationId!, "/api/leads");
    created(res, lead);
  } catch (e) { serverError(res, e); }
}

// ── Update lead ───────────────────────────────────────────────
export async function updateLead(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = leadSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const existing = await db().lead.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Lead not found"); return; }

    const { nextFollowUpDate, lastContactedAt, email, ...rest } = data.data;
    const lead = await db().lead.update({
      where: { id: req.params.id as string },
      data: {
        ...rest,
        email: email || undefined,
        ...(nextFollowUpDate !== undefined && { nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null }),
        ...(lastContactedAt !== undefined && { lastContactedAt: lastContactedAt ? new Date(lastContactedAt) : null }),
        // Auto-set lastContactedAt if status changes to CONTACTED
        ...(rest.status === "CONTACTED" && !lastContactedAt && { lastContactedAt: new Date() }),
      },
    });
    bustCache(req.organizationId!, "/api/leads");

    // Fire automation rules if status changed
    if (rest.status && rest.status !== existing.status) {
      fireAutomationRules(req.organizationId!, "status_changed", rest.status, lead.id).catch(() => {});
    }

    ok(res, lead);
  } catch (e) { serverError(res, e); }
}

// ── Add activity ──────────────────────────────────────────────
export async function addLeadActivity(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = activitySchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const lead = await db().lead.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!lead) { notFound(res, "Lead not found"); return; }

    const { followUpDate, noFollowUp, ...rest } = data.data;
    const act = await db().leadActivity.create({
      data: {
        leadId: req.params.id as string,
        ...rest,
        createdById: req.userId,
        ...(followUpDate && { followUpDate: new Date(followUpDate) }),
      },
    });

    // Auto-update lead lastContactedAt and nextFollowUpDate.
    // "No follow-up needed" wins: it clears any pending follow-up and flags the
    // lead so the 48h auto-overdue rule skips it. A real follow-up date clears the flag.
    await db().lead.update({
      where: { id: req.params.id as string },
      data: {
        lastContactedAt: new Date(),
        ...(noFollowUp
          ? { noFollowUp: true, nextFollowUpDate: null }
          : followUpDate
            ? { nextFollowUpDate: new Date(followUpDate), noFollowUp: false }
            : {}),
        ...(rest.type === "CALL" && { status: lead.status === "NEW" ? "CONTACTED" : lead.status }),
      },
    });

    created(res, act);
  } catch (e) { serverError(res, e); }
}

// ── Bulk import leads from CSV ────────────────────────────────
export async function bulkImportLeads(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { leads: rawLeads, campaignId, source = "OTHER", assignedToId } = req.body;
    if (!Array.isArray(rawLeads) || rawLeads.length === 0) {
      badRequest(res, "leads array is required"); return;
    }
    if (rawLeads.length > 1000) { badRequest(res, "Max 1000 leads per import"); return; }

    const results = { created: 0, skipped: 0, errors: [] as string[] };
    const orgId = req.organizationId!;

    const batchSize = 50;
    for (let i = 0; i < rawLeads.length; i += batchSize) {
      const batch = rawLeads.slice(i, i + batchSize);
      const toCreate: any[] = [];

      for (const row of batch) {
        const name = (row.name || row.Name || row["Full Name"] || row["first_name"] || "").toString().trim();
        if (!name) { results.skipped++; continue; }

        const phone = (row.phone || row.Phone || row["Mobile"] || row["mobile_phone"] || "").toString().trim();
        const email = (row.email || row.Email || row["email_address"] || "").toString().trim();
        const company = (row.company || row.Company || row["company_name"] || "").toString().trim();
        const city = (row.city || row.City || row["location"] || "").toString().trim();

        // Deduplicate by phone within same org
        if (phone) {
          const exists = await db().lead.findFirst({ where: { organizationId: orgId, phone } });
          if (exists) { results.skipped++; continue; }
        }

        toCreate.push({
          id: require("crypto").randomUUID().replace(/-/g, "").substring(0, 25),
          organizationId: orgId,
          name,
          phone: phone || undefined,
          email: email || undefined,
          company: company || undefined,
          city: city || undefined,
          source,
          status: "NEW",
          campaignId: campaignId || undefined,
          assignedToId: assignedToId || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (toCreate.length > 0) {
        await db().lead.createMany({ data: toCreate, skipDuplicates: true });
        results.created += toCreate.length;
      }
    }

    bustCache(req.organizationId!, "/api/leads");
    ok(res, results);
  } catch (e) { serverError(res, e); }
}

// ── Convert lead to deal ──────────────────────────────────────
export async function convertLeadToDeal(req: OrgRequest, res: Response): Promise<void> {
  try {
    const lead = await db().lead.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!lead) { notFound(res, "Lead not found"); return; }

    const deal = await db().deal.create({
      data: {
        organizationId: req.organizationId!,
        title: `${lead.name}${lead.company ? ` — ${lead.company}` : ""}`,
        stage: "QUALIFICATION",
        value: lead.value ?? 0,
        probability: 20,
        partyId: lead.partyId ?? undefined,
        description: lead.notes ?? undefined,
        expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await db().lead.update({ where: { id: req.params.id as string }, data: { status: "WON", convertedAt: new Date() } });

    ok(res, { deal, message: "Lead converted to deal" });
  } catch (e) { serverError(res, e); }
}

// ── Stats ─────────────────────────────────────────────────────
export async function getLeadStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    // White Band Associates: a lead is overdue past its follow-up date, or — when
    // no follow-up date was set — 48h after last contact (or creation). Leads
    // explicitly marked "no follow-up needed" are never overdue.
    const wba = await isWBAOrgId(orgId);
    const cutoff = new Date(now.getTime() - LEAD_DEFAULT_FOLLOWUP_MS);
    const overdueWhere = wba
      ? {
          organizationId: orgId,
          status: { notIn: ["WON", "LOST"] },
          noFollowUp: false,
          OR: [
            { nextFollowUpDate: { lt: now } },
            { nextFollowUpDate: null, lastContactedAt: { lt: cutoff } },
            { nextFollowUpDate: null, lastContactedAt: null, createdAt: { lt: cutoff } },
          ],
        }
      : { organizationId: orgId, nextFollowUpDate: { lt: startOfDay }, status: { notIn: ["WON", "LOST"] } };

    const [total, won, lost, byStatus, bySource, pipeline, todayFollowUps, overdue, myQueue] = await Promise.all([
      db().lead.count({ where: { organizationId: orgId } }),
      db().lead.count({ where: { organizationId: orgId, status: "WON" } }),
      db().lead.count({ where: { organizationId: orgId, status: "LOST" } }),
      db().lead.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: true }),
      db().lead.groupBy({ by: ["source"], where: { organizationId: orgId }, _count: true }),
      db().lead.aggregate({ where: { organizationId: orgId, status: { notIn: ["WON", "LOST"] } }, _sum: { value: true } }),
      db().lead.count({ where: { organizationId: orgId, nextFollowUpDate: { gte: startOfDay, lt: endOfDay }, status: { notIn: ["WON", "LOST"] } } }),
      db().lead.count({ where: overdueWhere }),
      db().lead.count({ where: { organizationId: orgId, assignedToId: req.userId, status: { notIn: ["WON", "LOST"] } } }),
    ]);

    const convRate = total > 0 ? Math.round((won / total) * 100) : 0;
    ok(res, { total, won, lost, pipeline: pipeline._sum.value || 0, byStatus, bySource, convRate, todayFollowUps, overdue, myQueue });
  } catch (e) { serverError(res, e); }
}

// ── Campaigns ─────────────────────────────────────────────────
export async function listCampaigns(req: OrgRequest, res: Response): Promise<void> {
  try {
    const campaigns = await db().campaign.findMany({
      where: { organizationId: req.organizationId! },
      include: { _count: { select: { leads: true } } },
      orderBy: { createdAt: "desc" },
    });
    ok(res, campaigns);
  } catch (e) { serverError(res, e); }
}

export async function createCampaign(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = campaignSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const campaign = await db().campaign.create({
      data: {
        ...data.data,
        organizationId: req.organizationId!,
        startDate: data.data.startDate ? new Date(data.data.startDate) : undefined,
        endDate: data.data.endDate ? new Date(data.data.endDate) : undefined,
      },
    });
    created(res, campaign);
  } catch (e) { serverError(res, e); }
}

// ── Internal: fire automation rules ──────────────────────────
async function fireAutomationRules(orgId: string, trigger: string, triggerValue: string, leadId: string) {
  const rules = await db().leadAutomationRule.findMany({
    where: { organizationId: orgId, isActive: true, trigger, triggerValue },
  });

  for (const rule of rules) {
    try {
      const cfg = rule.actionConfig as any;
      if (rule.actionType === "create_followup") {
        const followUpDate = new Date(Date.now() + (cfg.daysAhead ?? 1) * 86400000);
        await db().leadActivity.create({
          data: {
            leadId,
            type: "NOTE",
            subject: cfg.subject ?? "Auto Follow-up",
            description: cfg.message ?? `Auto follow-up scheduled by rule: ${rule.name}`,
            followUpDate,
          },
        });
        await db().lead.update({ where: { id: leadId }, data: { nextFollowUpDate: followUpDate } });
      } else if (rule.actionType === "add_tag") {
        const lead = await db().lead.findUnique({ where: { id: leadId } });
        if (lead && cfg.tag && !lead.tags.includes(cfg.tag)) {
          await db().lead.update({ where: { id: leadId }, data: { tags: { push: cfg.tag } } });
        }
      } else if (rule.actionType === "update_grade") {
        await db().lead.update({ where: { id: leadId }, data: { leadGrade: cfg.grade } });
      } else if (rule.actionType === "assign_to") {
        await db().lead.update({ where: { id: leadId }, data: { assignedToId: cfg.userId } });
      }
      await db().leadAutomationRule.update({ where: { id: rule.id }, data: { executionCount: { increment: 1 } } });
    } catch {}
  }
}
