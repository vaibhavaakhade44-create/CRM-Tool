import { Request, Response } from "express";
import { z } from "zod";
import { sendEmail } from "../utils/email";
import { ok, badRequest } from "../utils/response";
import { prisma } from "../lib/prisma";

const ADMIN_EMAIL = "hariomvimal33333@gmail.com";

const contactSchema = z.object({
  name:         z.string().min(2).max(100),
  email:        z.string().email("Invalid email address"),
  phone:        z.string().min(7).max(20),
  organization: z.string().min(2).max(150),
  teamSize:     z.string().optional(),
  message:      z.string().max(1000).optional(),
});

function adminTemplate(data: z.infer<typeof contactSchema>): string {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 16px;background:#f8f8fc;font-size:13px;font-weight:700;color:#6366f1;width:140px;border-bottom:1px solid #ebebf5;white-space:nowrap">${label}</td>
      <td style="padding:10px 16px;font-size:14px;color:#1a1a2e;border-bottom:1px solid #ebebf5">${value}</td>
    </tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 20px">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
      <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 40px;text-align:center">
        <span style="color:#fff;font-size:22px;font-weight:800">BusinessOS</span>
        <p style="color:#c7d2fe;font-size:13px;margin:6px 0 0">New Account Request</p>
      </td></tr>
      <tr><td style="padding:32px 40px">
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1a1a2e">🙋 New User Registration Request</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#505070;line-height:1.6">
          Someone submitted a request to create a BusinessOS account. Review the details below and reach out to onboard them.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ebebf5;border-radius:8px;overflow:hidden">
          ${row("Full Name",    data.name)}
          ${row("Email",        data.email)}
          ${row("Phone",        data.phone)}
          ${row("Organisation", data.organization)}
          ${data.teamSize ? row("Team Size", data.teamSize) : ""}
          ${data.message  ? row("Message",   data.message.replace(/\n/g, "<br>")) : ""}
        </table>
        <p style="margin:24px 0 0;font-size:13px;color:#a0a0b8">
          Received on ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" })} IST
        </p>
        <div style="margin-top:20px">
          <a href="${(process.env.FRONTEND_URL || "https://busiinessos.co.in").split(",")[0].trim()}/super-admin/access-requests" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">
            View in Super Admin Panel →
          </a>
        </div>
      </td></tr>
      <tr><td style="padding:20px 40px;background:#f8f8fc;text-align:center;font-size:12px;color:#9090b0;border-top:1px solid #ebebf5">
        &copy; ${new Date().getFullYear()} BusinessOS · Automated notification
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function autoReplyTemplate(name: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 20px">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
      <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 40px;text-align:center">
        <span style="color:#fff;font-size:22px;font-weight:800">BusinessOS</span>
      </td></tr>
      <tr><td style="padding:36px 40px">
        <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e">Thanks, ${name}! We've received your request.</h2>
        <p style="margin:0 0 12px;font-size:15px;color:#505070;line-height:1.6">
          Our team will review your request and contact you within <strong style="color:#1a1a2e">1–2 business days</strong> to set up your account.
        </p>
        <p style="margin:0 0 12px;font-size:15px;color:#505070;line-height:1.6">In the meantime, feel free to reach us directly:</p>
        <table cellpadding="0" cellspacing="0" style="margin:16px 0">
          <tr><td style="padding:6px 0;font-size:14px;color:#505070">📞 <strong>98341 34470</strong> &nbsp;/&nbsp; <strong>73979 62433</strong></td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#505070">✉️ <strong>hariomvimal33333@gmail.com</strong></td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:#a0a0b8">If you didn't submit this request, please ignore this email.</p>
      </td></tr>
      <tr><td style="padding:20px 40px;background:#f8f8fc;text-align:center;font-size:12px;color:#9090b0;border-top:1px solid #ebebf5">
        &copy; ${new Date().getFullYear()} BusinessOS · Automated message, please do not reply.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export async function submitContactRequest(req: Request, res: Response) {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);

  const data = parsed.data;

  // 1. Save to database
  const record = await prisma.demoRequest.create({ data });

  // 2. Send emails (non-blocking)
  sendEmail({ to: ADMIN_EMAIL, subject: `[BusinessOS] New Account Request — ${data.name} (${data.organization})`, html: adminTemplate(data) })
    .catch(e => console.error("[Contact] Admin email failed:", e));

  sendEmail({ to: data.email, subject: "We've received your BusinessOS request!", html: autoReplyTemplate(data.name) })
    .catch(e => console.error("[Contact] Auto-reply failed:", e));

  console.log(`[Contact] Request #${record.id} saved — ${data.name} <${data.email}>`);
  return ok(res, { id: record.id }, "Your request has been received. We'll contact you within 1–2 business days.");
}

// ── Super Admin: list all demo requests ───────────────────────
export async function listDemoRequests(req: Request, res: Response) {
  const status = req.query.status as string | undefined;
  const requests = await prisma.demoRequest.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return ok(res, requests);
}

// ── Super Admin: update status / notes ────────────────────────
export async function updateDemoRequest(req: Request, res: Response) {
  const id = req.params.id as string;
  const body = req.body as { status?: string; adminNotes?: string };
  const updated = await prisma.demoRequest.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status as any } : {}),
      ...(body.adminNotes !== undefined ? { adminNotes: body.adminNotes } : {}),
    },
  });
  return ok(res, updated);
}
