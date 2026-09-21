import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import { hashToken } from "../utils/tokenHash";
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from "../lib/authCookies";
import { prisma, withRetry } from "../lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshExpiryDate,
} from "../lib/jwt";
import { verifyFirebaseIdToken, isFirebaseConfigured } from "../lib/firebaseAdmin";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  conflict,
  serverError,
  notFound,
} from "../utils/response";
import { sendEmail, verifyEmailTemplate, resetPasswordTemplate, esc } from "../utils/email";
import { writeAuditLog, getIp } from "../utils/auditLog";
import { AuthRequest, invalidateUserSecState } from "../middleware/auth";

const MAX_FAIL  = 5;
const PASS_MIN_LENGTH = 8;

// Progressive lockout. A flat 15-minute account lock keyed only on email is a
// denial-of-service handle: anyone who knows a victim's address can lock them
// out on demand. Instead the FIRST lock is short (1 min — an honest typo barely
// notices) and each further lock without a successful login in between grows,
// capped at 1 hour. Brute-force protection proper is the per-IP rate limiter.
const LOCK_STEPS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
export function lockDurationFor(totalFailures: number): number {
  const step = Math.floor(totalFailures / MAX_FAIL) - 1;
  return LOCK_STEPS_MS[Math.max(0, Math.min(step, LOCK_STEPS_MS.length - 1))];
}

// ── Password strength check ───────────────────────────────────
export function isStrongPassword(password: string): { ok: boolean; reason?: string } {
  if (password.length < PASS_MIN_LENGTH) return { ok: false, reason: `Password must be at least ${PASS_MIN_LENGTH} characters` };
  if (!/[A-Z]/.test(password)) return { ok: false, reason: "Password must contain at least one uppercase letter" };
  if (!/[0-9]/.test(password)) return { ok: false, reason: "Password must contain at least one number" };
  if (!/[^A-Za-z0-9]/.test(password)) return { ok: false, reason: "Password must contain at least one special character" };
  return { ok: true };
}

// ── Parse user agent into readable parts ─────────────────────
function parseUA(ua: string = ""): { browser: string; os: string } {
  const browser =
    ua.includes("Chrome") ? "Chrome" :
    ua.includes("Firefox") ? "Firefox" :
    ua.includes("Safari") ? "Safari" :
    ua.includes("Edge") ? "Edge" : "Unknown";
  const os =
    ua.includes("Windows") ? "Windows" :
    ua.includes("Mac") ? "macOS" :
    ua.includes("Linux") ? "Linux" :
    ua.includes("Android") ? "Android" :
    ua.includes("iPhone") || ua.includes("iPad") ? "iOS" : "Unknown";
  return { browser, os };
}

// ── Suspicious login alert email ──────────────────────────────
async function sendLoginAlert(user: { name: string; email: string }, ip: string, ua: string, isNew: boolean) {
  if (!isNew) return;
  const { browser, os } = parseUA(ua);
  try {
    await sendEmail({
      to: user.email,
      subject: "New login detected — BusinessOS",
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px">
          <h2 style="color:#ef4444;margin:0 0 8px">New Login Detected</h2>
          <p style="color:#555">Hi ${esc(user.name)}, a new login to your BusinessOS account was detected.</p>
          <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:20px 0">
            <div style="margin-bottom:8px"><span style="color:#888">Browser: </span><strong>${esc(browser)}</strong></div>
            <div style="margin-bottom:8px"><span style="color:#888">OS: </span><strong>${esc(os)}</strong></div>
            <div><span style="color:#888">IP Address: </span><strong>${esc(ip)}</strong></div>
          </div>
          <p style="color:#555">If this was you, no action needed. If not, <a href="${(process.env.FRONTEND_URL || "").split(",")[0]}/settings" style="color:#6366f1">secure your account immediately</a>.</p>
        </div>
      `,
    });
  } catch { /* non-blocking */ }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors);
      return;
    }
    const { name, email, password, phone } = parsed.data;

    const existing = await withRetry<any>(() => prisma.user.findUnique({ where: { email } }));
    if (existing) {
      conflict(res, "An account with this email already exists");
      return;
    }

    // Check phone uniqueness if provided
    if (phone) {
      const existingPhone = await withRetry<any>(() => (prisma as any).user.findUnique({ where: { phone } }));
      if (existingPhone) { conflict(res, "This phone number is already registered"); return; }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    // Email verification is required whenever SMTP is configured in production.
    // A verified status can only be obtained through the SMTP token link below
    // or the dedicated Google/Firebase sign-in endpoint — never self-asserted.
    const smtpConfigured = process.env.NODE_ENV === "production" && !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    const emailVerifyToken = smtpConfigured ? uuidv4() : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: any = await withRetry<any>(() => (prisma as any).user.create({
      data: {
        name, email, password: hashedPassword,
        emailVerifyToken,
        isEmailVerified: !smtpConfigured,
        phone:         phone || null,
        phoneVerified: !!phone,
      },
    }));

    if (smtpConfigured) {
      try {
        await sendEmail({
          to: email,
          subject: "Verify your BusinessOS account",
          html: verifyEmailTemplate(name, emailVerifyToken!),
        });
      } catch (emailErr) {
        console.error("[Register] Email failed, auto-verifying user:", emailErr);
        await prisma.user.update({
          where: { id: user.id },
          data: { isEmailVerified: true, emailVerifyToken: null },
        });
      }
    }

    const message = smtpConfigured
      ? "Account created. Please verify your email."
      : "Account created. You can log in immediately.";

    created(res, { id: user.id, name: user.name, email: user.email }, message);
  } catch (err) {
    serverError(res, err);
  }
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.query as { token: string };
    if (!token) { badRequest(res, "Token is required"); return; }

    const user = await prisma.user.findUnique({ where: { emailVerifyToken: token } });
    if (!user) { badRequest(res, "Invalid or expired verification token"); return; }

    await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, emailVerifyToken: null },
    });

    ok(res, null, "Email verified successfully. You can now log in.");
  } catch (err) {
    serverError(res, err);
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }
    const { email, password } = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: any = await withRetry<any>(() => (prisma as any).user.findUnique({ where: { email } }));
    if (!user || !user.isActive) {
      unauthorized(res, "Invalid email or password");
      return;
    }

    // ── DB-persisted lockout ─────────────────────────────────
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const mins = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      unauthorized(res, `Account locked. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`);
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      // loginAttempts accumulates across lock cycles so repeat offenders get
      // progressively longer locks; a successful login resets it to 0.
      const attempts = (user.loginAttempts || 0) + 1;
      const locking = attempts % MAX_FAIL === 0;
      const lockMs = locking ? lockDurationFor(attempts) : 0;
      await prisma.user.update({
        where: { id: user.id },
        data: locking
          ? { loginAttempts: attempts, lockedUntil: new Date(Date.now() + lockMs) }
          : { loginAttempts: attempts },
      });
      writeAuditLog({ userEmail: user.email, userName: user.name, action: "LOGIN_FAILED", resource: "User", resourceId: user.id, description: locking ? `Account locked ${Math.round(lockMs / 60000)}m after ${attempts} failed attempts` : "Invalid password", ipAddress: getIp(req as any) });
      unauthorized(res, locking
        ? `Too many failed attempts. Account locked for ${Math.round(lockMs / 60000)} minute${lockMs > 60000 ? "s" : ""}.`
        : "Invalid email or password."
      );
      return;
    }

    // Clear lockout on success
    await prisma.user.update({ where: { id: user.id }, data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } });


    if (!user.isEmailVerified && process.env.NODE_ENV === "production") {
      unauthorized(res, "Please verify your email before logging in");
      return;
    }
    if (!user.isEmailVerified && process.env.NODE_ENV !== "production") {
      await prisma.user.update({ where: { id: user.id }, data: { isEmailVerified: true, emailVerifyToken: null } });
    }

    // ── Two-factor challenge ────────────────────────────────────
    // Password was correct but the account has TOTP enabled: do NOT issue a
    // session yet. Hand back a short-lived challenge token the client exchanges
    // via /auth/verify-2fa-login together with a valid 6-digit code.
    if (user.twoFactorEnabled) {
      const challengeToken = jwt.sign(
        { userId: user.id, action: "totp_2fa" },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "5m", algorithm: "HS256" },
      );
      writeAuditLog({ userId: user.id, userEmail: user.email, userName: user.name, action: "LOGIN_2FA_CHALLENGE", resource: "User", resourceId: user.id, description: "Password OK — awaiting TOTP", ipAddress: getIp(req as any) });
      ok(res, { requires2FA: true, method: "totp", tempToken: challengeToken });
      return;
    }

    await finalizeLogin(req, res, user);
  } catch (err) { serverError(res, err); }
}

// ── Verify a TOTP code and complete a 2FA-gated login ─────────
export async function verify2FALogin(req: Request, res: Response): Promise<void> {
  try {
    const { tempToken, token } = req.body as { tempToken?: string; token?: string };
    if (!tempToken || !token) { badRequest(res, "tempToken and token are required"); return; }

    let payload: any;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_ACCESS_SECRET!, { algorithms: ["HS256"] });
    } catch {
      unauthorized(res, "Your verification session expired. Please sign in again.");
      return;
    }
    if (payload.action !== "totp_2fa") { unauthorized(res, "Invalid challenge token"); return; }

    const user: any = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) { unauthorized(res, "Account not found or disabled"); return; }
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      // 2FA was turned off between the two calls — nothing to verify, just log in.
      await finalizeLogin(req, res, user);
      return;
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: String(token).replace(/\s/g, ""),
      window: 1,
    });
    if (!valid) {
      writeAuditLog({ userId: user.id, userEmail: user.email, action: "LOGIN_2FA_FAILED", resource: "User", resourceId: user.id, description: "Invalid TOTP code", ipAddress: getIp(req as any) });
      unauthorized(res, "Invalid authentication code.");
      return;
    }

    await finalizeLogin(req, res, user);
  } catch (err) { serverError(res, err); }
}

// ── Shared: issue tokens + session + login response ──────────
async function finalizeLogin(req: Request, res: Response, user: any): Promise<void> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id, isActive: true },
    include: { organization: { select: { id: true, name: true, slug: true, logo: true, currency: true, country: true, businessType: true, isActive: true, enabledModules: true } } },
  });

  const accessToken = signAccessToken({ userId: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin });
  const tokenId = uuidv4();
  const refreshToken = signRefreshToken({ userId: user.id, tokenId });

  await prisma.refreshToken.create({
    data: { id: tokenId, token: hashToken(refreshToken), userId: user.id, expiresAt: getRefreshExpiryDate() },
  });

  // ── Session tracking ─────────────────────────────────────
  const ip = ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim() || req.socket.remoteAddress || "unknown";
  const ua = req.headers["user-agent"] || "";
  const { browser, os } = parseUA(ua);

  const existingSession = await (prisma as any).userSession.findFirst({ where: { userId: user.id, ipAddress: ip } });
  await (prisma as any).userSession.updateMany({ where: { userId: user.id, isCurrent: true }, data: { isCurrent: false } });
  await (prisma as any).userSession.create({
    data: { userId: user.id, tokenId, device: os, browser, os, ipAddress: ip, isCurrent: true, lastActiveAt: new Date() },
  });

  sendLoginAlert(user, ip, ua, !existingSession);
  writeAuditLog({ userId: user.id, userEmail: user.email, userName: user.name, action: "LOGIN_SUCCESS", resource: "User", resourceId: user.id, description: `Login from ${browser} on ${os}${existingSession ? "" : " (new device/IP)"}`, ipAddress: ip, userAgent: ua });

  // httpOnly cookies for the browser SPA; tokens also in the body for header clients.
  setAuthCookies(res, accessToken, refreshToken);

  ok(res, {
    accessToken, refreshToken,
    user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, isSuperAdmin: user.isSuperAdmin },
    organizations: memberships.map((m: any) => ({ ...m.organization, role: m.role })),
  });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    // Accept the refresh token from the httpOnly cookie (browser SPA) or the
    // request body (header/API clients + the one-time localStorage migration).
    const cookieToken = (req as any).cookies?.[REFRESH_COOKIE] as string | undefined;
    const token = cookieToken || (refreshTokenSchema.safeParse(req.body).success ? req.body.refreshToken : undefined);
    if (!token) { badRequest(res, "Refresh token required"); return; }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      unauthorized(res, "Invalid or expired refresh token");
      return;
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: hashToken(token) } });
    if (!stored) {
      // The token has a valid signature but is not in the store — it was already
      // rotated away. Either the legitimate client retried, or a stolen token is
      // being replayed. Treat as compromise: nuke the whole family so neither
      // party keeps a working session, and force a fresh login.
      await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } });
      await (prisma as any).userSession.updateMany({ where: { userId: payload.userId }, data: { isActive: false } });
      invalidateUserSecState(payload.userId);
      writeAuditLog({ userId: payload.userId, action: "REFRESH_TOKEN_REUSE", resource: "RefreshToken", description: "Rotated-away refresh token replayed — all sessions revoked", ipAddress: getIp(req as any) });
      unauthorized(res, "Session security check failed. Please log in again.");
      return;
    }
    if (stored.expiresAt < new Date()) {
      unauthorized(res, "Refresh token expired or revoked");
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) { unauthorized(res); return; }

    // Rotate: delete old, issue new
    await prisma.refreshToken.delete({ where: { token: hashToken(token) } });

    const newAccessToken = signAccessToken({ userId: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin });
    const newTokenId = uuidv4();
    const newRefreshToken = signRefreshToken({ userId: user.id, tokenId: newTokenId });

    await prisma.refreshToken.create({
      data: { id: newTokenId, token: hashToken(newRefreshToken), userId: user.id, expiresAt: getRefreshExpiryDate() },
    });

    setAuthCookies(res, newAccessToken, newRefreshToken);
    ok(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    serverError(res, err);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const token = (req as any).cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token: hashToken(token) } });
    }
    clearAuthCookies(res);
    ok(res, null, "Logged out successfully");
  } catch (err) {
    serverError(res, err);
  }
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, avatar: true, isSuperAdmin: true, createdAt: true },
    });
    if (!user) { notFound(res, "User not found"); return; }
    ok(res, user);
  } catch (err) {
    serverError(res, err);
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Invalid email"); return; }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    // Always return same message to prevent user enumeration
    if (!user) { ok(res, null, "If this email exists, a reset link has been sent."); return; }

    const resetToken = uuidv4(); // raw — sent in email only, never stored
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: hashToken(resetToken), passwordResetExpiry: expiry },
    });

    await sendEmail({
      to: user.email,
      subject: "Reset your BusinessOS password",
      html: resetPasswordTemplate(user.name, resetToken),
    });

    ok(res, null, "If this email exists, a reset link has been sent.");
  } catch (err) {
    serverError(res, err);
  }
}

// One-time per-org bootstrap: makes YOU the org ADMIN if no admin/owner exists yet for this org
// This is intentionally simpler than super admin — it's org-scoped, not platform-scoped.
export async function claimSuperAdmin(req: AuthRequest, res: Response): Promise<void> {
  try {
    // Check if a super-admin bootstrap is requested (platform level — still requires token)
    const envToken = process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN;
    const provided = (req.body as Record<string, unknown>)?.bootstrapToken;

    if (provided) {
      // Platform super admin claim
      if (!envToken) {
        res.status(503).json({ success: false, message: "Bootstrap not configured on this server." });
        return;
      }
      const providedBuf = typeof provided === "string" ? Buffer.from(provided) : null;
      const envBuf = Buffer.from(envToken);
      const tokenMatches = !!providedBuf && providedBuf.length === envBuf.length && timingSafeEqual(providedBuf, envBuf);
      if (!tokenMatches) {
        res.status(403).json({ success: false, message: "Invalid bootstrap token." });
        return;
      }
      const existingSuperAdmin = await prisma.user.findFirst({ where: { isSuperAdmin: true } });
      if (existingSuperAdmin) {
        res.status(403).json({ success: false, message: "A super admin already exists." });
        return;
      }
      const updated = await prisma.user.update({
        where: { id: req.userId },
        data: { isSuperAdmin: true },
        select: { id: true, name: true, email: true, isSuperAdmin: true },
      });
      writeAuditLog({ userId: req.userId, userEmail: req.userEmail, action: "SUPER_ADMIN_CLAIMED", resource: "User", resourceId: req.userId, description: "Super admin role self-claimed (bootstrap)", ipAddress: getIp(req as any) });
      ok(res, { user: updated }, "You are now the Super Admin. Please log out and log back in.");
      return;
    }

    // ── Org-level Admin claim (no token required) ────────────
    // Find the user's organization membership
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: req.userId!, isActive: true },
      include: { organization: { select: { id: true, name: true } } },
    });
    if (!membership) {
      res.status(400).json({ success: false, message: "You are not a member of any organization." });
      return;
    }

    // Check if an OWNER or ADMIN already exists in this org
    const existingAdmin = await prisma.organizationMember.findFirst({
      where: {
        organizationId: membership.organizationId,
        role: { in: ["OWNER", "ADMIN"] },
        isActive: true,
        NOT: { userId: req.userId! },
      },
    });
    if (existingAdmin) {
      res.status(403).json({ success: false, message: "An admin already exists for this organisation. Contact them to be granted access." });
      return;
    }

    // Promote this user to OWNER in their org
    await prisma.organizationMember.update({
      where: { id: membership.id },
      data: { role: "OWNER" },
    });

    writeAuditLog({ userId: req.userId, userEmail: req.userEmail, action: "ORG_ADMIN_CLAIMED", resource: "OrganizationMember", resourceId: membership.id, description: `Admin role claimed for org: ${membership.organization.name}`, ipAddress: getIp(req as any) });
    ok(res, { orgName: membership.organization.name }, `You are now the Admin of ${membership.organization.name}. Please log out and log back in.`);
  } catch (err) {
    serverError(res, err);
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Validation failed", parsed.error.flatten().fieldErrors); return; }

    const { token, password } = parsed.data;
    const user = await prisma.user.findFirst({
      where: { passwordResetToken: hashToken(token), passwordResetExpiry: { gt: new Date() } },
    });
    if (!user) { badRequest(res, "Invalid or expired reset token"); return; }

    // ── Password strength check ──────────────────────────────
    const strength = isStrongPassword(password);
    if (!strength.ok) { badRequest(res, strength.reason!); return; }

    // ── Password history check (last 5) ──────────────────────
    const history: string[] = (user as any).passwordHistory || [];
    for (const old of history.slice(-5)) {
      if (await bcrypt.compare(password, old)) {
        badRequest(res, "Cannot reuse one of your last 5 passwords"); return;
      }
    }

    const hashed = await bcrypt.hash(password, 12);
    const newHistory = [...history.slice(-4), hashed];

    await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordResetToken: null,
        passwordResetExpiry: null,
        lastPasswordChange: new Date(),
        passwordHistory: newHistory,
      },
    });
    // Revoke all refresh tokens + sessions for security
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await (prisma as any).userSession.updateMany({ where: { userId: user.id }, data: { isActive: false } });
    invalidateUserSecState(user.id); // drop cached auth state so live access tokens die now

    ok(res, null, "Password reset successfully. Please log in.");
  } catch (err) {
    serverError(res, err);
  }
}

// ── Change password (authenticated) ──────────────────────────
export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) { badRequest(res, "currentPassword and newPassword required"); return; }

    const strength = isStrongPassword(newPassword);
    if (!strength.ok) { badRequest(res, strength.reason!); return; }

    const user = await (prisma as any).user.findUnique({ where: { id: req.userId } });
    if (!user) { unauthorized(res); return; }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) { badRequest(res, "Current password is incorrect"); return; }

    const history: string[] = user.passwordHistory || [];
    for (const old of history.slice(-5)) {
      if (await bcrypt.compare(newPassword, old)) {
        badRequest(res, "Cannot reuse one of your last 5 passwords"); return;
      }
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await (prisma as any).user.update({
      where: { id: req.userId },
      data: { password: hashed, lastPasswordChange: new Date(), passwordHistory: [...history.slice(-4), hashed] },
    });

    // Kill every other session: revoke refresh tokens and drop cached auth state
    // so still-valid access tokens issued before this change stop working.
    await prisma.refreshToken.deleteMany({ where: { userId: req.userId! } });
    await (prisma as any).userSession.updateMany({ where: { userId: req.userId! }, data: { isActive: false } });
    invalidateUserSecState(req.userId!);

    writeAuditLog({ userId: req.userId, userEmail: req.userEmail, action: "PASSWORD_CHANGED", resource: "User", resourceId: req.userId, description: "User changed their password", ipAddress: getIp(req as any) });
    ok(res, null, "Password changed successfully");
  } catch (err) { serverError(res, err); }
}

// ── Google OAuth login / register ────────────────────────────
export async function googleLogin(req: Request, res: Response): Promise<void> {
  try {
    if (!isFirebaseConfigured()) { badRequest(res, "Google sign-in is not enabled on this server"); return; }
    const { idToken } = req.body;
    if (!idToken) { badRequest(res, "idToken is required"); return; }

    let decoded;
    try {
      decoded = await verifyFirebaseIdToken(idToken);
    } catch {
      unauthorized(res, "Invalid or expired Google token. Please sign in again.");
      return;
    }

    const { uid, email, name, picture } = decoded as any;
    if (!email) { badRequest(res, "Google account has no email address"); return; }

    let user: any = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const fakePassword = await bcrypt.hash(uuidv4(), 12);
      user = await (prisma as any).user.create({
        data: {
          name: name || email.split("@")[0],
          email,
          password: fakePassword,
          firebaseUid: uid,
          avatar: picture || null,
          isEmailVerified: true,
        },
      });
    } else if (!user.firebaseUid) {
      await (prisma as any).user.update({
        where: { id: user.id },
        data: { firebaseUid: uid, isEmailVerified: true },
      });
    }

    if (!user.isActive) { unauthorized(res, "Account is disabled. Contact support."); return; }

    const accessToken  = signAccessToken({ userId: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin });
    const tokenId      = uuidv4();
    const refreshToken = signRefreshToken({ userId: user.id, tokenId });
    await prisma.refreshToken.create({
      data: { id: tokenId, token: hashToken(refreshToken), userId: user.id, expiresAt: getRefreshExpiryDate() },
    });

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id, isActive: true },
      include: { organization: { select: { id: true, name: true, slug: true, logo: true, currency: true, country: true, businessType: true, isActive: true, enabledModules: true } } },
    });

    setAuthCookies(res, accessToken, refreshToken);
    ok(res, {
      accessToken, refreshToken,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, isSuperAdmin: user.isSuperAdmin },
      organizations: memberships.map((m: any) => ({ ...m.organization, role: m.role })),
    });
  } catch (err) { serverError(res, err); }
}

// ── Verify phone 2FA and issue full tokens ────────────────────
export async function verifyPhone2FA(req: Request, res: Response): Promise<void> {
  try {
    const { tempToken, firebaseIdToken } = req.body;
    if (!tempToken || !firebaseIdToken) { badRequest(res, "tempToken and firebaseIdToken are required"); return; }

    // Verify our own short-lived temp token
    let payload: any;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_ACCESS_SECRET!, { algorithms: ["HS256"] });
    } catch {
      unauthorized(res, "Session expired. Please log in again.");
      return;
    }
    if (payload.action !== "phone_2fa") { unauthorized(res, "Invalid token type"); return; }

    // Verify Firebase phone credential
    let decoded: any;
    try {
      decoded = await verifyFirebaseIdToken(firebaseIdToken);
    } catch {
      unauthorized(res, "Phone verification failed. Please try again.");
      return;
    }
    // Ensure the phone Firebase verified matches what we issued the challenge for
    if (decoded.phone_number !== payload.phone) {
      unauthorized(res, "Phone number mismatch. Verification failed.");
      return;
    }

    const user: any = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) { unauthorized(res, "Account not found or disabled"); return; }

    const accessToken  = signAccessToken({ userId: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin });
    const tokenId      = uuidv4();
    const refreshToken = signRefreshToken({ userId: user.id, tokenId });
    await prisma.refreshToken.create({
      data: { id: tokenId, token: hashToken(refreshToken), userId: user.id, expiresAt: getRefreshExpiryDate() },
    });

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id, isActive: true },
      include: { organization: { select: { id: true, name: true, slug: true, logo: true, currency: true, country: true, businessType: true, isActive: true, enabledModules: true } } },
    });

    setAuthCookies(res, accessToken, refreshToken);
    ok(res, {
      accessToken, refreshToken,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, isSuperAdmin: user.isSuperAdmin },
      organizations: memberships.map((m: any) => ({ ...m.organization, role: m.role })),
    });
  } catch (err) { serverError(res, err); }
}

// ── Unlock account (admin) ────────────────────────────────────
export async function unlockAccount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.params.userId as string;
    const target = await (prisma as any).user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!target) { notFound(res, "User not found"); return; }
    await (prisma as any).user.update({
      where: { id: userId },
      data: { loginAttempts: 0, lockedUntil: null },
    });
    invalidateUserSecState(userId);
    writeAuditLog({ userId: req.userId, userEmail: req.userEmail, action: "ACCOUNT_UNLOCKED", resource: "User", resourceId: userId, description: `Super admin unlocked account ${target.email}`, ipAddress: getIp(req as any) });
    ok(res, null, "Account unlocked");
  } catch (err) { serverError(res, err); }
}
