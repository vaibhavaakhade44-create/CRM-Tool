import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyRequestOrigin } from "../src/middleware/verifyRequestOrigin";

function mkRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((b: unknown) => { res.body = b; return res; });
  return res;
}
function mkReq(over: Record<string, unknown> = {}) {
  return { method: "POST", headers: {}, cookies: {}, ...over } as any;
}

const OLD_ENV = { ...process.env };
beforeEach(() => {
  process.env.NODE_ENV = "production";
  process.env.FRONTEND_URL = "https://app.example.com,https://www.example.com";
});
afterEach(() => { process.env = { ...OLD_ENV }; });

describe("verifyRequestOrigin (CSRF origin check)", () => {
  it("lets safe methods through untouched", () => {
    const next = vi.fn();
    verifyRequestOrigin(mkReq({ method: "GET", cookies: { bos_access: "x" } }), mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("ignores requests authenticated by Authorization header", () => {
    const next = vi.fn();
    verifyRequestOrigin(
      mkReq({ headers: { authorization: "Bearer abc", origin: "https://evil.test" }, cookies: { bos_access: "x" } }),
      mkRes(), next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("ignores requests with no auth cookie (nothing to protect)", () => {
    const next = vi.fn();
    verifyRequestOrigin(mkReq({ headers: { origin: "https://evil.test" } }), mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("blocks a cookie-authed POST from a foreign Origin", () => {
    const next = vi.fn();
    const res = mkRes();
    verifyRequestOrigin(
      mkReq({ headers: { origin: "https://evil.test" }, cookies: { bos_access: "x" } }),
      res, next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("blocks a cookie-authed POST with NO Origin/Referer", () => {
    const next = vi.fn();
    const res = mkRes();
    verifyRequestOrigin(mkReq({ cookies: { bos_access: "x" } }), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a cookie-authed POST from an allowed Origin", () => {
    const next = vi.fn();
    verifyRequestOrigin(
      mkReq({ headers: { origin: "https://app.example.com" }, cookies: { bos_access: "x" } }),
      mkRes(), next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("falls back to Referer when Origin is absent", () => {
    const next = vi.fn();
    verifyRequestOrigin(
      mkReq({ headers: { referer: "https://www.example.com/dashboard" }, cookies: { bos_access: "x" } }),
      mkRes(), next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("allows any localhost origin in non-production", () => {
    process.env.NODE_ENV = "development";
    const next = vi.fn();
    verifyRequestOrigin(
      mkReq({ headers: { origin: "http://localhost:5199" }, cookies: { bos_access: "x" } }),
      mkRes(), next,
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
