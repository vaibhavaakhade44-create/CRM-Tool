import { describe, it, expect, vi, beforeEach } from "vitest";

function mkRes() {
  const res: any = { cookies: {} as Record<string, any>, cleared: [] as string[] };
  res.cookie = vi.fn((name: string, val: string, opts: any) => { res.cookies[name] = { val, opts }; });
  res.clearCookie = vi.fn((name: string, opts: any) => { res.cleared.push(name); res.clearedOpts = opts; });
  return res;
}

async function load(prod: boolean) {
  vi.resetModules();
  process.env.NODE_ENV = prod ? "production" : "development";
  return import("../src/lib/authCookies");
}

describe("auth cookies", () => {
  it("sets httpOnly, SameSite=Lax cookies; refresh scoped to /api/auth", async () => {
    const { setAuthCookies, ACCESS_COOKIE, REFRESH_COOKIE } = await load(true);
    const res = mkRes();
    setAuthCookies(res as any, "atk", "rtk");

    const a = res.cookies[ACCESS_COOKIE];
    const r = res.cookies[REFRESH_COOKIE];
    expect(a.val).toBe("atk");
    expect(a.opts.httpOnly).toBe(true);
    expect(a.opts.sameSite).toBe("lax");
    expect(a.opts.secure).toBe(true);         // production
    expect(a.opts.path).toBe("/");
    expect(r.val).toBe("rtk");
    expect(r.opts.httpOnly).toBe(true);
    expect(r.opts.path).toBe("/api/auth");    // not sent on every request
  });

  it("does not set Secure outside production", async () => {
    const { setAuthCookies, ACCESS_COOKIE } = await load(false);
    const res = mkRes();
    setAuthCookies(res as any, "a", "b");
    expect(res.cookies[ACCESS_COOKIE].opts.secure).toBe(false);
  });

  it("clears both cookies", async () => {
    const { clearAuthCookies, ACCESS_COOKIE, REFRESH_COOKIE } = await load(true);
    const res = mkRes();
    clearAuthCookies(res as any);
    expect(res.cleared).toContain(ACCESS_COOKIE);
    expect(res.cleared).toContain(REFRESH_COOKIE);
  });
});
