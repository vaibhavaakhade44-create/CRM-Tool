import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";
import axios from "axios";

const db = () => (prisma as any);

const WA_API_BASE = "https://graph.facebook.com/v19.0";

// ── Helper: get org WhatsApp config ──────────────────────────
async function getConfig(organizationId: string) {
  return db().whatsAppConfig.findUnique({ where: { organizationId } });
}

// ── Helper: send via Cloud API ────────────────────────────────
async function sendViaApi(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  body: object
) {
  const phone = to.replace(/\D/g, "");
  const normalized = phone.startsWith("91") ? phone : `91${phone}`;
  const res = await axios.post(
    `${WA_API_BASE}/${phoneNumberId}/messages`,
    { messaging_product: "whatsapp", recipient_type: "individual", to: normalized, ...body },
    { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
  );
  return res.data;
}

// ── Get / save config ─────────────────────────────────────────
export async function getWhatsAppConfig(req: OrgRequest, res: Response): Promise<void> {
  try {
    const config = await getConfig(req.organizationId!);
    if (!config) { ok(res, { connected: false }); return; }
    ok(res, {
      connected: true,
      phoneNumber: config.phoneNumber,
      displayName: config.displayName,
      isActive: config.isActive,
    });
  } catch (e) { serverError(res, e); }
}

const configSchema = z.object({
  phoneNumberId: z.string().min(1),
  accessToken: z.string().min(1),
  businessId: z.string().optional(),
  wabaId: z.string().optional(),
  phoneNumber: z.string().optional(),
  displayName: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
});

export async function saveWhatsAppConfig(req: OrgRequest, res: Response): Promise<void> {
  try {
    const d = configSchema.safeParse(req.body);
    if (!d.success) { badRequest(res, "Invalid config", d.error.flatten()); return; }
    const config = await db().whatsAppConfig.upsert({
      where: { organizationId: req.organizationId! },
      create: { organizationId: req.organizationId!, ...d.data, webhookVerifyToken: d.data.webhookVerifyToken || "" },
      update: { ...d.data, updatedAt: new Date() },
    });
    ok(res, { connected: true, phoneNumber: config.phoneNumber, displayName: config.displayName });
  } catch (e) { serverError(res, e); }
}

export async function disconnectWhatsApp(req: OrgRequest, res: Response): Promise<void> {
  try {
    await db().whatsAppConfig.deleteMany({ where: { organizationId: req.organizationId! } });
    ok(res, { disconnected: true });
  } catch (e) { serverError(res, e); }
}

// ── Send text message ─────────────────────────────────────────
const sendSchema = z.object({
  to: z.string().min(7),
  message: z.string().min(1),
  leadId: z.string().optional(),
  partyId: z.string().optional(),
});

export async function sendMessage(req: OrgRequest, res: Response): Promise<void> {
  try {
    const d = sendSchema.safeParse(req.body);
    if (!d.success) { badRequest(res, "Invalid payload", d.error.flatten()); return; }

    const config = await getConfig(req.organizationId!);
    if (!config) { badRequest(res, "WhatsApp not configured"); return; }

    let waMessageId: string | undefined;
    let status = "SENT";
    let errorMessage: string | undefined;

    try {
      const result = await sendViaApi(config.phoneNumberId, config.accessToken, d.data.to, {
        type: "text",
        text: { body: d.data.message, preview_url: false },
      });
      waMessageId = result?.messages?.[0]?.id;
    } catch (err: any) {
      status = "FAILED";
      errorMessage = err?.response?.data?.error?.message || err.message;
    }

    const msg = await db().whatsAppMessage.create({
      data: {
        organizationId: req.organizationId!,
        leadId: d.data.leadId || null,
        partyId: d.data.partyId || null,
        direction: "OUTBOUND",
        toPhone: d.data.to,
        fromPhone: config.phoneNumber || null,
        type: "text",
        content: d.data.message,
        status,
        waMessageId: waMessageId || null,
        errorMessage: errorMessage || null,
        sentById: req.userId || null,
      },
    });

    if (status === "FAILED") {
      res.status(422).json({ success: false, message: errorMessage, log: msg });
      return;
    }
    created(res, msg);
  } catch (e) { serverError(res, e); }
}

// ── Send template message ─────────────────────────────────────
const templateSchema = z.object({
  to: z.string().min(7),
  templateName: z.string().min(1),
  languageCode: z.string().default("en"),
  components: z.array(z.any()).optional(),
  leadId: z.string().optional(),
  partyId: z.string().optional(),
});

export async function sendTemplate(req: OrgRequest, res: Response): Promise<void> {
  try {
    const d = templateSchema.safeParse(req.body);
    if (!d.success) { badRequest(res, "Invalid payload", d.error.flatten()); return; }

    const config = await getConfig(req.organizationId!);
    if (!config) { badRequest(res, "WhatsApp not configured"); return; }

    let waMessageId: string | undefined;
    let status = "SENT";
    let errorMessage: string | undefined;

    try {
      const result = await sendViaApi(config.phoneNumberId, config.accessToken, d.data.to, {
        type: "template",
        template: {
          name: d.data.templateName,
          language: { code: d.data.languageCode },
          components: d.data.components || [],
        },
      });
      waMessageId = result?.messages?.[0]?.id;
    } catch (err: any) {
      status = "FAILED";
      errorMessage = err?.response?.data?.error?.message || err.message;
    }

    const msg = await db().whatsAppMessage.create({
      data: {
        organizationId: req.organizationId!,
        leadId: d.data.leadId || null,
        partyId: d.data.partyId || null,
        direction: "OUTBOUND",
        toPhone: d.data.to,
        fromPhone: config.phoneNumber || null,
        type: "template",
        content: `[Template: ${d.data.templateName}]`,
        templateName: d.data.templateName,
        status,
        waMessageId: waMessageId || null,
        errorMessage: errorMessage || null,
        sentById: req.userId || null,
      },
    });

    if (status === "FAILED") {
      res.status(422).json({ success: false, message: errorMessage, log: msg });
      return;
    }
    created(res, msg);
  } catch (e) { serverError(res, e); }
}

// ── Bulk send to leads ────────────────────────────────────────
const bulkSchema = z.object({
  leadIds: z.array(z.string()).min(1).max(100),
  message: z.string().min(1).optional(),
  templateName: z.string().optional(),
  languageCode: z.string().default("en"),
});

export async function bulkSend(req: OrgRequest, res: Response): Promise<void> {
  try {
    const d = bulkSchema.safeParse(req.body);
    if (!d.success) { badRequest(res, "Invalid payload", d.error.flatten()); return; }
    if (!d.data.message && !d.data.templateName) { badRequest(res, "message or templateName required"); return; }

    const config = await getConfig(req.organizationId!);
    if (!config) { badRequest(res, "WhatsApp not configured"); return; }

    const leads = await db().lead.findMany({
      where: { id: { in: d.data.leadIds }, organizationId: req.organizationId!, isDoNotCall: false },
      select: { id: true, phone: true, name: true },
    });

    let sent = 0, failed = 0, skipped = 0;

    for (const lead of leads) {
      if (!lead.phone) { skipped++; continue; }
      try {
        const body = d.data.message
          ? { type: "text", text: { body: d.data.message, preview_url: false } }
          : { type: "template", template: { name: d.data.templateName!, language: { code: d.data.languageCode }, components: [] } };

        const result = await sendViaApi(config.phoneNumberId, config.accessToken, lead.phone, body);
        await db().whatsAppMessage.create({
          data: {
            organizationId: req.organizationId!,
            leadId: lead.id,
            direction: "OUTBOUND",
            toPhone: lead.phone,
            fromPhone: config.phoneNumber || null,
            type: d.data.message ? "text" : "template",
            content: d.data.message || `[Template: ${d.data.templateName}]`,
            templateName: d.data.templateName || null,
            status: "SENT",
            waMessageId: result?.messages?.[0]?.id || null,
            sentById: req.userId || null,
          },
        });
        sent++;
      } catch { failed++; }
    }

    ok(res, { sent, failed, skipped, total: leads.length });
  } catch (e) { serverError(res, e); }
}

// ── List message history ──────────────────────────────────────
export async function listMessages(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { leadId, partyId, page = "1" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * 50;
    const where: any = { organizationId: req.organizationId! };
    if (leadId) where.leadId = leadId;
    if (partyId) where.partyId = partyId;

    const [messages, total] = await Promise.all([
      db().whatsAppMessage.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip }),
      db().whatsAppMessage.count({ where }),
    ]);
    ok(res, { messages, total, page: parseInt(page) });
  } catch (e) { serverError(res, e); }
}

// ── Webhook verification (GET) ────────────────────────────────
export async function verifyWebhook(req: Request, res: Response): Promise<void> {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
}

// ── Webhook events (POST) — incoming messages ─────────────────
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    res.sendStatus(200);
    const body = req.body;
    if (body?.object !== "whatsapp_business_account") return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value?.messages) continue;
        for (const msg of value.messages) {
          const from = msg.from;
          const text = msg.text?.body || msg.type || "";

          // Find org by phone number ID
          const config = await db().whatsAppConfig.findFirst({
            where: { phoneNumberId: value.metadata?.phone_number_id },
          });
          if (!config) continue;

          // Find lead by phone
          const lead = await db().lead.findFirst({
            where: { organizationId: config.organizationId, phone: { contains: from.slice(-10) } },
            select: { id: true },
          });

          await db().whatsAppMessage.create({
            data: {
              organizationId: config.organizationId,
              leadId: lead?.id || null,
              direction: "INBOUND",
              toPhone: value.metadata?.display_phone_number || "",
              fromPhone: from,
              type: msg.type || "text",
              content: text,
              status: "RECEIVED",
              waMessageId: msg.id,
            },
          });
        }
      }
    }
  } catch (e) {
    console.error("[WA Webhook]", e);
    res.sendStatus(200);
  }
}

// ── Get templates from Meta ───────────────────────────────────
export async function getTemplates(req: OrgRequest, res: Response): Promise<void> {
  try {
    const config = await getConfig(req.organizationId!);
    if (!config) { badRequest(res, "WhatsApp not configured"); return; }
    if (!config.wabaId) { ok(res, { templates: [] }); return; }

    const r = await axios.get(
      `${WA_API_BASE}/${config.wabaId}/message_templates?fields=name,status,language,components&limit=50`,
      { headers: { Authorization: `Bearer ${config.accessToken}` } }
    );
    ok(res, { templates: r.data?.data || [] });
  } catch (e: any) {
    ok(res, { templates: [], error: e?.response?.data?.error?.message });
  }
}
