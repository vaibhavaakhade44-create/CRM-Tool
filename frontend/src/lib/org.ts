import type { OrganizationSummary } from "@/types";

/**
 * White Band Associates gets a few organisation-specific UI rules
 * (hidden nav sections, a fixed designation list, …).
 * Match is resilient: by seeded id, by slug prefix, or by exact name.
 */
export function isWBAOrg(org?: OrganizationSummary | null): boolean {
  if (!org) return false;
  return (
    org.id === "wba_org_prod_001" ||
    (org.slug ?? "").toLowerCase().startsWith("white-band-associates") ||
    (org.name ?? "").trim().toLowerCase() === "white band associates"
  );
}

/** Designations offered strictly for White Band Associates (VAPT / GRC / training focused). */
export const WBA_DESIGNATIONS = [
  "VAPT Intern",
  "GRC Intern",
  "Sales Intern",
  "Cyber Security Analyst",
  "Sales Manager",
  "Sales Executive",
  "Networking Tutor",
  "Linux Tutor",
  "CS Tutor",
  "Ethical Hacking Tutor",
] as const;

/** Departments for White Band Associates. */
export const WBA_DEPARTMENTS = ["Training", "Services"] as const;

/** Salary types for White Band Associates (map to the SalaryType enum). */
export const WBA_SALARY_TYPES = [
  { value: "FIXED", label: "Fixed" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "INCENTIVE", label: "Incentive" },
] as const;

/** Leave types for White Band Associates — adds Half Day to the standard list. */
export const WBA_LEAVE_TYPES = [
  "Half Day",
  "Annual",
  "Sick",
  "Casual",
  "Compensatory",
  "Unpaid",
  "Other",
] as const;
