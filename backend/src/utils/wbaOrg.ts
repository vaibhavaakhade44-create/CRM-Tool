import { prisma } from "../lib/prisma";

/**
 * White Band Associates gets a number of organisation-specific rules
 * (restricted HR lists, a 48h lead-overdue rule, hiding leads that have
 * reached Service Delivery, …). Match is resilient: by seeded id, by slug
 * prefix, or by exact name.
 */
export function isWBAOrg(
  org: { id: string; slug: string | null; name: string | null } | null | undefined,
): boolean {
  if (!org) return false;
  return (
    org.id === "wba_org_prod_001" ||
    (org.slug ?? "").toLowerCase().startsWith("white-band-associates") ||
    (org.name ?? "").trim().toLowerCase() === "white band associates"
  );
}

/** Same check, given only an organization id. */
export async function isWBAOrgId(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, slug: true, name: true },
  });
  return isWBAOrg(org);
}

/** Milliseconds in the default "act within" window for a lead with no follow-up date. */
export const LEAD_DEFAULT_FOLLOWUP_MS = 48 * 60 * 60 * 1000;
