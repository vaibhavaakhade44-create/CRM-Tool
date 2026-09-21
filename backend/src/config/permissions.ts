import { MemberRole } from "@prisma/client";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  RBAC PERMISSION MATRIX  —  single source of truth
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Every entry maps a permission key (`<module>:<action>`) to the *minimum*
 *  organization role that may perform it. Role rank (high → low):
 *
 *      OWNER (6) > ADMIN (5) > MANAGER (4) > ACCOUNTANT (3) > STAFF (2) > VIEWER (1)
 *
 *  `can(role, "finance:create")` is true when the caller's rank ≥ the entry's
 *  rank. OWNER and ADMIN therefore clear everything except `*:owner` keys.
 *
 *  ⚠️  THE VALUES BELOW ARE A CONSERVATIVE DEFAULT, not a product decision that
 *  has been signed off. They follow common CRM/ERP conventions:
 *    • read  ................ VIEWER   (any member can look)
 *    • create / update ...... STAFF    (day-to-day operational work)
 *    • delete ............... MANAGER  (destructive)
 *    • approve ............. MANAGER  (POs, leave, invoice cancellation, …)
 *    • money write ......... ACCOUNTANT (invoices, expenses, payments)
 *    • money delete ....... MANAGER
 *    • HR lifecycle / payroll  MANAGER
 *    • org / module / branding / webhook / api-key / automation config  ADMIN
 *    • security & platform ... OWNER
 *
 *  Adjust freely — this file is the only place to change. Keep it in sync with
 *  the `requirePermission("…")` calls in src/routes/*. The test suite fails if a
 *  route references a key that is missing here.
 */

const R = MemberRole;

export const PERMISSIONS: Record<string, MemberRole> = {
  // ── CRM / parties / contacts ──────────────────────────────
  "crm:read": R.VIEWER,
  "crm:create": R.STAFF,
  "crm:update": R.STAFF,
  "crm:delete": R.MANAGER,

  // ── Leads / deals / campaigns ─────────────────────────────
  "leads:read": R.VIEWER,
  "leads:create": R.STAFF,
  "leads:update": R.STAFF,
  "leads:delete": R.MANAGER,
  "leads:convert": R.STAFF,

  // ── Inventory / products / stock ──────────────────────────
  "inventory:read": R.VIEWER,
  "inventory:create": R.STAFF,
  "inventory:update": R.STAFF,
  "inventory:delete": R.MANAGER,
  "inventory:adjust": R.STAFF, // stock movements / adjustments

  // ── Warehouses / transfers / goods entries ────────────────
  "warehouse:read": R.VIEWER,
  "warehouse:create": R.STAFF,
  "warehouse:update": R.STAFF,
  "warehouse:delete": R.MANAGER,
  "warehouse:transfer": R.STAFF,

  // ── Purchase orders ──────────────────────────────────────
  "purchase:read": R.VIEWER,
  "purchase:create": R.STAFF,
  "purchase:update": R.STAFF,
  "purchase:approve": R.MANAGER,
  "purchase:delete": R.MANAGER,

  // ── Sales orders / quotations / dispatch ─────────────────
  "sales:read": R.VIEWER,
  "sales:create": R.STAFF,
  "sales:update": R.STAFF,
  "sales:delete": R.MANAGER,

  // ── Finance: invoices / payments / expenses ──────────────
  "finance:read": R.VIEWER,
  "finance:create": R.ACCOUNTANT,
  "finance:update": R.ACCOUNTANT,
  "finance:delete": R.MANAGER,
  "finance:approve": R.MANAGER, // cancel / write-off / approve

  // ── Budgets ──────────────────────────────────────────────
  "budget:read": R.VIEWER,
  "budget:write": R.ACCOUNTANT,
  "budget:delete": R.MANAGER,

  // ── HR: employees / attendance / leave / payroll ─────────
  "hr:read": R.VIEWER,
  "hr:create": R.MANAGER,
  "hr:update": R.MANAGER,
  "hr:delete": R.MANAGER,
  "hr:approve": R.MANAGER, // leave approvals
  "hr:payroll": R.MANAGER,

  // ── Projects / tasks / sprints ──────────────────────────
  "projects:read": R.VIEWER,
  "projects:create": R.STAFF,
  "projects:update": R.STAFF,
  "projects:delete": R.MANAGER,

  // ── Support tickets ─────────────────────────────────────
  "support:read": R.VIEWER,
  "support:create": R.STAFF,
  "support:update": R.STAFF,
  "support:delete": R.MANAGER,

  // ── Documents ───────────────────────────────────────────
  "documents:read": R.VIEWER,
  "documents:create": R.STAFF,
  "documents:delete": R.MANAGER,

  // ── Org configuration (settings, members, modules, branding) ─
  "org:read": R.VIEWER,
  "org:update": R.ADMIN,
  "members:read": R.STAFF,
  "members:manage": R.ADMIN,
  "modules:manage": R.ADMIN,
  "branding:manage": R.ADMIN,
  "customfields:manage": R.ADMIN,
  "automation:manage": R.ADMIN,
  "webhooks:manage": R.ADMIN,
  "apikeys:manage": R.ADMIN,
  "compliance:manage": R.ADMIN,

  // ── Security / platform ─────────────────────────────────
  "security:manage": R.OWNER,
  "audit:read": R.ADMIN,
};

const RANK: Record<MemberRole, number> = {
  OWNER: 6,
  ADMIN: 5,
  MANAGER: 4,
  ACCOUNTANT: 3,
  STAFF: 2,
  VIEWER: 1,
};

export function roleRank(role: MemberRole): number {
  return RANK[role] ?? 0;
}

/** True if `role` meets or exceeds the minimum for `permission`. */
export function can(role: MemberRole | undefined, permission: string): boolean {
  if (!role) return false;
  const min = PERMISSIONS[permission];
  // Unknown permission → fail closed (treat as OWNER-only).
  if (min === undefined) return role === MemberRole.OWNER;
  return roleRank(role) >= roleRank(min);
}

export function isKnownPermission(permission: string): boolean {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, permission);
}
