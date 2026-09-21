import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const db = () => (prisma as any);

// ═══════════════════════════════════════════════════════════════
//  GRANULAR PERMISSIONS
// ═══════════════════════════════════════════════════════════════

const VALID_ACTIONS = ["view", "edit", "delete", "export"];

const permSchema = z.object({
  userId: z.string(),
  moduleKey: z.string(),
  actions: z.array(z.enum(["view", "edit", "delete", "export"])),
});

export async function listPermissions(req: OrgRequest, res: Response): Promise<void> {
  try {
    const perms = await db().orgPermission.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { createdAt: "desc" },
    });
    ok(res, perms);
  } catch (e) { serverError(res, e); }
}

export async function setPermission(req: OrgRequest, res: Response): Promise<void> {
  try {
    const d = permSchema.safeParse(req.body);
    if (!d.success) { badRequest(res, "Invalid permission data"); return; }

    const perm = await db().orgPermission.upsert({
      where: { organizationId_userId_moduleKey: { organizationId: req.organizationId!, userId: d.data.userId, moduleKey: d.data.moduleKey } },
      create: { organizationId: req.organizationId!, userId: d.data.userId, moduleKey: d.data.moduleKey, actions: d.data.actions, grantedById: req.userId },
      update: { actions: d.data.actions, updatedAt: new Date() },
    });
    ok(res, perm);
  } catch (e) { serverError(res, e); }
}

export async function deletePermission(req: OrgRequest, res: Response): Promise<void> {
  try {
    await db().orgPermission.deleteMany({ where: { id: req.params.id, organizationId: req.organizationId! } });
    ok(res, null, "Permission removed");
  } catch (e) { serverError(res, e); }
}

// ── Middleware: check action permission ───────────────────────
export function requireAction(moduleKey: string, action: string) {
  return async (req: OrgRequest, res: Response, next: Function) => {
    try {
      // OWNER/ADMIN bypass — they have all permissions
      const member = await prisma.organizationMember.findFirst({
        where: { userId: req.userId!, organizationId: req.organizationId!, isActive: true },
        select: { role: true },
      });
      if (member?.role === "OWNER" || member?.role === "ADMIN") { next(); return; }

      const perm = await db().orgPermission.findFirst({
        where: { userId: req.userId!, organizationId: req.organizationId!, moduleKey },
      });
      if (perm?.actions?.includes(action)) { next(); return; }

      res.status(403).json({ success: false, message: `You don't have permission to ${action} ${moduleKey}` });
    } catch { next(); }
  };
}

// ═══════════════════════════════════════════════════════════════
//  IP ALLOWLIST
// ═══════════════════════════════════════════════════════════════

const ipSchema = z.object({
  ipCidr: z.string().min(7),
  label: z.string().optional(),
});

export async function listIpAllowlist(req: OrgRequest, res: Response): Promise<void> {
  try {
    const list = await db().orgIpAllowlist.findMany({ where: { organizationId: req.organizationId! }, orderBy: { createdAt: "desc" } });
    ok(res, list);
  } catch (e) { serverError(res, e); }
}

export async function addIpAllowlist(req: OrgRequest, res: Response): Promise<void> {
  try {
    const d = ipSchema.safeParse(req.body);
    if (!d.success) { badRequest(res, "Invalid IP/CIDR"); return; }
    const entry = await db().orgIpAllowlist.create({
      data: { organizationId: req.organizationId!, ipCidr: d.data.ipCidr, label: d.data.label || null },
    });
    created(res, entry);
  } catch (e) { serverError(res, e); }
}

export async function removeIpAllowlist(req: OrgRequest, res: Response): Promise<void> {
  try {
    await db().orgIpAllowlist.deleteMany({ where: { id: req.params.id, organizationId: req.organizationId! } });
    ok(res, null, "IP removed from allowlist");
  } catch (e) { serverError(res, e); }
}

// ── Middleware: IP allowlist check ────────────────────────────
export function checkIpAllowlist() {
  return async (req: OrgRequest, res: Response, next: Function) => {
    try {
      if (!req.organizationId) { next(); return; }
      const allowlist = await db().orgIpAllowlist.findMany({ where: { organizationId: req.organizationId } });
      if (!allowlist.length) { next(); return; } // No list = allow all

      const clientIp = ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim() || req.socket.remoteAddress || "";
      const allowed = allowlist.some((entry: any) => {
        const cidr = entry.ipCidr;
        if (!cidr.includes("/")) return clientIp === cidr; // exact match
        // Basic CIDR check (IPv4)
        const [base, bits] = cidr.split("/");
        const mask = ~(0xffffffff >>> parseInt(bits));
        const ipNum = (ip: string) => ip.split(".").reduce((n, o) => (n << 8) + parseInt(o), 0);
        try { return (ipNum(clientIp) & mask) === (ipNum(base) & mask); } catch { return false; }
      });

      if (!allowed) {
        res.status(403).json({ success: false, message: "Access denied: your IP is not on this organization's allowlist" });
        return;
      }
      next();
    } catch { next(); }
  };
}

// ═══════════════════════════════════════════════════════════════
//  SECURITY DASHBOARD — overview stats
// ═══════════════════════════════════════════════════════════════

export async function getSecurityOverview(req: OrgRequest, res: Response): Promise<void> {
  try {
    const [members, lockedUsers, recentAudit, ipList, apiKeys, perms] = await Promise.all([
      prisma.organizationMember.count({ where: { organizationId: req.organizationId!, isActive: true } }),
      (prisma as any).user.count({ where: { lockedUntil: { gt: new Date() } } }),
      prisma.auditLog.findMany({ where: { organizationId: req.organizationId! }, orderBy: { createdAt: "desc" }, take: 5, select: { action: true, resource: true, userName: true, createdAt: true, ipAddress: true } }),
      db().orgIpAllowlist.count({ where: { organizationId: req.organizationId! } }),
      db().apiKey.count({ where: { organizationId: req.organizationId!, isActive: true } }),
      db().orgPermission.count({ where: { organizationId: req.organizationId! } }),
    ]);

    ok(res, { members, lockedUsers, activeApiKeys: apiKeys, ipAllowlistRules: ipList, customPermissions: perms, recentAudit });
  } catch (e) { serverError(res, e); }
}
