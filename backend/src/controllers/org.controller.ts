import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { AuthRequest } from "../middleware/auth";
import {
  createOrgSchema,
  updateOrgSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from "../validators/org.validator";
import { ok, created, badRequest, forbidden, notFound, serverError, conflict } from "../utils/response";
import { uniqueOrgSlug } from "../utils/slug";
import { sendEmail, inviteEmailTemplate } from "../utils/email";
import { isStrongPassword } from "./auth.controller";
import { invalidateUserSecState } from "../middleware/auth";
import { writeAuditLog, getIp } from "../utils/auditLog";
import { hashToken } from "../utils/tokenHash";
import { signAccessToken, signRefreshToken, getRefreshExpiryDate } from "../lib/jwt";
import { setAuthCookies } from "../lib/authCookies";
import { MemberRole, Prisma } from "@prisma/client";
import { google } from "googleapis";

// Modules a self-service org owner can never grant themselves — only the
// super admin can enable these, either at org-creation time (via the
// /super-admin/users endpoint, which is trusted and bypasses this) or later
// by approving an OrgModuleRequest. Keep in sync with `restricted` flags in
// frontend/src/lib/modules.ts.
const SUPER_ADMIN_ONLY_MODULES = ["CARS"];

// ── Create Organization ──────────────────────────────────────
export async function createOrganization(req: AuthRequest, res: Response): Promise<void> {
  try {
    const parsed = createOrgSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }

    const slug = await uniqueOrgSlug(parsed.data.name);

    // Self-service org creation is not a trusted path for gated modules —
    // silently drop any, same backstop as updateOrganization() below.
    const requestedModules: string[] = (parsed.data as any).enabledModules ?? [];
    const allowedModules = requestedModules.filter((m) => !SUPER_ADMIN_ONLY_MODULES.includes(m));

    const org = await prisma.organization.create({
      data: {
        ...parsed.data,
        enabledModules: allowedModules,
        slug,
        members: {
          create: { userId: req.userId!, role: MemberRole.OWNER },
        },
      },
    });

    // Auto-grant all enabled modules to the Owner
    const modules: string[] = allowedModules;
    if (modules.length > 0) {
      await prisma.userModuleAccess.createMany({
        data: modules.map((moduleKey) => ({ userId: req.userId!, organizationId: org.id, moduleKey })),
        skipDuplicates: true,
      });
    }

    created(res, org, "Organization created successfully");
  } catch (err) {
    serverError(res, err);
  }
}

// ── List My Organizations ────────────────────────────────────
export async function getMyOrganizations(req: AuthRequest, res: Response): Promise<void> {
  try {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: req.userId!, isActive: true },
      include: {
        organization: {
          select: {
            id: true, name: true, slug: true, logo: true,
            businessType: true, currency: true, country: true, isActive: true,
            enabledModules: true,
          },
        },
      },
    });
    ok(res, memberships.map((m) => ({ ...m.organization, role: m.role, joinedAt: m.joinedAt })));
  } catch (err) {
    serverError(res, err);
  }
}

// ── Get Organization Details ─────────────────────────────────
export async function getOrganization(req: OrgRequest, res: Response): Promise<void> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId },
      include: {
        members: {
          where: { isActive: true },
          include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
        },
      },
    });
    if (!org) { notFound(res, "Organization not found"); return; }
    // Extract hrSettings from complianceConfig for the frontend
    const cfg = (org.complianceConfig as Record<string, any>) ?? {};
    ok(res, { ...org, hrSettings: cfg.hrSettings ?? null });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Update Organization ──────────────────────────────────────
export async function updateOrganization(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (req.memberRole !== MemberRole.OWNER && req.memberRole !== MemberRole.ADMIN) {
      forbidden(res, "Only Owner or Admin can update organization"); return;
    }

    // Extract hrSettings separately — stored in complianceConfig JSON field
    const { hrSettings, ...rest } = req.body as Record<string, any>;

    const parsed = updateOrgSchema.safeParse(rest);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }

    // An org's own admin can turn a module OFF freely, but turning a new one
    // ON requires the super admin's approval via a module request — see
    // requestOrgModule(). Silently drop any additions rather than erroring,
    // since the frontend never sends them (this is just a backend backstop).
    if (parsed.data.enabledModules !== undefined) {
      const existing = await prisma.organization.findUnique({ where: { id: req.organizationId }, select: { enabledModules: true } });
      const current = existing?.enabledModules ?? [];
      parsed.data.enabledModules = parsed.data.enabledModules.filter((m) => current.includes(m));
    }

    // Merge hrSettings into existing complianceConfig
    let updateData: Record<string, any> = { ...parsed.data };
    if (hrSettings !== undefined) {
      const existing = await prisma.organization.findUnique({
        where: { id: req.organizationId },
        select: { complianceConfig: true },
      });
      const existingConfig = (existing?.complianceConfig as Record<string, any>) ?? {};
      updateData.complianceConfig = { ...existingConfig, hrSettings };
    }

    const org = await prisma.organization.update({ where: { id: req.organizationId }, data: updateData });

    // Return hrSettings extracted from complianceConfig for convenience
    const cfg = (org.complianceConfig as Record<string, any>) ?? {};
    ok(res, { ...org, hrSettings: cfg.hrSettings ?? null }, "Organization updated");
  } catch (err) {
    serverError(res, err);
  }
}

// ── Send invite via the inviter's connected Gmail account ─────
async function sendInviteViaGmail(inviterId: string, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const db = (prisma as any);
    const account = await db.gmailAccount.findUnique({ where: { userId: inviterId } });
    if (!account || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return false;

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    oAuth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.expiresAt.getTime(),
    });
    // Auto-refresh if needed
    if (account.expiresAt < new Date()) {
      const { credentials } = await oAuth2Client.refreshAccessToken();
      await db.gmailAccount.update({
        where: { userId: inviterId },
        data: { accessToken: credentials.access_token!, expiresAt: new Date(credentials.expiry_date || Date.now() + 3600_000) },
      });
      oAuth2Client.setCredentials(credentials);
    }

    const gmail = google.gmail({ version: "v1", auth: oAuth2Client }) as any;
    const mimeLines = [
      `From: ${account.email}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "",
      html,
    ];
    const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    console.log(`📧 [GMAIL] Invite sent to ${to} via ${account.email}`);
    return true;
  } catch (err: any) {
    console.warn("[Gmail invite] Failed, will fall back to SMTP:", err.message);
    return false;
  }
}

// ── Invite Member ────────────────────────────────────────────
export async function inviteMember(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (req.memberRole !== MemberRole.OWNER && req.memberRole !== MemberRole.ADMIN) {
      forbidden(res, "Only Owner or Admin can invite members"); return;
    }
    const parsed = inviteMemberSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }

    const { email, role, allowedModules } = parsed.data;

    // An invite can never mint an OWNER, and only an OWNER may invite an ADMIN.
    if (role === MemberRole.OWNER) {
      forbidden(res, "Cannot invite a member as OWNER"); return;
    }
    if (role === MemberRole.ADMIN && req.memberRole !== MemberRole.OWNER) {
      forbidden(res, "Only the organization owner can invite an ADMIN"); return;
    }

    // Check if already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyMember = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId: req.organizationId! } },
      });
      if (alreadyMember?.isActive) { conflict(res, "This user is already a member"); return; }
    }

    // Check for pending invite — resend if exists (update modules)
    const existingInvite = await prisma.orgInvite.findFirst({
      where: { email, organizationId: req.organizationId!, status: "PENDING" },
    });
    if (existingInvite) { conflict(res, "An invite has already been sent to this email"); return; }

    const org = await prisma.organization.findUnique({ where: { id: req.organizationId }, select: { name: true } });
    const inviter = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    const invite = await prisma.orgInvite.create({
      data: { email, organizationId: req.organizationId!, role, allowedModules: allowedModules ?? [], invitedById: req.userId!, expiresAt },
    });

    const subject = `You're invited to join ${org!.name} on BusinessOS`;
    const html = inviteEmailTemplate(org!.name, inviter!.name, invite.token, role, allowedModules ?? []);

    // Try the inviter's connected Gmail first; fall back to SMTP
    const sentViaGmail = await sendInviteViaGmail(req.userId!, email, subject, html);
    if (!sentViaGmail) {
      await sendEmail({ to: email, subject, html });
    }

    writeAuditLog({ organizationId: req.organizationId!, userId: req.userId, userEmail: req.userEmail, action: "MEMBER_INVITED", resource: "OrgInvite", resourceId: invite.id, description: `Invited ${email} as ${role}`, ipAddress: getIp(req as any) });
    created(res, { id: invite.id, email, role, allowedModules: invite.allowedModules }, "Invitation sent successfully");
  } catch (err) {
    serverError(res, err);
  }
}

// ── Get Invite Info (no auth needed — public) ────────────────
export async function getInviteInfo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const token = req.query.token as string;
    if (!token) { badRequest(res, "Token is required"); return; }

    const invite = await prisma.orgInvite.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true } },
        invitedBy: { select: { name: true } },
      },
    });

    if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      badRequest(res, "This invite link is invalid or has expired"); return;
    }

    ok(res, {
      orgName: invite.organization.name,
      inviterName: invite.invitedBy?.name || "Someone",
      role: invite.role,
      email: invite.email,
    });
  } catch (err) {
    serverError(res, err);
  }
}

// ── Accept Invite ────────────────────────────────────────────
export async function acceptInvite(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { token } = req.body;
    if (!token) { badRequest(res, "Invite token is required"); return; }

    const invite = await prisma.orgInvite.findUnique({
      where: { token },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, logo: true, currency: true, country: true, businessType: true, isActive: true, enabledModules: true },
        },
      },
    });

    if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      badRequest(res, "Invalid or expired invitation"); return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.email !== invite.email) {
      forbidden(res, "This invitation was sent to a different email address"); return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizationMember.upsert({
        where: { userId_organizationId: { userId: req.userId!, organizationId: invite.organizationId } },
        update: { role: invite.role, isActive: true },
        create: { userId: req.userId!, organizationId: invite.organizationId, role: invite.role },
      });
      await tx.orgInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });

      // Grant the modules the admin pre-selected for this employee
      if (invite.allowedModules.length > 0) {
        await tx.userModuleAccess.createMany({
          data: invite.allowedModules.map((moduleKey) => ({
            userId: req.userId!,
            organizationId: invite.organizationId,
            moduleKey,
            grantedById: invite.invitedById,
          })),
          skipDuplicates: true,
        });
      }
    });

    ok(res, { organization: invite.organization, role: invite.role }, "Joined organization successfully");
  } catch (err) {
    serverError(res, err);
  }
}

// ── Register a brand-new account directly from an invite ──────
// Public — no auth. Used when the invited email has no existing BusinessOS
// account yet. The invite link itself (sent to a real inbox by an org
// admin) is treated as proof of email ownership, so no separate
// verification step is required — same trust model as a password-reset
// link. Creates the user, joins the org, grants the pre-selected
// modules, and returns tokens so the frontend can log them straight in.
export async function registerViaInvite(req: Request, res: Response): Promise<void> {
  try {
    const { token, name, password } = req.body as { token?: string; name?: string; password?: string };
    if (!token || !name?.trim() || !password) {
      badRequest(res, "token, name, and password are required");
      return;
    }

    const invite = await prisma.orgInvite.findUnique({
      where: { token },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, logo: true, currency: true, country: true, businessType: true, isActive: true, enabledModules: true },
        },
      },
    });
    if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
      badRequest(res, "This invite link is invalid or has expired");
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      conflict(res, "An account with this email already exists. Please log in instead.");
      return;
    }

    const strength = isStrongPassword(password);
    if (!strength.ok) { badRequest(res, strength.reason!); return; }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { name: name.trim(), email: invite.email, password: hashedPassword, isEmailVerified: true },
      });
      await tx.organizationMember.create({
        data: { userId: newUser.id, organizationId: invite.organizationId, role: invite.role },
      });
      if (invite.allowedModules.length > 0) {
        await tx.userModuleAccess.createMany({
          data: invite.allowedModules.map((moduleKey) => ({
            userId: newUser.id, organizationId: invite.organizationId, moduleKey, grantedById: invite.invitedById,
          })),
          skipDuplicates: true,
        });
      }
      await tx.orgInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
      return newUser;
    });

    const accessToken = signAccessToken({ userId: user.id, email: user.email, isSuperAdmin: false });
    const tokenId = uuidv4();
    const refreshToken = signRefreshToken({ userId: user.id, tokenId });
    await prisma.refreshToken.create({
      data: { id: tokenId, token: hashToken(refreshToken), userId: user.id, expiresAt: getRefreshExpiryDate() },
    });

    setAuthCookies(res, accessToken, refreshToken);
    created(res, {
      accessToken, refreshToken,
      user: { id: user.id, name: user.name, email: user.email, avatar: null, isSuperAdmin: false },
      organizations: [{ ...invite.organization, role: invite.role }],
    }, "Account created — welcome aboard!");
  } catch (err) {
    serverError(res, err);
  }
}

// ── List Pending Invites ─────────────────────────────────────
export async function listPendingInvites(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (req.memberRole !== MemberRole.OWNER && req.memberRole !== MemberRole.ADMIN) {
      forbidden(res, "Only Owner or Admin can view invites"); return;
    }
    const invites = await prisma.orgInvite.findMany({
      where: { organizationId: req.organizationId!, status: "PENDING" },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    ok(res, invites.map(i => ({
      id: i.id, email: i.email, role: i.role,
      allowedModules: i.allowedModules, expiresAt: i.expiresAt,
      createdAt: i.createdAt, invitedBy: i.invitedBy?.name,
      expired: i.expiresAt < new Date(),
    })));
  } catch (err) { serverError(res, err); }
}

// ── Resend Invite ────────────────────────────────────────────
export async function resendInvite(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (req.memberRole !== MemberRole.OWNER && req.memberRole !== MemberRole.ADMIN) {
      forbidden(res, "Only Owner or Admin can resend invites"); return;
    }
    const invite = await prisma.orgInvite.findFirst({
      where: { id: req.params.inviteId as string, organizationId: req.organizationId!, status: "PENDING" },
    });
    if (!invite) { notFound(res, "Invite not found"); return; }

    // Extend expiry by another 48 hours
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await prisma.orgInvite.update({ where: { id: invite.id }, data: { expiresAt } });

    const org = await prisma.organization.findUnique({ where: { id: req.organizationId }, select: { name: true } });
    const inviter = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });

    const subject = `Reminder: You're invited to join ${org!.name} on BusinessOS`;
    const html = inviteEmailTemplate(org!.name, inviter!.name, invite.token, invite.role, invite.allowedModules);

    const sentViaGmail = await sendInviteViaGmail(req.userId!, invite.email, subject, html);
    if (!sentViaGmail) await sendEmail({ to: invite.email, subject, html });

    ok(res, null, "Invite resent successfully");
  } catch (err) { serverError(res, err); }
}

// ── Cancel Invite ────────────────────────────────────────────
export async function cancelInvite(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (req.memberRole !== MemberRole.OWNER && req.memberRole !== MemberRole.ADMIN) {
      forbidden(res, "Only Owner or Admin can cancel invites"); return;
    }
    const deleted = await prisma.orgInvite.deleteMany({
      where: { id: req.params.inviteId as string, organizationId: req.organizationId!, status: "PENDING" },
    });
    if (!deleted.count) { notFound(res, "Invite not found"); return; }
    ok(res, null, "Invite cancelled");
  } catch (err) { serverError(res, err); }
}

// ── List & Remove Members ────────────────────────────────────
export async function listMembers(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (req.memberRole !== MemberRole.OWNER && req.memberRole !== MemberRole.ADMIN) {
      forbidden(res, "Only Owner or Admin can view the team list"); return;
    }
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: req.organizationId!, isActive: true },
      include: { user: { select: { id: true, name: true, email: true, avatar: true, lastLoginAt: true } } },
    });
    ok(res, members.map((m) => ({ ...m.user, role: m.role, joinedAt: m.joinedAt })));
  } catch (err) {
    serverError(res, err);
  }
}

export async function updateMemberRole(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (req.memberRole !== MemberRole.OWNER && req.memberRole !== MemberRole.ADMIN) {
      forbidden(res, "Only Owner or Admin can change roles"); return;
    }
    const memberId = req.params.memberId as string;
    const parsed = updateMemberRoleSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Invalid role"); return; }

    // Ownership can only be transferred through a dedicated, deliberate flow —
    // never minted here (would let an ADMIN silently create co-owners / escalate).
    if (parsed.data.role === MemberRole.OWNER) {
      forbidden(res, "Ownership cannot be assigned from this endpoint"); return;
    }

    // Prevent changing owner's role
    const target = await prisma.organizationMember.findFirst({
      where: { userId: memberId, organizationId: req.organizationId! },
    });
    if (!target) { notFound(res, "Member not found"); return; }
    if (target.role === MemberRole.OWNER) { forbidden(res, "Cannot change the owner's role"); return; }

    // Only an OWNER may grant or revoke ADMIN. An ADMIN cannot mint peer admins,
    // promote themselves, or demote another admin.
    const touchesAdmin = target.role === MemberRole.ADMIN || parsed.data.role === MemberRole.ADMIN;
    if (touchesAdmin && req.memberRole !== MemberRole.OWNER) {
      forbidden(res, "Only the organization owner can change ADMIN roles"); return;
    }
    if (memberId === req.userId) { forbidden(res, "You cannot change your own role"); return; }

    await prisma.organizationMember.update({
      where: { userId_organizationId: { userId: memberId, organizationId: req.organizationId! } },
      data: { role: parsed.data.role },
    });
    invalidateUserSecState(memberId);
    writeAuditLog({ organizationId: req.organizationId!, userId: req.userId, userEmail: req.userEmail, action: "MEMBER_ROLE_CHANGED", resource: "OrganizationMember", resourceId: memberId, description: `Role ${target.role} -> ${parsed.data.role}`, ipAddress: getIp(req as any) });
    ok(res, null, "Role updated");
  } catch (err) {
    serverError(res, err);
  }
}

export async function removeMember(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (req.memberRole !== MemberRole.OWNER && req.memberRole !== MemberRole.ADMIN) {
      forbidden(res, "Only Owner or Admin can remove members"); return;
    }
    const memberId = req.params.memberId as string;
    if (memberId === req.userId) { badRequest(res, "You cannot remove yourself"); return; }

    const target = await prisma.organizationMember.findFirst({
      where: { userId: memberId, organizationId: req.organizationId! },
    });
    if (!target) { notFound(res, "Member not found"); return; }
    if (target.role === MemberRole.OWNER) { forbidden(res, "Cannot remove the organization owner"); return; }

    await prisma.organizationMember.update({
      where: { userId_organizationId: { userId: memberId, organizationId: req.organizationId! } },
      data: { isActive: false },
    });
    // Cut live access: revoke this user's refresh tokens for the whole platform
    // is too broad (they may belong to other orgs), so just drop cached auth
    // state — requireOrgContext re-checks membership.isActive on the next call.
    invalidateUserSecState(memberId);
    writeAuditLog({ organizationId: req.organizationId!, userId: req.userId, userEmail: req.userEmail, action: "MEMBER_REMOVED", resource: "OrganizationMember", resourceId: memberId, description: `Removed member (was ${target.role})`, ipAddress: getIp(req as any) });
    ok(res, null, "Member removed");
  } catch (err) {
    serverError(res, err);
  }
}

// ── Module requests — an org's own admin can no longer just enable a new
// module for themselves; they ask the platform's super admin instead. ──────
export async function requestOrgModule(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (req.memberRole !== MemberRole.OWNER && req.memberRole !== MemberRole.ADMIN) {
      forbidden(res, "Only Owner or Admin can request a module"); return;
    }

    const { moduleKey, message } = req.body as { moduleKey?: string; message?: string };
    if (!moduleKey) { badRequest(res, "moduleKey is required"); return; }

    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! }, select: { enabledModules: true } });
    if (org?.enabledModules.includes(moduleKey)) { badRequest(res, "This module is already enabled"); return; }

    const request = await prisma.orgModuleRequest.upsert({
      where: { organizationId_moduleKey: { organizationId: req.organizationId!, moduleKey } },
      create: { organizationId: req.organizationId!, moduleKey, requestedById: req.userId!, message: message || null },
      update: { status: "PENDING", message: message || null, requestedById: req.userId!, responseNote: null, resolvedAt: null, resolvedById: null, requestedAt: new Date() },
    });

    created(res, request);
  } catch (err) {
    serverError(res, err);
  }
}

export async function listOrgModuleRequests(req: OrgRequest, res: Response): Promise<void> {
  try {
    const requests = await prisma.orgModuleRequest.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { requestedAt: "desc" },
    });
    ok(res, requests);
  } catch (err) {
    serverError(res, err);
  }
}

// ── Job Role taxonomy ────────────────────────────────────────────
// Each preset sets a starting permission tier + module grants when an org
// admin adds a new employee directly. "ALL_ENABLED" means every module the
// org currently has turned on. STAFF/INTERN/HR ship with a narrow starting
// point since those titles are too generic/specific to guess broadly —
// the admin picks the exact module(s) for that person at creation time.
export const JOB_ROLES: Record<string, { label: string; memberRole: MemberRole; defaultModules: string[] | "ALL_ENABLED" }> = {
  MANAGER:         { label: "Manager",          memberRole: MemberRole.MANAGER,    defaultModules: "ALL_ENABLED" },
  ACCOUNTANT:      { label: "Accountant",        memberRole: MemberRole.ACCOUNTANT, defaultModules: ["ACCOUNTS", "REPORTS", "PURCHASE"] },
  PROJECT_MANAGER: { label: "Project Manager",   memberRole: MemberRole.MANAGER,    defaultModules: ["PROJECTS", "HR", "REPORTS"] },
  EXECUTIVE:       { label: "Executive",         memberRole: MemberRole.STAFF,      defaultModules: ["CRM", "MARKETING", "TELECALLING"] },
  STAFF:           { label: "Staff",             memberRole: MemberRole.STAFF,      defaultModules: [] },
  INTERN:          { label: "Intern",            memberRole: MemberRole.STAFF,      defaultModules: [] },
  HR:              { label: "HR",                memberRole: MemberRole.STAFF,      defaultModules: ["HR", "REPORTS"] },
};

// ── Add employee directly — sets their password immediately, no email
// dependency. Replaces the old invite-by-email flow as the primary path. ──
export async function createOrgEmployee(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (req.memberRole !== MemberRole.OWNER && req.memberRole !== MemberRole.ADMIN) {
      forbidden(res, "Only Owner or Admin can add employees"); return;
    }

    const { name, jobRole, description, email, password, confirmPassword, phone, modules } = req.body as {
      name?: string; jobRole?: string; description?: string; email?: string;
      password?: string; confirmPassword?: string; phone?: string; modules?: string[];
    };

    if (!name?.trim()) { badRequest(res, "Name is required"); return; }
    if (!jobRole || !JOB_ROLES[jobRole]) { badRequest(res, "A valid job role is required"); return; }
    if (!email?.trim()) { badRequest(res, "Email is required"); return; }
    if (password !== confirmPassword) { badRequest(res, "Passwords do not match"); return; }
    const strength = isStrongPassword(password || "");
    if (!strength.ok) { badRequest(res, strength.reason || "Password is too weak"); return; }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) { conflict(res, "A user with this email already exists"); return; }

    // An employee record with this email may already exist from the HR module
    // (which creates employees without a login). Creating a second one here
    // would leave two rows for the same person — flag it instead.
    const existingEmployee = await prisma.employee.findFirst({
      where: { organizationId: req.organizationId!, email: normalizedEmail },
      select: { id: true },
    });
    if (existingEmployee) {
      conflict(res, "An employee with this email already exists in this organization. Remove or edit that record first.");
      return;
    }

    const preset = JOB_ROLES[jobRole];
    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! }, select: { enabledModules: true } });
    const orgModules = org?.enabledModules ?? [];

    let moduleKeys: string[];
    if (preset.defaultModules === "ALL_ENABLED") {
      moduleKeys = orgModules;
    } else {
      // A caller-supplied module list (Staff/Intern) can only grant modules
      // the org actually has enabled — never trust the client alone here.
      moduleKeys = modules && modules.length > 0
        ? modules.filter((m) => orgModules.includes(m))
        : [...preset.defaultModules];
    }

    // A Project Manager runs whatever delivery-pipeline module the org has —
    // WBA (Service Delivery Pipeline) isn't a standard preset module since
    // it's org-specific, so wire it in for orgs that have it enabled rather
    // than hardcoding it into every org's Project Manager default.
    if ((jobRole === "PROJECT_MANAGER" || jobRole === "EXECUTIVE") && orgModules.includes("WBA") && !moduleKeys.includes("WBA")) {
      moduleKeys = [...moduleKeys, "WBA"];
    }

    const hash = await bcrypt.hash(password!, 12);
    const employeeCount = await prisma.employee.count({ where: { organizationId: req.organizationId! } });

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: name.trim(), email: normalizedEmail, password: hash, isActive: true, isEmailVerified: true },
      });
      await tx.organizationMember.create({
        data: { userId: user.id, organizationId: req.organizationId!, role: preset.memberRole },
      });
      if (moduleKeys.length > 0) {
        await tx.userModuleAccess.createMany({
          data: moduleKeys.map((moduleKey) => ({ userId: user.id, organizationId: req.organizationId!, moduleKey, grantedById: req.userId! })),
        });
      }
      const employee = await tx.employee.create({
        data: {
          organizationId: req.organizationId!,
          employeeCode: `EMP-${String(employeeCount + 1).padStart(4, "0")}`,
          name: name.trim(),
          email: normalizedEmail,
          phone: phone || null,
          designation: preset.label,
          orgRole: jobRole,
          notes: description || null,
          userId: user.id,
          joiningDate: new Date(),
        },
      });
      return { user, employee };
    });

    created(res, {
      id: result.user.id, name: result.user.name, email: result.user.email,
      jobRole, role: preset.memberRole, modules: moduleKeys, employeeId: result.employee.id,
    }, "Employee added");
  } catch (err) {
    // Turn known DB constraint failures into an actionable 409 rather than a
    // bare 500 the UI can only render as a generic "Could not add employee".
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      conflict(res, "That email or employee code is already in use in this organization.");
      return;
    }
    serverError(res, err);
  }
}

// ── Company directory — who works here, visible to every member ────
export async function listOrgDirectory(req: OrgRequest, res: Response): Promise<void> {
  try {
    const employees = await prisma.employee.findMany({
      where: { organizationId: req.organizationId!, status: "ACTIVE" },
      select: {
        id: true, name: true, designation: true, department: true, orgRole: true,
        employeeCode: true, email: true, phone: true,
        employmentType: true, joiningDate: true,
      },
      orderBy: { name: "asc" },
    });
    ok(res, employees);
  } catch (err) {
    serverError(res, err);
  }
}
