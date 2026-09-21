import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks for everything auth.controller pulls in at import time ──
const userFindUnique = vi.fn();
const memberFindMany = vi.fn();
const rtCreate = vi.fn();
const sessFindFirst = vi.fn();
const sessUpdateMany = vi.fn();
const sessCreate = vi.fn();
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    organizationMember: { findMany: (...a: unknown[]) => memberFindMany(...a) },
    refreshToken: { create: (...a: unknown[]) => rtCreate(...a) },
    userSession: {
      findFirst: (...a: unknown[]) => sessFindFirst(...a),
      updateMany: (...a: unknown[]) => sessUpdateMany(...a),
      create: (...a: unknown[]) => sessCreate(...a),
    },
  },
  withRetry: (f: any) => f(),
}));
vi.mock("../src/lib/firebaseAdmin", () => ({ verifyFirebaseIdToken: vi.fn(), isFirebaseConfigured: () => false }));
vi.mock("../src/lib/jwt", () => ({
  signAccessToken: () => "access.jwt",
  signRefreshToken: () => "refresh.jwt",
  verifyRefreshToken: vi.fn(),
  getRefreshExpiryDate: () => new Date(Date.now() + 1e9),
}));
vi.mock("../src/utils/email", () => ({
  sendEmail: vi.fn(), verifyEmailTemplate: vi.fn(), resetPasswordTemplate: vi.fn(), esc: (s: string) => s,
}));
vi.mock("../src/utils/auditLog", () => ({ writeAuditLog: vi.fn(), getIp: () => "1.2.3.4" }));
vi.mock("../src/middleware/auth", () => ({ invalidateUserSecState: vi.fn() }));

const totpVerify = vi.fn();
vi.mock("speakeasy", () => ({ default: { totp: { verify: (...a: unknown[]) => totpVerify(...a) } } }));

const jwtVerify = vi.fn();
vi.mock("jsonwebtoken", () => ({ default: { verify: (...a: unknown[]) => jwtVerify(...a), sign: () => "temp.jwt" } }));

import { verify2FALogin } from "../src/controllers/auth.controller";

function mkRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((b: unknown) => { res.body = b; return res; });
  res.cookie = vi.fn();
  res.clearCookie = vi.fn();
  return res;
}
const mkReq = (body: unknown) => ({ body, headers: {}, socket: {} } as any);

beforeEach(() => {
  userFindUnique.mockReset();
  totpVerify.mockReset();
  jwtVerify.mockReset();
  memberFindMany.mockResolvedValue([]);
  rtCreate.mockResolvedValue({});
  sessFindFirst.mockResolvedValue(null);
  sessUpdateMany.mockResolvedValue({});
  sessCreate.mockResolvedValue({});
});

describe("verify2FALogin", () => {
  it("400s when tempToken or token is missing", async () => {
    const res = mkRes();
    await verify2FALogin(mkReq({ tempToken: "x" }), res);
    expect(res.statusCode).toBe(400);
  });

  it("401s when the challenge token is not a totp_2fa token", async () => {
    jwtVerify.mockReturnValue({ userId: "u1", action: "something_else" });
    const res = mkRes();
    await verify2FALogin(mkReq({ tempToken: "t", token: "123456" }), res);
    expect(res.statusCode).toBe(401);
  });

  it("401s when the challenge token is invalid/expired", async () => {
    jwtVerify.mockImplementation(() => { throw new Error("expired"); });
    const res = mkRes();
    await verify2FALogin(mkReq({ tempToken: "t", token: "123456" }), res);
    expect(res.statusCode).toBe(401);
  });

  it("401s on an incorrect TOTP code", async () => {
    jwtVerify.mockReturnValue({ userId: "u1", action: "totp_2fa" });
    userFindUnique.mockResolvedValue({ id: "u1", isActive: true, twoFactorEnabled: true, twoFactorSecret: "SECRET" });
    totpVerify.mockReturnValue(false);
    const res = mkRes();
    await verify2FALogin(mkReq({ tempToken: "t", token: "000000" }), res);
    expect(res.statusCode).toBe(401);
  });

  it("issues a session when the TOTP code is valid", async () => {
    jwtVerify.mockReturnValue({ userId: "u1", action: "totp_2fa" });
    userFindUnique.mockResolvedValue({ id: "u1", email: "u@x.com", name: "U", isActive: true, twoFactorEnabled: true, twoFactorSecret: "SECRET" });
    totpVerify.mockReturnValue(true);
    const res = mkRes();
    await verify2FALogin(mkReq({ tempToken: "t", token: "123456" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body?.data?.accessToken).toBe("access.jwt");
  });

  it("rejects a disabled/nonexistent user", async () => {
    jwtVerify.mockReturnValue({ userId: "u1", action: "totp_2fa" });
    userFindUnique.mockResolvedValue({ id: "u1", isActive: false });
    const res = mkRes();
    await verify2FALogin(mkReq({ tempToken: "t", token: "123456" }), res);
    expect(res.statusCode).toBe(401);
  });
});
