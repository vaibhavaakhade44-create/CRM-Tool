import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { ok, badRequest, serverError } from "../utils/response";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

// ── POST /api/2fa/setup ───────────────────────────────────────
// Generates a TOTP secret and returns QR code data URL
export async function setup2FA(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) { badRequest(res, "User not found"); return; }
    if (user.twoFactorEnabled) { badRequest(res, "2FA is already enabled"); return; }

    const secret = speakeasy.generateSecret({
      name: `BusinessOS (${user.email})`,
      issuer: "BusinessOS",
    });

    // Store the temp secret (not yet confirmed)
    await prisma.user.update({
      where: { id: req.userId! },
      data: { twoFactorSecret: secret.base32 },
    });

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url!);
    ok(res, { qrDataUrl, secret: secret.base32, otpauthUrl: secret.otpauth_url });
  } catch (e) {
    serverError(res, e);
  }
}

// ── POST /api/2fa/verify ──────────────────────────────────────
// Verifies the OTP and enables 2FA
export async function verify2FA(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { token } = req.body as { token: string };
    if (!token) { badRequest(res, "OTP token required"); return; }

    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user?.twoFactorSecret) { badRequest(res, "2FA setup not initiated"); return; }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token,
      window: 1,
    });

    if (!valid) { badRequest(res, "Invalid OTP. Please try again."); return; }

    await prisma.user.update({
      where: { id: req.userId! },
      data: { twoFactorEnabled: true },
    });

    ok(res, { message: "2FA enabled successfully" });
  } catch (e) {
    serverError(res, e);
  }
}

// ── POST /api/2fa/disable ─────────────────────────────────────
// Disables 2FA after verifying current OTP
export async function disable2FA(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { token } = req.body as { token: string };
    if (!token) { badRequest(res, "OTP token required"); return; }

    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) { badRequest(res, "2FA is not enabled"); return; }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token,
      window: 1,
    });

    if (!valid) { badRequest(res, "Invalid OTP"); return; }

    await prisma.user.update({
      where: { id: req.userId! },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    ok(res, { message: "2FA disabled" });
  } catch (e) {
    serverError(res, e);
  }
}

// ── POST /api/2fa/validate ────────────────────────────────────
// Called during login to validate a 2FA token (used by auth flow)
export async function validate2FAToken(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { token } = req.body as { token: string };
    if (!token) { badRequest(res, "OTP token required"); return; }

    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user?.twoFactorSecret) { badRequest(res, "2FA not set up"); return; }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token,
      window: 1,
    });

    if (!valid) { badRequest(res, "Invalid OTP"); return; }
    ok(res, { valid: true });
  } catch (e) {
    serverError(res, e);
  }
}

// ── GET /api/2fa/status ───────────────────────────────────────
export async function get2FAStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { twoFactorEnabled: true },
    });
    ok(res, { enabled: user?.twoFactorEnabled ?? false });
  } catch (e) {
    serverError(res, e);
  }
}
