import { describe, it, expect, vi, beforeEach } from "vitest";

// The middleware reads process.env.RBAC_ENFORCE at module-load time, so we
// re-import it with vi.resetModules() per scenario.
vi.mock("../src/utils/auditLog", () => ({
  writeAuditLog: vi.fn(),
  getIp: vi.fn(() => "1.2.3.4"),
}));

function mkRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((b: unknown) => { res.body = b; return res; });
  return res;
}

async function loadMiddleware(enforce: boolean) {
  vi.resetModules();
  process.env.RBAC_ENFORCE = enforce ? "true" : "false";
  const mod = await import("../src/middleware/requirePermission");
  return mod.requirePermission;
}

describe("requirePermission — report-only mode (default)", () => {
  let requirePermission: any;
  beforeEach(async () => { requirePermission = await loadMiddleware(false); });

  it("calls next() even when the role is too low", () => {
    const next = vi.fn();
    const res = mkRes();
    requirePermission("finance:create")({ memberRole: "STAFF" } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("still calls next() for an allowed role", () => {
    const next = vi.fn();
    requirePermission("finance:create")({ memberRole: "ACCOUNTANT" } as any, mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("403s when there is no org context regardless of mode", () => {
    const next = vi.fn();
    const res = mkRes();
    requirePermission("finance:create")({} as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});

describe("requirePermission — enforcing mode", () => {
  let requirePermission: any;
  beforeEach(async () => { requirePermission = await loadMiddleware(true); });

  it("403s a role below the threshold", () => {
    const next = vi.fn();
    const res = mkRes();
    requirePermission("finance:create")({ memberRole: "STAFF", userId: "u1", organizationId: "o1" } as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("allows a role at or above the threshold", () => {
    const next = vi.fn();
    const res = mkRes();
    requirePermission("finance:create")({ memberRole: "ACCOUNTANT" } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("OWNER passes everything, VIEWER passes only reads", () => {
    const nextOwner = vi.fn();
    requirePermission("security:manage")({ memberRole: "OWNER" } as any, mkRes(), nextOwner);
    expect(nextOwner).toHaveBeenCalledOnce();

    const nextViewer = vi.fn();
    const res = mkRes();
    requirePermission("crm:create")({ memberRole: "VIEWER" } as any, res, nextViewer);
    expect(nextViewer).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("unknown permission fails closed for a non-owner", () => {
    const next = vi.fn();
    const res = mkRes();
    requirePermission("bogus:key")({ memberRole: "ADMIN" } as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
