// ── Auth & User ──────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  isSuperAdmin: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  organizations: OrganizationSummary[];
}

// ── Organization ─────────────────────────────────────────────
export type MemberRole = "OWNER" | "ADMIN" | "MANAGER" | "STAFF" | "ACCOUNTANT" | "VIEWER";
export type BusinessType = "IMPORT" | "EXPORT" | "IMPORT_EXPORT" | "TRADING" | "MANUFACTURING" | "OTHER";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  businessType: BusinessType;
  currency: string;
  country: string;
  isActive: boolean;
  role: MemberRole;
  joinedAt?: string;
  enabledModules: string[];
}

export interface Organization extends OrganizationSummary {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  taxId?: string | null;
  iecCode?: string | null;
  panNumber?: string | null;
  website?: string | null;
  members: OrgMember[];
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: MemberRole;
  joinedAt: string;
  lastLoginAt?: string | null;
}

// ── API Response wrapper ─────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  errors?: Record<string, string[]>;
}

// ── CRM ──────────────────────────────────────────────────────
export type PartyType = "CUSTOMER" | "SUPPLIER" | "BOTH";
export type CommunicationType = "CALL" | "EMAIL" | "MEETING" | "NOTE" | "WHATSAPP";

export interface Contact {
  id: string;
  name: string;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface Communication {
  id: string;
  type: CommunicationType;
  subject?: string | null;
  description: string;
  outcome?: string | null;
  followUpDate?: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; avatar?: string | null };
}

export interface Party {
  id: string;
  type: PartyType;
  name: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  pan?: string | null;
  iecCode?: string | null;
  currency: string;
  creditLimit?: number | null;
  paymentTermsDays?: number | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIfsc?: string | null;
  bankBranch?: string | null;
  notes?: string | null;
  tags?: string[];
  isActive: boolean;
  assignedToId?: string | null;
  createdAt: string;
  updatedAt: string;
  contacts?: Contact[];
  communications?: Communication[];
  _count?: { communications: number };
}

export interface CrmStats {
  customers: number;
  suppliers: number;
  both: number;
  total: number;
  followUpsThisWeek: number;
}

// ── Form types ───────────────────────────────────────────────
export interface RegisterForm {
  name: string;
  email: string;
  password: string;
}

export interface LoginForm {
  email: string;
  password: string;
}

export interface CreateOrgForm {
  name: string;
  businessType?: BusinessType;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  currency?: string;
  taxId?: string;
  iecCode?: string;
}
