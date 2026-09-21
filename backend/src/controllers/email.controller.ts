import { Response } from "express";
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, notFound, serverError } from "../utils/response";

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

// ── Email Logs ────────────────────────────────────────────────

export async function listEmails(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const partyId = typeof req.query.partyId === "string" ? req.query.partyId : undefined;
    const limit = parseInt((req.query.limit as string) || "100");

    const where: any = { organizationId: orgId };
    if (partyId) where.partyId = partyId;

    const emails = await prisma.emailLog.findMany({
      where,
      include: {
        party: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    ok(res, { emails });
  } catch (e) { serverError(res, e); }
}

export async function getEmailStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const [total, sent, failed] = await Promise.all([
      prisma.emailLog.count({ where: { organizationId: orgId } }),
      prisma.emailLog.count({ where: { organizationId: orgId, status: "SENT" } }),
      prisma.emailLog.count({ where: { organizationId: orgId, status: "FAILED" } }),
    ]);
    ok(res, { total, sent, failed, draft: 0 });
  } catch (e) { serverError(res, e); }
}

export async function sendEmail(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const userId = (req as any).userId as string | undefined;
    const { subject, body, templateId, partyId, leadId } = req.body;
    const toEmail: string = req.body.toEmail;
    const ccEmail: string | undefined = req.body.ccEmail || undefined;

    const fromEmail = process.env.SMTP_USER || "noreply@busiinessos.co.in";
    const fromName = process.env.SMTP_FROM_NAME || "BusinessOS";

    let emailStatus: "SENT" | "FAILED" = "SENT";
    let errorMsg: string | undefined;

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = createTransporter();
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: toEmail,
          cc: ccEmail || undefined,
          subject,
          html: body.replace(/\n/g, "<br>"),
          text: body,
        });
      } catch (smtpErr: any) {
        emailStatus = "FAILED";
        errorMsg = smtpErr.message;
      }
    }

    const log = await prisma.emailLog.create({
      data: {
        organizationId: orgId,
        fromEmail,
        toEmail,
        ccEmail: ccEmail || null,
        subject,
        body,
        templateId: templateId || null,
        partyId: partyId || null,
        leadId: leadId || null,
        status: emailStatus,
        errorMessage: errorMsg || null,
        sentAt: emailStatus === "SENT" ? new Date() : null,
        sentById: userId || null,
      },
      include: {
        party: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
      },
    });

    const msg = emailStatus === "SENT"
      ? "Email sent successfully"
      : "Email logged (SMTP not configured — set SMTP_USER & SMTP_PASS in .env)";
    ok(res, log, msg);
  } catch (e) { serverError(res, e); }
}

export async function deleteEmail(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    await prisma.emailLog.delete({ where: { id } });
    ok(res, null, "Deleted");
  } catch (e) { serverError(res, e); }
}

// ── Templates ─────────────────────────────────────────────────

export async function listTemplates(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const templates = await prisma.emailTemplate.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });
    ok(res, { templates });
  } catch (e) { serverError(res, e); }
}

export async function createTemplate(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { name, subject, body, category } = req.body;
    const template = await prisma.emailTemplate.create({
      data: { organizationId: orgId, name, subject, body, category: category || "GENERAL" },
    });
    ok(res, template, "Template created");
  } catch (e) { serverError(res, e); }
}

export async function updateTemplate(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.emailTemplate.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Template not found"); return; }
    const { name, subject, body, category } = req.body;
    const template = await prisma.emailTemplate.update({
      where: { id },
      data: { name, subject, body, category },
    });
    ok(res, template);
  } catch (e) { serverError(res, e); }
}

export async function deleteTemplate(req: OrgRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.emailTemplate.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Template not found"); return; }
    await prisma.emailTemplate.delete({ where: { id } });
    ok(res, null, "Deleted");
  } catch (e) { serverError(res, e); }
}
