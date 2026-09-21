import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, notFound, badRequest, serverError } from "../utils/response";
import crypto from "crypto";
import https from "https";
import http from "http";
import dns from "dns";
import net from "net";

const db = () => (prisma as any);

// ── SSRF guard ──────────────────────────────────────────────
// Blocks webhook URLs that resolve to private/internal/reserved IP ranges
// (RFC1918, loopback, link-local incl. cloud metadata 169.254.169.254, etc.)
// so a malicious/compromised org admin can't use webhooks to probe the
// hosting infrastructure's internal network or steal cloud credentials.
export function isBlockedIP(ip: string): boolean {
  const type = net.isIP(ip);
  if (type === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127) return true;                          // loopback
    if (a === 10) return true;                            // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;      // 172.16.0.0/12
    if (a === 192 && b === 168) return true;               // 192.168.0.0/16
    if (a === 169 && b === 254) return true;               // link-local / cloud metadata
    if (a === 0) return true;                              // 0.0.0.0/8
    return false;
  }
  if (type === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;                      // loopback
    if (lower.startsWith("fe80:")) return true;             // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("::ffff:")) return isBlockedIP(lower.replace("::ffff:", "")); // IPv4-mapped
    return false;
  }
  return true; // not a valid IP at all — reject
}

async function assertPublicUrl(url: string): Promise<void> {
  await resolvePinnedIp(url);
}

// Resolve the hostname, validate EVERY answer, and return a single pinned IP to
// connect to. Callers must connect to this exact IP (not re-resolve the name),
// which closes the DNS-rebinding TOCTOU: without pinning, the name could resolve
// to a public IP during validation and to 169.254.169.254 during the request.
export async function resolvePinnedIp(url: string): Promise<{ ip: string; family: number; hostname: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https webhook URLs are allowed");
  }
  if (parsed.port && !["", "80", "443", "8443"].includes(parsed.port)) {
    throw new Error("Webhook URL port not allowed");
  }
  if (parsed.hostname === "localhost") throw new Error("Webhook URL resolves to a blocked address");
  const addresses = await dns.promises.lookup(parsed.hostname, { all: true });
  if (!addresses.length) throw new Error("Webhook URL does not resolve");
  for (const { address } of addresses) {
    if (isBlockedIP(address)) throw new Error("Webhook URL resolves to a blocked address");
  }
  return { ip: addresses[0].address, family: addresses[0].family, hostname: parsed.hostname };
}

// Supported webhook events
export const WEBHOOK_EVENTS = [
  "invoice.created",
  "invoice.paid",
  "invoice.cancelled",
  "payment.received",
  "contact.created",
  "contact.updated",
  "purchase_order.created",
  "purchase_order.approved",
  "lead.created",
  "lead.converted",
  "stock.low",
  "work_order.completed",
];

// ── List webhook endpoints ────────────────────────────────────
export async function listWebhooks(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const webhooks = await db().webhookEndpoint.findMany({
      where: { organizationId: orgId },
      include: {
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, event: true, success: true, statusCode: true, createdAt: true },
        },
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    ok(res, { webhooks, events: WEBHOOK_EVENTS });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Create webhook endpoint ───────────────────────────────────
export async function createWebhook(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { url, events, description } = req.body as {
      url: string;
      events: string[];
      description?: string;
    };

    if (!url || !events?.length) {
      badRequest(res, "url and events[] required");
      return;
    }
    try { await assertPublicUrl(url); } catch (e) {
      badRequest(res, e instanceof Error ? e.message : "Invalid URL");
      return;
    }

    const invalid = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e));
    if (invalid.length) {
      badRequest(res, `Unknown events: ${invalid.join(", ")}`);
      return;
    }

    const secret = crypto.randomBytes(20).toString("hex");
    const webhook = await db().webhookEndpoint.create({
      data: { organizationId: orgId, url, events, secret, description: description ?? null },
    });

    created(res, webhook);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Update webhook endpoint ───────────────────────────────────
export async function updateWebhook(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id;
    const { url, events, description, isActive } = req.body as {
      url?: string;
      events?: string[];
      description?: string;
      isActive?: boolean;
    };

    const existing = await db().webhookEndpoint.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Webhook not found"); return; }

    if (url) {
      try { await assertPublicUrl(url); } catch (e) {
        badRequest(res, e instanceof Error ? e.message : "Invalid URL");
        return;
      }
    }
    if (events) {
      const invalid = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e));
      if (invalid.length) { badRequest(res, `Unknown events: ${invalid.join(", ")}`); return; }
    }

    const updated = await db().webhookEndpoint.update({
      where: { id },
      data: {
        ...(url !== undefined && { url }),
        ...(events !== undefined && { events }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    ok(res, updated);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Delete webhook endpoint ───────────────────────────────────
export async function deleteWebhook(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id;

    const existing = await db().webhookEndpoint.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Webhook not found"); return; }

    await db().webhookEndpoint.delete({ where: { id } });
    ok(res, { deleted: true });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Rotate secret ─────────────────────────────────────────────
export async function rotateSecret(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id;

    const existing = await db().webhookEndpoint.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) { notFound(res, "Webhook not found"); return; }

    const secret = crypto.randomBytes(20).toString("hex");
    const updated = await db().webhookEndpoint.update({ where: { id }, data: { secret } });
    ok(res, { secret: updated.secret });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Test webhook (send a ping) ────────────────────────────────
export async function testWebhook(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id;

    const webhook = await db().webhookEndpoint.findFirst({ where: { id, organizationId: orgId } });
    if (!webhook) { notFound(res, "Webhook not found"); return; }

    const payload = { event: "ping", timestamp: new Date().toISOString(), data: { message: "Test ping from BusinessOS" } };
    const result = await dispatchWebhook(webhook.url, webhook.secret, payload);

    // Record delivery
    await db().webhookDelivery.create({
      data: {
        webhookId: id,
        event: "ping",
        payload,
        statusCode: result.statusCode,
        success: result.success,
        attempts: 1,
        responseBody: result.body?.slice(0, 500),
        deliveredAt: new Date(),
      },
    });

    ok(res, { success: result.success, statusCode: result.statusCode });
  } catch (err) {
    serverError(res, err);
  }
}

// ── List delivery history ─────────────────────────────────────
export async function listDeliveries(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id;

    const webhook = await db().webhookEndpoint.findFirst({ where: { id, organizationId: orgId } });
    if (!webhook) { notFound(res, "Webhook not found"); return; }

    const deliveries = await db().webhookDelivery.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    ok(res, deliveries);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Internal dispatcher (used by other controllers/cron) ──────
export async function dispatchWebhook(
  url: string,
  secret: string,
  payload: object
): Promise<{ success: boolean; statusCode: number | null; body: string }> {
  // Resolve + validate the hostname NOW and connect to that exact IP. The
  // hostname could have been re-pointed at an internal IP since the webhook was
  // created; pinning the validated IP for the connection closes the rebinding
  // race that a plain re-validate-then-reconnect still leaves open.
  let pin: { ip: string; family: number; hostname: string };
  try {
    pin = await resolvePinnedIp(url);
  } catch {
    return { success: false, statusCode: null, body: "Blocked: webhook URL resolves to a disallowed address" };
  }

  const body = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const MAX_RESP_BYTES = 64 * 1024;

  return new Promise((resolve) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : http;

    const req = lib.request(
      {
        host: pin.ip,                       // connect to the validated IP, not the name
        servername: isHttps ? pin.hostname : undefined, // keep TLS SNI/cert check on the real host
        port: parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "POST",
        // Force the socket to the pinned IP — defeats any re-resolution.
        lookup: (_h: string, _o: unknown, cb: (e: Error | null, a: string, f: number) => void) => cb(null, pin.ip, pin.family),
        headers: {
          Host: parsed.host,               // correct virtual-host routing on the target
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-BusinessOS-Signature": `sha256=${sig}`,
          "X-BusinessOS-Event": (payload as any).event ?? "unknown",
          "User-Agent": "BusinessOS-Webhooks/1.0",
        },
        timeout: 10000,
      },
      (res) => {
        let data = "";
        let bytes = 0;
        res.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes <= MAX_RESP_BYTES) data += chunk;
          else req.destroy();
        });
        res.on("end", () => resolve({ success: (res.statusCode ?? 0) < 300, statusCode: res.statusCode ?? null, body: data }));
      }
    );

    req.on("error", () => resolve({ success: false, statusCode: null, body: "Connection error" }));
    req.on("timeout", () => { req.destroy(); resolve({ success: false, statusCode: null, body: "Timeout" }); });
    req.write(body);
    req.end();
  });
}

// ── Fire event to all matching org webhooks (internal utility) ─
export async function fireEvent(organizationId: string, event: string, data: object): Promise<void> {
  try {
    const endpoints = await db().webhookEndpoint.findMany({
      where: { organizationId, isActive: true, events: { has: event } },
    });

    for (const ep of endpoints) {
      const payload = { event, timestamp: new Date().toISOString(), data };
      const result = await dispatchWebhook(ep.url, ep.secret, payload);
      await db().webhookDelivery.create({
        data: {
          webhookId: ep.id,
          event,
          payload,
          statusCode: result.statusCode,
          success: result.success,
          attempts: 1,
          responseBody: result.body?.slice(0, 500),
          deliveredAt: new Date(),
        },
      });
    }
  } catch {
    // non-fatal — webhook delivery failure should not break primary request
  }
}
