import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";
import crypto from "crypto";

const db = () => (prisma as any);

const VALID_SCOPES = ["leads:read", "leads:write", "crm:read", "crm:write", "inventory:read", "finance:read", "all:read"];

const keySchema = z.object({
  name: z.string().min(1).max(60),
  scopes: z.array(z.string()).default(["all:read"]),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

// ── Generate key ──────────────────────────────────────────────
export async function createApiKey(req: OrgRequest, res: Response): Promise<void> {
  try {
    const d = keySchema.safeParse(req.body);
    if (!d.success) { badRequest(res, "Invalid data"); return; }

    const invalidScopes = d.data.scopes.filter(s => !VALID_SCOPES.includes(s));
    if (invalidScopes.length) { badRequest(res, `Invalid scopes: ${invalidScopes.join(", ")}`); return; }

    // Generate key: fcrm_<prefix8>_<random32>
    const rawKey = `fcrm_${crypto.randomBytes(4).toString("hex")}_${crypto.randomBytes(16).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.substring(0, 16);

    const expiresAt = d.data.expiresInDays
      ? new Date(Date.now() + d.data.expiresInDays * 86400000)
      : null;

    const apiKey = await db().apiKey.create({
      data: {
        organizationId: req.organizationId!,
        userId: req.userId!,
        name: d.data.name,
        keyHash,
        keyPrefix,
        scopes: d.data.scopes,
        expiresAt,
      },
    });

    // Return the raw key ONCE — never stored again
    created(res, {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      keyPrefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    }, "API key created. Copy it now — it won't be shown again.");
  } catch (e) { serverError(res, e); }
}

// ── List keys (no raw keys) ───────────────────────────────────
export async function listApiKeys(req: OrgRequest, res: Response): Promise<void> {
  try {
    const keys = await db().apiKey.findMany({
      where: { organizationId: req.organizationId!, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, keyPrefix: true, scopes: true, lastUsedAt: true, expiresAt: true, createdAt: true, isActive: true },
    });
    ok(res, keys);
  } catch (e) { serverError(res, e); }
}

// ── Revoke key ────────────────────────────────────────────────
export async function revokeApiKey(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().apiKey.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "API key not found"); return; }
    await db().apiKey.update({ where: { id: req.params.id }, data: { isActive: false } });
    ok(res, null, "API key revoked");
  } catch (e) { serverError(res, e); }
}

// ── Middleware: authenticate via API key ──────────────────────
export async function apiKeyAuth(req: any, res: Response, next: Function): Promise<void> {
  const authHeader = req.headers["authorization"] as string;
  if (!authHeader?.startsWith("ApiKey ")) { next(); return; }

  const rawKey = authHeader.slice(7).trim();
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  try {
    const apiKey = await db().apiKey.findFirst({
      where: { keyHash, isActive: true },
      include: { organization: true },
    });

    if (!apiKey) { res.status(401).json({ success: false, message: "Invalid API key" }); return; }
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      res.status(401).json({ success: false, message: "API key expired" }); return;
    }

    // Update last used
    db().apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

    req.userId = apiKey.userId;
    req.organizationId = apiKey.organizationId;
    req.apiKeyScopes = apiKey.scopes;
    next();
  } catch { res.status(500).json({ success: false, message: "API key validation failed" }); }
}

// ── List valid scopes ─────────────────────────────────────────
export async function getScopes(_req: AuthRequest, res: Response): Promise<void> {
  ok(res, VALID_SCOPES);
}
