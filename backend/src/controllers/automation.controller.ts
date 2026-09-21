import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const db = () => (prisma as any);

const ruleSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().default(true),
  trigger: z.enum(["status_changed", "lead_created", "tag_added", "score_above", "follow_up_due"]),
  triggerValue: z.string().optional(),
  actionType: z.enum(["create_followup", "add_tag", "update_grade", "assign_to", "send_notification", "update_status"]),
  actionConfig: z.record(z.string(), z.any()).default({}),
});

// ── List rules ────────────────────────────────────────────────
export async function listRules(req: OrgRequest, res: Response): Promise<void> {
  try {
    const rules = await db().leadAutomationRule.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { createdAt: "desc" },
    });
    ok(res, rules);
  } catch (e) { serverError(res, e); }
}

// ── Create rule ───────────────────────────────────────────────
export async function createRule(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = ruleSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const rule = await db().leadAutomationRule.create({
      data: {
        id: require("crypto").randomUUID().replace(/-/g, "").substring(0, 25),
        organizationId: req.organizationId!,
        ...data.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    created(res, rule);
  } catch (e) { serverError(res, e); }
}

// ── Update rule ───────────────────────────────────────────────
export async function updateRule(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = ruleSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const existing = await db().leadAutomationRule.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Rule not found"); return; }

    const rule = await db().leadAutomationRule.update({
      where: { id: req.params.id as string },
      data: { ...data.data, updatedAt: new Date() },
    });
    ok(res, rule);
  } catch (e) { serverError(res, e); }
}

// ── Delete rule ───────────────────────────────────────────────
export async function deleteRule(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().leadAutomationRule.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Rule not found"); return; }
    await db().leadAutomationRule.delete({ where: { id: req.params.id as string } });
    ok(res, { deleted: true });
  } catch (e) { serverError(res, e); }
}

// ── Toggle active ─────────────────────────────────────────────
export async function toggleRule(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().leadAutomationRule.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Rule not found"); return; }
    const rule = await db().leadAutomationRule.update({ where: { id: req.params.id as string }, data: { isActive: !existing.isActive, updatedAt: new Date() } });
    ok(res, rule);
  } catch (e) { serverError(res, e); }
}
