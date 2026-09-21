import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { ok, created, badRequest, notFound, serverError } from "../utils/response";

const db = () => (prisma as any);

const fieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  type: z.enum(["text", "email", "phone", "textarea", "select", "checkbox"]),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

const formSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(fieldSchema).min(1),
  successMessage: z.string().optional(),
  isActive: z.boolean().optional(),
  defaultSource: z.string().optional(),
  defaultCampaignId: z.string().optional(),
  assignToId: z.string().optional(),
});

// ── List forms ────────────────────────────────────────────────
export async function listForms(req: OrgRequest, res: Response): Promise<void> {
  try {
    const forms = await db().leadForm.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, description: true, isActive: true,
        defaultSource: true, submitCount: true, createdAt: true, fields: true,
      },
    });
    ok(res, forms);
  } catch (e) { serverError(res, e); }
}

// ── Get single form ───────────────────────────────────────────
export async function getForm(req: OrgRequest, res: Response): Promise<void> {
  try {
    const form = await db().leadForm.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!form) { notFound(res, "Form not found"); return; }
    ok(res, form);
  } catch (e) { serverError(res, e); }
}

// ── Create form ───────────────────────────────────────────────
export async function createForm(req: OrgRequest, res: Response): Promise<void> {
  try {
    const d = formSchema.safeParse(req.body);
    if (!d.success) { badRequest(res, "Invalid form data", d.error.flatten()); return; }

    const form = await db().leadForm.create({
      data: {
        organizationId: req.organizationId!,
        name: d.data.name,
        description: d.data.description || null,
        fields: d.data.fields,
        successMessage: d.data.successMessage || "Thank you! We'll be in touch soon.",
        isActive: d.data.isActive ?? true,
        defaultSource: d.data.defaultSource || "WEBSITE",
        defaultCampaignId: d.data.defaultCampaignId || null,
        assignToId: d.data.assignToId || null,
      },
    });
    created(res, form);
  } catch (e) { serverError(res, e); }
}

// ── Update form ───────────────────────────────────────────────
export async function updateForm(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().leadForm.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Form not found"); return; }

    const d = formSchema.partial().safeParse(req.body);
    if (!d.success) { badRequest(res, "Invalid form data", d.error.flatten()); return; }

    const form = await db().leadForm.update({
      where: { id: req.params.id },
      data: { ...d.data, updatedAt: new Date() },
    });
    ok(res, form);
  } catch (e) { serverError(res, e); }
}

// ── Delete form ───────────────────────────────────────────────
export async function deleteForm(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().leadForm.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Form not found"); return; }
    await db().leadForm.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  } catch (e) { serverError(res, e); }
}

// ── Get form submissions ──────────────────────────────────────
export async function getSubmissions(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await db().leadForm.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Form not found"); return; }

    const submissions = await db().leadFormSubmission.findMany({
      where: { formId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    ok(res, submissions);
  } catch (e) { serverError(res, e); }
}

// ── PUBLIC: Get form by ID (no auth) ─────────────────────────
export async function getPublicForm(req: Request, res: Response): Promise<void> {
  try {
    const form = await db().leadForm.findFirst({
      where: { id: req.params.id, isActive: true },
      select: {
        id: true, name: true, description: true,
        fields: true, successMessage: true,
        organization: { select: { name: true, logo: true } },
      },
    });
    if (!form) { res.status(404).json({ success: false, message: "Form not found or inactive" }); return; }
    res.json({ success: true, form });
  } catch (e) { serverError(res, e); }
}

// ── PUBLIC: Submit form ───────────────────────────────────────
export async function submitForm(req: Request, res: Response): Promise<void> {
  try {
    const form = await db().leadForm.findFirst({
      where: { id: req.params.id, isActive: true },
    });
    if (!form) { res.status(404).json({ success: false, message: "Form not found" }); return; }

    const data = req.body as Record<string, any>;
    const fields = form.fields as Array<{ id: string; label: string; type: string; required: boolean }>;

    // Validate required fields
    for (const field of fields) {
      if (field.required && !data[field.id]) {
        res.status(400).json({ success: false, message: `${field.label} is required` });
        return;
      }
    }

    // Extract standard lead fields from submitted data
    const nameField = fields.find(f => f.label.toLowerCase().includes("name"));
    const emailField = fields.find(f => f.type === "email" || f.label.toLowerCase().includes("email"));
    const phoneField = fields.find(f => f.type === "phone" || f.label.toLowerCase().includes("phone") || f.label.toLowerCase().includes("mobile"));
    const companyField = fields.find(f => f.label.toLowerCase().includes("company") || f.label.toLowerCase().includes("business"));
    const cityField = fields.find(f => f.label.toLowerCase().includes("city"));

    const name = nameField ? data[nameField.id] : (data.name || "Unknown");
    const email = emailField ? data[emailField.id] : data.email;
    const phone = phoneField ? data[phoneField.id] : data.phone;
    const company = companyField ? data[companyField.id] : data.company;
    const city = cityField ? data[cityField.id] : data.city;

    // Build notes from all fields
    const notes = fields
      .filter(f => data[f.id] && f.id !== nameField?.id && f.id !== emailField?.id && f.id !== phoneField?.id)
      .map(f => `${f.label}: ${data[f.id]}`)
      .join("\n");

    // Create lead
    const lead = await db().lead.create({
      data: {
        organizationId: form.organizationId,
        name: String(name).trim(),
        email: email ? String(email).trim() : null,
        phone: phone ? String(phone).trim() : null,
        company: company ? String(company).trim() : null,
        city: city ? String(city).trim() : null,
        source: form.defaultSource || "WEBSITE",
        campaignId: form.defaultCampaignId || null,
        assignedToId: form.assignToId || null,
        notes: notes || null,
        status: "NEW",
      },
    });

    // Log submission
    const submission = await db().leadFormSubmission.create({
      data: {
        formId: form.id,
        data,
        ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
        leadId: lead.id,
      },
    });

    // Increment submit count
    await db().leadForm.update({
      where: { id: form.id },
      data: { submitCount: { increment: 1 } },
    });

    res.json({ success: true, message: form.successMessage, submissionId: submission.id });
  } catch (e) { serverError(res, e); }
}
