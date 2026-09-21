import { z } from "zod";
import { PartyType, CommunicationType } from "@prisma/client";

const GSTIN_RE  = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE    = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE   = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const IEC_RE    = /^[A-Z0-9]{10}$/;
const PHONE_RE  = /^\+?[\d\s\-()]{7,15}$/;
const PINCODE_RE= /^[0-9]{6}$/;
const BANK_AC_RE= /^[0-9]{9,18}$/;

export const createPartySchema = z.object({
  type:             z.nativeEnum(PartyType).default("CUSTOMER"),
  name:             z.string().min(2, "Name must be at least 2 characters").max(200),
  displayName:      z.string().max(200).optional(),
  email:            z.string().email("Invalid email").optional().or(z.literal("")),
  phone:            z.string().refine(v => !v || PHONE_RE.test(v), "Invalid phone number").optional(),
  mobile:           z.string().refine(v => !v || PHONE_RE.test(v), "Invalid mobile number").optional(),
  website:          z.string().url("Invalid URL").optional().or(z.literal("")),
  address:          z.string().optional(),
  city:             z.string().max(100).optional(),
  state:            z.string().max(100).optional(),
  country:          z.string().optional(),
  pincode:          z.string().refine(v => !v || PINCODE_RE.test(v), "Pincode must be 6 digits").optional(),
  gstin:            z.string().refine(v => !v || GSTIN_RE.test(v), "Invalid GSTIN. Format: 22AAAAA0000A1Z5").optional(),
  pan:              z.string().refine(v => !v || PAN_RE.test(v), "Invalid PAN. Format: AAAAA0000A").optional(),
  iecCode:          z.string().refine(v => !v || IEC_RE.test(v), "Invalid IEC code. Must be 10 alphanumeric characters").optional(),
  currency:         z.string().optional(),
  creditLimit:      z.number().nonnegative().optional(),
  paymentTermsDays: z.number().int().nonnegative().optional(),
  bankName:         z.string().max(100).optional(),
  bankAccount:      z.string().refine(v => !v || BANK_AC_RE.test(v), "Bank account must be 9–18 digits").optional(),
  bankIfsc:         z.string().refine(v => !v || IFSC_RE.test(v), "Invalid IFSC. Format: ABCD0123456").optional(),
  bankBranch:       z.string().max(100).optional(),
  notes:            z.string().optional(),
  tags:             z.array(z.string()).optional(),
  assignedToId:     z.string().optional().or(z.literal("")),
});

export const updatePartySchema = createPartySchema.partial();

export const createContactSchema = z.object({
  name:        z.string().min(1, "Contact name is required"),
  designation: z.string().optional(),
  email:       z.string().email("Invalid email").optional().or(z.literal("")),
  phone:       z.string().optional(),
  mobile:      z.string().optional(),
  isPrimary:   z.boolean().optional(),
  notes:       z.string().optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const createCommunicationSchema = z.object({
  type:          z.nativeEnum(CommunicationType).default("NOTE"),
  subject:       z.string().optional(),
  description:   z.string().min(1, "Description is required"),
  outcome:       z.string().optional(),
  followUpDate:  z.string().datetime().optional().or(z.literal("")),
});

export const partyQuerySchema = z.object({
  type:   z.nativeEnum(PartyType).optional(),
  search: z.string().optional(),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(1000).default(20),
});

export type CreatePartyInput      = z.infer<typeof createPartySchema>;
export type CreateContactInput    = z.infer<typeof createContactSchema>;
export type CreateCommunicationInput = z.infer<typeof createCommunicationSchema>;
