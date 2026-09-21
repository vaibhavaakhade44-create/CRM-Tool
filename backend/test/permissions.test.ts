import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { MemberRole } from "@prisma/client";
import { PERMISSIONS, can, isKnownPermission, roleRank } from "../src/config/permissions";

const ALL_ROLES = Object.values(MemberRole);

describe("permission matrix integrity", () => {
  it("every entry maps to a real MemberRole", () => {
    for (const [key, role] of Object.entries(PERMISSIONS)) {
      expect(ALL_ROLES, `${key} -> ${role}`).toContain(role);
    }
  });

  it("every permission key is <module>:<action>", () => {
    for (const key of Object.keys(PERMISSIONS)) {
      expect(key).toMatch(/^[a-z]+:[a-z]+$/);
    }
  });

  it("role rank is strictly ordered OWNER > ADMIN > MANAGER > ACCOUNTANT > STAFF > VIEWER", () => {
    expect(roleRank("OWNER")).toBeGreaterThan(roleRank("ADMIN"));
    expect(roleRank("ADMIN")).toBeGreaterThan(roleRank("MANAGER"));
    expect(roleRank("MANAGER")).toBeGreaterThan(roleRank("ACCOUNTANT"));
    expect(roleRank("ACCOUNTANT")).toBeGreaterThan(roleRank("STAFF"));
    expect(roleRank("STAFF")).toBeGreaterThan(roleRank("VIEWER"));
  });
});

describe("can()", () => {
  it("OWNER passes every known permission", () => {
    for (const key of Object.keys(PERMISSIONS)) {
      expect(can("OWNER", key), key).toBe(true);
    }
  });

  it("ADMIN passes everything except OWNER-only keys", () => {
    for (const [key, min] of Object.entries(PERMISSIONS)) {
      expect(can("ADMIN", key), key).toBe(min !== "OWNER");
    }
  });

  it("VIEWER only passes *:read permissions", () => {
    for (const [key, min] of Object.entries(PERMISSIONS)) {
      expect(can("VIEWER", key), key).toBe(min === "VIEWER");
    }
  });

  it("ACCOUNTANT can write finance but STAFF cannot", () => {
    expect(can("ACCOUNTANT", "finance:create")).toBe(true);
    expect(can("ACCOUNTANT", "finance:update")).toBe(true);
    expect(can("STAFF", "finance:create")).toBe(false);
  });

  it("MANAGER can delete but STAFF cannot", () => {
    expect(can("MANAGER", "inventory:delete")).toBe(true);
    expect(can("STAFF", "inventory:delete")).toBe(false);
  });

  it("STAFF can do day-to-day create/update on operational modules", () => {
    expect(can("STAFF", "crm:create")).toBe(true);
    expect(can("STAFF", "leads:update")).toBe(true);
    expect(can("STAFF", "inventory:adjust")).toBe(true);
  });

  it("admin-config permissions require ADMIN", () => {
    for (const key of ["members:manage", "webhooks:manage", "apikeys:manage", "branding:manage", "modules:manage"]) {
      expect(can("MANAGER", key), key).toBe(false);
      expect(can("ADMIN", key), key).toBe(true);
    }
  });

  it("security:manage is OWNER-only", () => {
    expect(can("ADMIN", "security:manage")).toBe(false);
    expect(can("OWNER", "security:manage")).toBe(true);
  });

  it("unknown permission fails closed (OWNER-only)", () => {
    expect(can("ADMIN", "does:notexist")).toBe(false);
    expect(can("OWNER", "does:notexist")).toBe(true);
    expect(isKnownPermission("does:notexist")).toBe(false);
  });

  it("undefined role never passes", () => {
    expect(can(undefined, "crm:read")).toBe(false);
  });
});

describe("route wiring stays in sync with the matrix", () => {
  it("every requirePermission(\"…\") string used in src/routes exists in the matrix", () => {
    const routesDir = path.join(__dirname, "../src/routes");
    const files = fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts"));
    const missing: string[] = [];
    const re = /requirePermission\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
    for (const f of files) {
      const src = fs.readFileSync(path.join(routesDir, f), "utf8");
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        if (!isKnownPermission(m[1])) missing.push(`${f}: ${m[1]}`);
      }
    }
    expect(missing, `unknown permission keys referenced by routes:\n${missing.join("\n")}`).toEqual([]);
  });
});
