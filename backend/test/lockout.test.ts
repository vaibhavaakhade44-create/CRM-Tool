import { describe, it, expect, vi } from "vitest";

// auth.controller pulls in prisma / firebase / email at import time — stub them.
vi.mock("../src/lib/prisma", () => ({ prisma: {}, withRetry: (f: any) => f() }));
vi.mock("../src/lib/firebaseAdmin", () => ({ verifyFirebaseIdToken: vi.fn(), isFirebaseConfigured: () => false }));
vi.mock("../src/lib/jwt", () => ({
  signAccessToken: vi.fn(), signRefreshToken: vi.fn(), verifyRefreshToken: vi.fn(), getRefreshExpiryDate: vi.fn(),
}));
vi.mock("../src/utils/email", () => ({
  sendEmail: vi.fn(), verifyEmailTemplate: vi.fn(), resetPasswordTemplate: vi.fn(), esc: (s: string) => s,
}));
vi.mock("../src/utils/auditLog", () => ({ writeAuditLog: vi.fn(), getIp: () => "1.2.3.4" }));
vi.mock("../src/middleware/auth", () => ({ invalidateUserSecState: vi.fn() }));

import { lockDurationFor } from "../src/controllers/auth.controller";

describe("progressive account lockout", () => {
  it("first lock (5 failures) is short — 1 minute", () => {
    expect(lockDurationFor(5)).toBe(60_000);
  });

  it("escalates on repeat lock cycles", () => {
    expect(lockDurationFor(10)).toBe(5 * 60_000);
    expect(lockDurationFor(15)).toBe(15 * 60_000);
    expect(lockDurationFor(20)).toBe(60 * 60_000);
  });

  it("caps at 1 hour no matter how many failures", () => {
    expect(lockDurationFor(50)).toBe(60 * 60_000);
    expect(lockDurationFor(500)).toBe(60 * 60_000);
  });

  it("never returns a non-positive duration", () => {
    for (let n = 5; n <= 100; n += 5) expect(lockDurationFor(n)).toBeGreaterThan(0);
  });
});
