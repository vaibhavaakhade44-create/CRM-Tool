import nodemailer from "nodemailer";

const configuredPort = Number(process.env.SMTP_PORT) || 587;
const alternatePort = configuredPort === 465 ? 587 : 465;

// Some PaaS hosts block outbound port 587 (STARTTLS) but allow 465 (implicit
// TLS), or vice versa. Rather than hard-fail on whichever port happens to be
// configured, build a transporter for both and fall back to the other one
// if the first times out or is refused — cheap insurance against exactly
// that class of host-level network block, with no behavior change if the
// configured port already works.
function makeTransporter(port: number) {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // SSL on 465, STARTTLS on 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
    connectionTimeout: 10_000,
    socketTimeout: 10_000,
  });
}

const primaryTransporter = makeTransporter(configuredPort);
let fallbackTransporter: ReturnType<typeof makeTransporter> | null = null;

interface SendMailOptions { to: string; subject: string; html: string; }

// Resend's HTTP API works over plain HTTPS (443), sidestepping any host-level
// block on outbound SMTP ports. Preferred whenever configured; SMTP (with its
// own 465/587 fallback below) remains as a secondary path.
async function sendViaResend(mail: { from: string; to: string; subject: string; html: string }): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mail),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}

export async function sendEmail({ to, subject, html }: SendMailOptions) {
  // Always log so developers can see emails in console
  console.log(`[email] to=${to} subject="${subject}"`);

  const mail = { from: process.env.EMAIL_FROM || "BusinessOS <noreply@busiinessos.co.in>", to, subject, html };

  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend(mail);
      return;
    } catch (err) {
      console.error("[Email] Resend send failed:", err);
      throw new Error("Email delivery failed. Please try again later.");
    }
  }

  // Skip actual send only if SMTP is not configured (host/user missing)
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    if (process.env.NODE_ENV !== "production") return; // dev without SMTP — just log
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY or SMTP_HOST/SMTP_USER in your environment.");
  }

  try {
    await primaryTransporter.sendMail(mail);
    return;
  } catch (err: any) {
    const isNetworkBlock = err?.code === "ETIMEDOUT" || err?.code === "ECONNREFUSED" || err?.code === "ESOCKET";
    if (!isNetworkBlock) {
      console.error("[Email] Failed to send:", err);
      throw new Error("Email delivery failed. Please try again later.");
    }
    console.warn(`[Email] Port ${configuredPort} blocked/unreachable, retrying on ${alternatePort}...`);
  }

  try {
    fallbackTransporter ??= makeTransporter(alternatePort);
    await fallbackTransporter.sendMail(mail);
  } catch (err) {
    console.error("[Email] Failed to send on both ports:", err);
    throw new Error("Email delivery failed. Please try again later.");
  }
}

// ── HTML escaping ────────────────────────────────────────────
// Every value that originates from user input (names, org names, inviter
// names) must be escaped before it goes into an email body, otherwise a user
// called e.g. `<a href="http://evil">Click</a>` gets that markup rendered in
// the recipient's mail client. The global request sanitizer is regex-based and
// not a substitute for context-correct output encoding here.
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Shared layout wrapper ────────────────────────────────────
function emailLayout(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 20px">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
      <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 40px;text-align:center">
        <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px">BusinessOS</span>
      </td></tr>
      <tr><td style="padding:36px 40px">${body}</td></tr>
      <tr><td style="padding:20px 40px;background:#f8f8fc;text-align:center;font-size:12px;color:#9090b0;border-top:1px solid #ebebf5">
        &copy; ${new Date().getFullYear()} BusinessOS &middot; Automated message, please do not reply.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const btn = (url: string, label: string) =>
  `<a href="${url}" style="display:inline-block;margin:20px 0;padding:13px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600">${label}</a>`;

const h1 = (t: string) => `<h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e">${t}</h2>`;
const p  = (t: string) => `<p style="margin:0 0 12px;font-size:15px;color:#505070;line-height:1.6">${t}</p>`;
const note = (t: string) => `<p style="margin:16px 0 0;font-size:13px;color:#a0a0b8">${t}</p>`;

// ── Email verification ───────────────────────────────────────
// Use only the first URL when FRONTEND_URL is comma-separated (dev has multiple)
function frontendBase(): string {
  return (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim();
}

export function verifyEmailTemplate(name: string, token: string): string {
  const url = `${frontendBase()}/verify-email?token=${encodeURIComponent(token)}`;
  return emailLayout("Verify your email", `
    ${h1(`Welcome to BusinessOS, ${esc(name)}!`)}
    ${p("Thanks for signing up. Please verify your email address to activate your account.")}
    ${btn(url, "Verify Email Address")}
    ${note("This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.")}
  `);
}

const MODULE_LABELS: Record<string, string> = {
  CRM: "CRM", INVENTORY: "Inventory", PURCHASE: "Purchase", STORE: "Store (Inward)",
  DISPATCH: "Sales & Dispatch", ACCOUNTS: "Accounts & Finance", POS: "POS / Retail",
  WAREHOUSE: "Warehouse", HR: "HR & Payroll", PROJECTS: "Projects", MARKETING: "Marketing & Leads",
  SUPPORT: "Customer Support", REPORTS: "Reports & Analytics", IMPORT_EXPORT_SUITE: "Import/Export Suite",
  RETAIL_FASHION: "Retail / Fashion",
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner", ADMIN: "Admin", MANAGER: "Manager",
  STAFF: "Staff", ACCOUNTANT: "Accountant", VIEWER: "Viewer",
};

// ── Team invite ──────────────────────────────────────────────
export function inviteEmailTemplate(
  orgName: string,
  inviterName: string,
  token: string,
  role = "STAFF",
  allowedModules: string[] = [],
): string {
  const url = `${frontendBase()}/accept-invite?token=${encodeURIComponent(token)}`;
  const roleLabel = ROLE_LABELS[role] || esc(role);
  const orgNameSafe = esc(orgName);
  const inviterNameSafe = esc(inviterName);

  const moduleChips = allowedModules.length > 0
    ? `<div style="margin:16px 0;display:flex;flex-wrap:wrap;gap:6px">
        ${allowedModules.map(k => `<span style="display:inline-block;padding:4px 10px;border-radius:20px;background:#eff0ff;color:#4f46e5;font-size:12px;font-weight:600;border:1px solid #c7d2fe">${MODULE_LABELS[k] || esc(k)}</span>`).join("")}
      </div>`
    : "";

  return emailLayout(`You're invited to join ${orgNameSafe} on BusinessOS`, `
    ${h1(`You're Invited to Join ${orgNameSafe}!`)}
    ${p(`<strong style="color:#1a1a2e">${inviterNameSafe}</strong> has invited you to join <strong style="color:#6366f1">${orgNameSafe}</strong> on BusinessOS as a <strong style="color:#1a1a2e">${roleLabel}</strong>.`)}
    ${allowedModules.length > 0 ? `<p style="margin:4px 0 6px;font-size:14px;color:#505070;line-height:1.6">You'll have access to the following modules:</p>${moduleChips}` : ""}
    ${p("BusinessOS is an all-in-one business platform — CRM, inventory, sales, accounts, HR, and more.")}
    ${btn(url, "Accept Invitation & Join")}
    ${note("This invitation expires in 48 hours. If you weren't expecting this, you can safely ignore this email.")}
  `);
}

// ── Password reset ───────────────────────────────────────────
export function resetPasswordTemplate(name: string, token: string): string {
  const url = `${frontendBase()}/reset-password?token=${encodeURIComponent(token)}`;
  return emailLayout("Reset your password", `
    ${h1("Reset Your Password")}
    ${p(`Hi <strong style="color:#1a1a2e">${esc(name)}</strong>, we received a request to reset your password.`)}
    ${btn(url, "Reset Password")}
    ${note("This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.")}
  `);
}
