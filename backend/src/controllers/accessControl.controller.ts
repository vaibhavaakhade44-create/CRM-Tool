import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, badRequest, notFound, forbidden, serverError } from "../utils/response";
import { MemberRole } from "@prisma/client";

const ADMIN_ROLES: MemberRole[] = [MemberRole.OWNER, MemberRole.ADMIN];

// ── Get current user's module access in this org ─────────────
export async function getMyModuleAccess(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const userId = req.userId!;
    const role = req.memberRole!;

    // OWNER and ADMIN have access to all enabled org modules
    if (ADMIN_ROLES.includes(role)) {
      const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { enabledModules: true } });
      ok(res, { moduleKeys: org?.enabledModules ?? [], role, isAdmin: true });
      return;
    }

    const access = await prisma.userModuleAccess.findMany({
      where: { userId, organizationId: orgId },
      select: { moduleKey: true },
    });
    ok(res, { moduleKeys: access.map((a) => a.moduleKey), role, isAdmin: false });
  } catch (e) { serverError(res, e); }
}

// ── Request access to a module ────────────────────────────────
export async function requestModuleAccess(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const userId = req.userId!;
    const { moduleKey, message } = req.body;
    if (!moduleKey) { badRequest(res, "moduleKey required"); return; }

    // Check if already has access
    const existing = await prisma.userModuleAccess.findUnique({
      where: { userId_organizationId_moduleKey: { userId, organizationId: orgId, moduleKey } },
    });
    if (existing) { badRequest(res, "You already have access to this module"); return; }

    // Upsert request (update existing DENIED to re-request)
    const request = await prisma.accessRequest.upsert({
      where: { userId_organizationId_moduleKey: { userId, organizationId: orgId, moduleKey } },
      update: { status: "PENDING", message: message || null, requestedAt: new Date(), resolvedAt: null, resolvedById: null, responseNote: null },
      create: { userId, organizationId: orgId, moduleKey, message: message || null },
    });
    created(res, request, "Access request submitted");
  } catch (e) { serverError(res, e); }
}

// ── Get pending requests (admin only) ────────────────────────
export async function listAccessRequests(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (!ADMIN_ROLES.includes(req.memberRole!)) { forbidden(res, "Admin access required"); return; }
    const orgId = req.organizationId!;
    const status = (req.query.status as string) || "PENDING";

    const requests = await prisma.accessRequest.findMany({
      where: { organizationId: orgId, status: status as any },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { requestedAt: "desc" },
    });
    ok(res, { requests });
  } catch (e) { serverError(res, e); }
}

// ── Approve or deny a request (admin only) ───────────────────
export async function resolveAccessRequest(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (!ADMIN_ROLES.includes(req.memberRole!)) { forbidden(res, "Admin access required"); return; }
    const id = req.params.id as string;
    const { action, responseNote } = req.body; // action: "APPROVE" | "DENY"
    if (!["APPROVE", "DENY"].includes(action)) { badRequest(res, "action must be APPROVE or DENY"); return; }

    const request = await prisma.accessRequest.findUnique({ where: { id } });
    if (!request || request.organizationId !== req.organizationId!) { notFound(res, "Request not found"); return; }
    if (request.status !== "PENDING") { badRequest(res, "Request already resolved"); return; }

    await prisma.accessRequest.update({
      where: { id },
      data: { status: action === "APPROVE" ? "APPROVED" : "DENIED", responseNote: responseNote || null, resolvedAt: new Date(), resolvedById: req.userId },
    });

    if (action === "APPROVE") {
      await prisma.userModuleAccess.upsert({
        where: { userId_organizationId_moduleKey: { userId: request.userId, organizationId: request.organizationId, moduleKey: request.moduleKey } },
        update: { grantedAt: new Date(), grantedById: req.userId },
        create: { userId: request.userId, organizationId: request.organizationId, moduleKey: request.moduleKey, grantedById: req.userId },
      });
    }

    ok(res, null, action === "APPROVE" ? "Access granted" : "Request denied");
  } catch (e) { serverError(res, e); }
}

// ── Admin: get all team members with their module access ──────
export async function getTeamModuleAccess(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (!ADMIN_ROLES.includes(req.memberRole!)) { forbidden(res, "Admin access required"); return; }
    const orgId = req.organizationId!;

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: orgId, isActive: true },
      include: {
        user: {
          select: {
            id: true, name: true, email: true, lastLoginAt: true,
            moduleAccess: { where: { organizationId: orgId }, select: { moduleKey: true, grantedAt: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    ok(res, { members });
  } catch (e) { serverError(res, e); }
}

// ── Admin: manually grant module access ──────────────────────
export async function grantModuleAccess(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (!ADMIN_ROLES.includes(req.memberRole!)) { forbidden(res, "Admin access required"); return; }
    const { userId, moduleKeys } = req.body;
    if (!userId || !Array.isArray(moduleKeys)) { badRequest(res, "userId and moduleKeys[] required"); return; }
    const orgId = req.organizationId!;

    // Verify user is in org
    const member = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    if (!member) { notFound(res, "User not in organization"); return; }

    for (const moduleKey of moduleKeys) {
      await prisma.userModuleAccess.upsert({
        where: { userId_organizationId_moduleKey: { userId, organizationId: orgId, moduleKey } },
        update: { grantedAt: new Date(), grantedById: req.userId },
        create: { userId, organizationId: orgId, moduleKey, grantedById: req.userId },
      });
      // Auto-approve any pending request for this module
      await prisma.accessRequest.updateMany({
        where: { userId, organizationId: orgId, moduleKey, status: "PENDING" },
        data: { status: "APPROVED", resolvedAt: new Date(), resolvedById: req.userId },
      });
    }
    ok(res, null, "Access granted");
  } catch (e) { serverError(res, e); }
}

// ── Admin: revoke module access ───────────────────────────────
export async function revokeModuleAccess(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (!ADMIN_ROLES.includes(req.memberRole!)) { forbidden(res, "Admin access required"); return; }
    const { userId, moduleKey } = req.body;
    if (!userId || !moduleKey) { badRequest(res, "userId and moduleKey required"); return; }
    const orgId = req.organizationId!;

    await prisma.userModuleAccess.deleteMany({ where: { userId, organizationId: orgId, moduleKey } });
    ok(res, null, "Access revoked");
  } catch (e) { serverError(res, e); }
}
