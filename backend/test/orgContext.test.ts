import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client the middleware imports.
const findOrg = vi.fn();
const findMember = vi.fn();
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    organization: { findUnique: (...a: unknown[]) => findOrg(...a) },
    organizationMember: { findUnique: (...a: unknown[]) => findMember(...a) },
  },
}));

import { requireOrgContext } from "../src/middleware/orgContext";

function mkRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((b: unknown) => { res.body = b; return res; });
  return res;
}
function mkReq(over: Record<string, unknown> = {}) {
  return {
    headers: { "x-organization-id": "org-A" },
    method: "GET",
    baseUrl: "/api/leads",
    path: "/",
    userId: "user-1",
    ...over,
  } as any;
}

beforeEach(() => {
  findOrg.mockReset();
  findMember.mockReset();
});

describe("requireOrgContext — tenant isolation", () => {
  it("rejects when x-organization-id header is missing", async () => {
    const res = mkRes();
    const next = vi.fn();
    await requireOrgContext(mkReq({ headers: {} }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("404s when the org does not exist or is inactive", async () => {
    findOrg.mockResolvedValue(null);
    const res = mkRes();
    const next = vi.fn();
    await requireOrgContext(mkReq(), res, next);
    expect(res.statusCode).toBe(404);
    expect(next).not.toHaveBeenCalled();

    findOrg.mockResolvedValue({ id: "org-A", isActive: false });
    const res2 = mkRes();
    await requireOrgContext(mkReq(), res2, vi.fn());
    expect(res2.statusCode).toBe(404);
  });

  it("forbids a user who is not a member of the requested org (cross-tenant)", async () => {
    findOrg.mockResolvedValue({ id: "org-A", isActive: true });
    findMember.mockResolvedValue(null); // user-1 belongs to org-B, asked for org-A
    const res = mkRes();
    const next = vi.fn();
    await requireOrgContext(mkReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("forbids a member whose membership is deactivated", async () => {
    findOrg.mockResolvedValue({ id: "org-A", isActive: true });
    findMember.mockResolvedValue({ role: "STAFF", isActive: false });
    const res = mkRes();
    const next = vi.fn();
    await requireOrgContext(mkReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("attaches organizationId + role for an active member", async () => {
    findOrg.mockResolvedValue({ id: "org-A", isActive: true });
    findMember.mockResolvedValue({ role: "MANAGER", isActive: true });
    const req = mkReq();
    const next = vi.fn();
    await requireOrgContext(req, mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.organizationId).toBe("org-A");
    expect(req.memberRole).toBe("MANAGER");
  });

  it("blocks VIEWER write verbs but allows VIEWER reads", async () => {
    findOrg.mockResolvedValue({ id: "org-A", isActive: true });
    findMember.mockResolvedValue({ role: "VIEWER", isActive: true });

    const writeRes = mkRes();
    const writeNext = vi.fn();
    await requireOrgContext(mkReq({ method: "DELETE", path: "/123" }), writeRes, writeNext);
    expect(writeNext).not.toHaveBeenCalled();
    expect(writeRes.statusCode).toBe(403);

    const readNext = vi.fn();
    await requireOrgContext(mkReq({ method: "GET" }), mkRes(), readNext);
    expect(readNext).toHaveBeenCalledOnce();
  });

  it("lets VIEWER write to allowlisted personal paths (notifications)", async () => {
    findOrg.mockResolvedValue({ id: "org-A", isActive: true });
    findMember.mockResolvedValue({ role: "VIEWER", isActive: true });
    const next = vi.fn();
    await requireOrgContext(
      mkReq({ method: "PATCH", baseUrl: "/api/notifications", path: "/123/read" }),
      mkRes(),
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
