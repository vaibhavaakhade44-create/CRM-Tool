import { z } from "zod";
import { BusinessType, MemberRole } from "@prisma/client";

const GSTIN_RE  = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE    = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IEC_RE    = /^[A-Z0-9]{10}$/;
const PHONE_RE  = /^\+?[\d\s\-()]{7,15}$/;
const PINCODE_RE= /^[0-9]{6}$/;

export const createOrgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters").max(200),
  businessType: z.nativeEnum(BusinessType).optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().refine(v => !v || PHONE_RE.test(v), "Invalid phone number").optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().optional(),
  pincode: z.string().refine(v => !v || PINCODE_RE.test(v), "Pincode must be 6 digits").optional(),
  currency: z.string().optional(),
  taxId: z.string().refine(v => !v || GSTIN_RE.test(v), "Invalid GSTIN. Format: 22AAAAA0000A1Z5").optional(),
  iecCode: z.string().refine(v => !v || IEC_RE.test(v), "Invalid IEC. Must be 10 alphanumeric characters").optional(),
  panNumber: z.string().refine(v => !v || PAN_RE.test(v), "Invalid PAN. Format: AAAAA0000A").optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  enabledModules: z.array(z.string()).optional().default([]),
});

// partial() but without default on enabledModules — prevents clearing modules on profile save
export const updateOrgSchema = createOrgSchema.omit({ enabledModules: true }).partial().extend({
  enabledModules: z.array(z.string()).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(MemberRole).default("STAFF"),
  allowedModules: z.array(z.string()).optional().default([]),
});

export const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(MemberRole),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
