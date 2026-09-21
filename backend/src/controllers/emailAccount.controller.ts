import { Request, Response } from "express";
import { google } from "googleapis";
import axios from "axios";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { ok, created, badRequest, notFound, serverError, unauthorized } from "../utils/response";
import { z } from "zod";

const db = () => (prisma as any);

// ─────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────

function getGoogleClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.BACKEND_URL || "http://localhost:5000"}/api/email-accounts/gmail/callback`
  );
}

function getMsRedirectUri() {
  return process.env.MS_REDIRECT_URI || `${process.env.BACKEND_URL || "http://localhost:5000"}/api/email-accounts/outlook/callback`;
}

async function refreshOutlookToken(account: any): Promise<string> {
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    client_secret: process.env.MS_CLIENT_SECRET!,
    refresh_token: account.refreshToken,
    grant_type: "refresh_token",
    scope: "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access",
  });
  const res = await axios.post("https://login.microsoftonline.com/common/oauth2/v2.0/token", params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const newToken = res.data.access_token;
  const expiresAt = new Date(Date.now() + res.data.expires_in * 1000);
  await db().emailAccount.update({
    where: { id: account.id },
    data: { accessToken: newToken, expiresAt, updatedAt: new Date() },
  });
  return newToken;
}

async function getValidOutlookToken(account: any): Promise<string> {
  if (!account.expiresAt || new Date(account.expiresAt) < new Date()) {
    return refreshOutlookToken(account);
  }
  return account.accessToken;
}

// ─────────────────────────────────────────────────────────────────
//  LIST / DISCONNECT ACCOUNTS
// ─────────────────────────────────────────────────────────────────

export async function listAccounts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const accounts = await db().emailAccount.findMany({
      where: { userId: req.userId!, isActive: true },
      select: { id: true, provider: true, label: true, email: true, isPrimary: true, createdAt: true },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    ok(res, accounts);
  } catch (e) { serverError(res, e); }
}

export async function disconnectAccount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const acc = await db().emailAccount.findFirst({ where: { id, userId: req.userId! } });
    if (!acc) { notFound(res, "Account not found"); return; }
    await db().emailAccount.update({ where: { id }, data: { isActive: false } });
    ok(res, null, "Account disconnected");
  } catch (e) { serverError(res, e); }
}

export async function setPrimary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await db().emailAccount.updateMany({ where: { userId: req.userId! }, data: { isPrimary: false } });
    await db().emailAccount.update({ where: { id }, data: { isPrimary: true } });
    ok(res, null, "Primary account updated");
  } catch (e) { serverError(res, e); }
}

// ─────────────────────────────────────────────────────────────────
//  GMAIL OAUTH
// ─────────────────────────────────────────────────────────────────

export async function gmailAuthUrl(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      badRequest(res, "Gmail OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."); return;
    }
    const oAuth2Client = getGoogleClient();
    const url = oAuth2Client.generateAuthUrl({
      access_type: "offline", prompt: "consent",
      scope: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/userinfo.email"],
      state: req.userId,
    });
    ok(res, { url });
  } catch (e) { serverError(res, e); }
}

export async function gmailCallback(req: Request, res: Response): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  try {
    const { code, state: userId } = req.query as Record<string, string>;
    if (!code || !userId) { res.redirect(`${frontendUrl}/email?error=missing_params`); return; }

    const oAuth2Client = getGoogleClient();
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    await db().emailAccount.upsert({
      where: { userId_email: { userId, email: profile.email! } },
      create: {
        userId, provider: "GMAIL", label: `Gmail (${profile.email})`,
        email: profile.email!, accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || "",
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600_000),
        isPrimary: false,
      },
      update: {
        accessToken: tokens.access_token!,
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600_000),
        isActive: true, updatedAt: new Date(),
      },
    });

    res.redirect(`${frontendUrl}/email?connected=gmail&email=${encodeURIComponent(profile.email!)}`);
  } catch (err: any) {
    console.error("Gmail callback error:", err.message);
    res.redirect(`${frontendUrl}/email?error=gmail_failed`);
  }
}

// ─────────────────────────────────────────────────────────────────
//  OUTLOOK (MICROSOFT GRAPH) OAUTH
// ─────────────────────────────────────────────────────────────────

export async function outlookAuthUrl(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!process.env.MS_CLIENT_ID) {
      badRequest(res, "Outlook OAuth not configured. Set MS_CLIENT_ID and MS_CLIENT_SECRET."); return;
    }
    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      response_type: "code",
      redirect_uri: getMsRedirectUri(),
      scope: "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
      state: req.userId!,
      prompt: "select_account",
    });
    ok(res, { url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}` });
  } catch (e) { serverError(res, e); }
}

export async function outlookCallback(req: Request, res: Response): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  try {
    const { code, state: userId } = req.query as Record<string, string>;
    if (!code || !userId) { res.redirect(`${frontendUrl}/email?error=missing_params`); return; }

    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID!,
      client_secret: process.env.MS_CLIENT_SECRET!,
      code, redirect_uri: getMsRedirectUri(),
      grant_type: "authorization_code",
    });
    const tokenRes = await axios.post("https://login.microsoftonline.com/common/oauth2/v2.0/token", params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Get user's email from Graph
    const profileRes = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const email: string = profileRes.data.mail || profileRes.data.userPrincipalName;

    await db().emailAccount.upsert({
      where: { userId_email: { userId, email } },
      create: {
        userId, provider: "OUTLOOK", label: `Outlook (${email})`, email,
        accessToken: access_token, refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + expires_in * 1000), isPrimary: false,
      },
      update: {
        accessToken: access_token, refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        isActive: true, updatedAt: new Date(),
      },
    });

    res.redirect(`${frontendUrl}/email?connected=outlook&email=${encodeURIComponent(email)}`);
  } catch (err: any) {
    console.error("Outlook callback error:", err.message);
    res.redirect(`${frontendUrl}/email?error=outlook_failed`);
  }
}

// ─────────────────────────────────────────────────────────────────
//  IMAP / SMTP (Yahoo, Zoho, custom domain, etc.)
// ─────────────────────────────────────────────────────────────────

const imapSchema = z.object({
  label:        z.string().min(1).max(60),
  email:        z.string().email(),
  provider:     z.enum(["YAHOO", "IMAP"]).default("IMAP"),
  imapHost:     z.string().min(1),
  imapPort:     z.number().int().default(993),
  imapSecure:   z.boolean().default(true),
  smtpHost:     z.string().min(1),
  smtpPort:     z.number().int().default(465),
  smtpSecure:   z.boolean().default(true),
  smtpPassword: z.string().min(1),
});

// Preset IMAP/SMTP settings for popular providers
export const IMAP_PRESETS: Record<string, { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }> = {
  YAHOO:       { imapHost: "imap.mail.yahoo.com",  imapPort: 993, smtpHost: "smtp.mail.yahoo.com",  smtpPort: 465 },
  ZOHO:        { imapHost: "imap.zoho.com",         imapPort: 993, smtpHost: "smtp.zoho.com",         smtpPort: 465 },
  OUTLOOK_IMAP:{ imapHost: "outlook.office365.com", imapPort: 993, smtpHost: "smtp.office365.com",    smtpPort: 587 },
  HOTMAIL:     { imapHost: "outlook.office365.com", imapPort: 993, smtpHost: "smtp.office365.com",    smtpPort: 587 },
  ICLOUD:      { imapHost: "imap.mail.me.com",      imapPort: 993, smtpHost: "smtp.mail.me.com",      smtpPort: 587 },
};

export async function connectImap(req: AuthRequest, res: Response): Promise<void> {
  try {
    const d = imapSchema.safeParse(req.body);
    if (!d.success) { badRequest(res, "Invalid IMAP settings"); return; }

    // Test the connection before saving
    const client = new ImapFlow({
      host: d.data.imapHost, port: d.data.imapPort,
      secure: d.data.imapSecure,
      auth: { user: d.data.email, pass: d.data.smtpPassword },
      logger: false,
    });
    try {
      await client.connect();
      await client.logout();
    } catch (err: any) {
      badRequest(res, `IMAP connection failed: ${err.message}`); return;
    }

    const acc = await db().emailAccount.upsert({
      where: { userId_email: { userId: req.userId!, email: d.data.email } },
      create: {
        userId: req.userId!, provider: d.data.provider,
        label: d.data.label, email: d.data.email,
        imapHost: d.data.imapHost, imapPort: d.data.imapPort, imapSecure: d.data.imapSecure,
        smtpHost: d.data.smtpHost, smtpPort: d.data.smtpPort, smtpSecure: d.data.smtpSecure,
        smtpPassword: d.data.smtpPassword, isPrimary: false,
      },
      update: {
        label: d.data.label, imapHost: d.data.imapHost, imapPort: d.data.imapPort,
        smtpHost: d.data.smtpHost, smtpPort: d.data.smtpPort,
        smtpPassword: d.data.smtpPassword, isActive: true, updatedAt: new Date(),
      },
    });

    created(res, { id: acc.id, email: acc.email, provider: acc.provider }, "Email account connected");
  } catch (e) { serverError(res, e); }
}

export async function getImapPresets(_req: AuthRequest, res: Response): Promise<void> {
  ok(res, IMAP_PRESETS);
}

// ─────────────────────────────────────────────────────────────────
//  UNIFIED INBOX
// ─────────────────────────────────────────────────────────────────

export async function getInbox(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { accountId } = req.params;
    const { folder = "INBOX", page = "1", search = "" } = req.query as Record<string, string>;
    const account = await db().emailAccount.findFirst({ where: { id: accountId, userId: req.userId!, isActive: true } });
    if (!account) { notFound(res, "Email account not found"); return; }

    if (account.provider === "GMAIL") {
      await _getGmailInbox(account, folder, parseInt(page), search, res); return;
    }
    if (account.provider === "OUTLOOK") {
      await _getOutlookInbox(account, folder, parseInt(page), search, res); return;
    }
    // IMAP providers
    await _getImapInbox(account, folder, parseInt(page), search, res);
  } catch (e) { serverError(res, e); }
}

async function _getGmailInbox(account: any, label: string, page: number, search: string, res: Response) {
  const oAuth2Client = getGoogleClient();
  oAuth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken, expiry_date: account.expiresAt?.getTime() });
  if (account.expiresAt < new Date()) {
    const { credentials } = await oAuth2Client.refreshAccessToken();
    await db().emailAccount.update({ where: { id: account.id }, data: { accessToken: credentials.access_token!, expiresAt: new Date(credentials.expiry_date || Date.now() + 3600_000) } });
    oAuth2Client.setCredentials(credentials);
  }
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client }) as any;
  const q = [label !== "INBOX" ? "" : "", search].filter(Boolean).join(" ");
  const listRes = await gmail.users.messages.list({ userId: "me", labelIds: [label], q: q || undefined, maxResults: 20 });
  const messages = listRes.data.messages ?? [];
  const details = await Promise.all(messages.slice(0, 20).map((m: any) =>
    gmail.users.messages.get({ userId: "me", id: m.id, format: "metadata", metadataHeaders: ["Subject", "From", "To", "Date"] })
      .then((r: any) => {
        const h = r.data.payload?.headers ?? [];
        const hv = (n: string) => h.find((x: any) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
        return { id: r.data.id, threadId: r.data.threadId, snippet: r.data.snippet, subject: hv("subject") || "(no subject)", from: hv("from"), to: hv("to"), date: hv("date"), unread: r.data.labelIds?.includes("UNREAD") ?? false, provider: "GMAIL" };
      })
  ));
  ok(res, { messages: details, nextPageToken: listRes.data.nextPageToken ?? null });
}

async function _getOutlookInbox(account: any, folder: string, page: number, search: string, res: Response) {
  const token = await getValidOutlookToken(account);
  const skip = (page - 1) * 20;
  const folderMap: Record<string, string> = { INBOX: "inbox", SENT: "sentitems", DRAFT: "drafts", TRASH: "deleteditems", SPAM: "junkemail" };
  const folderPath = folderMap[folder] || "inbox";
  const filter = search ? `&$filter=contains(subject,'${encodeURIComponent(search)}')` : "";
  const resp = await axios.get(
    `https://graph.microsoft.com/v1.0/me/mailFolders/${folderPath}/messages?$top=20&$skip=${skip}&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead${filter}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const messages = resp.data.value.map((m: any) => ({
    id: m.id, threadId: m.conversationId, snippet: m.bodyPreview,
    subject: m.subject || "(no subject)", from: m.from?.emailAddress?.address || "",
    fromName: m.from?.emailAddress?.name || "",
    to: m.toRecipients?.map((r: any) => r.emailAddress?.address).join(", ") || "",
    date: m.receivedDateTime, unread: !m.isRead, provider: "OUTLOOK",
  }));
  ok(res, { messages, nextPageToken: resp.data["@odata.nextLink"] ? String(page + 1) : null });
}

async function _getImapInbox(account: any, folder: string, page: number, search: string, res: Response) {
  const client = new ImapFlow({
    host: account.imapHost, port: account.imapPort, secure: account.imapSecure,
    auth: { user: account.email, pass: account.smtpPassword }, logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock(folder === "SENT" ? "Sent" : folder === "TRASH" ? "Trash" : "INBOX");
  const messages: any[] = [];
  try {
    const status = await client.status("INBOX", { messages: true });
    const total = status.messages || 0;
    const start = Math.max(1, total - (page * 20) + 1);
    const end = Math.max(1, total - ((page - 1) * 20));
    if (start <= end) {
      for await (const msg of client.fetch(`${start}:${end}`, { envelope: true, flags: true })) {
        if (!msg.envelope || !msg.flags) continue;
        messages.unshift({
          id: String(msg.uid), threadId: msg.envelope.messageId || String(msg.uid),
          snippet: "", subject: msg.envelope.subject || "(no subject)",
          from: msg.envelope.from?.[0]?.address || "", fromName: msg.envelope.from?.[0]?.name || "",
          to: msg.envelope.to?.map((a: any) => a.address).join(", ") || "",
          date: msg.envelope.date?.toISOString() || "",
          unread: !msg.flags.has("\\Seen"), provider: account.provider,
        });
      }
    }
  } finally { lock.release(); }
  await client.logout();
  ok(res, { messages, nextPageToken: page * 20 < 200 ? String(page + 1) : null });
}

// ─────────────────────────────────────────────────────────────────
//  GET FULL MESSAGE
// ─────────────────────────────────────────────────────────────────

export async function getMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const accountId = req.params.accountId as string;
    const messageId = req.params.messageId as string;
    const account = await db().emailAccount.findFirst({ where: { id: accountId, userId: req.userId!, isActive: true } });
    if (!account) { notFound(res, "Account not found"); return; }

    if (account.provider === "GMAIL") {
      await _getGmailMessage(account, messageId, res); return;
    }
    if (account.provider === "OUTLOOK") {
      await _getOutlookMessage(account, messageId, res); return;
    }
    await _getImapMessage(account, messageId, res);
  } catch (e) { serverError(res, e); }
}

async function _getGmailMessage(account: any, messageId: string, res: Response) {
  const oAuth2Client = getGoogleClient();
  oAuth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client }) as any;
  const msgRes = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const h = msgRes.data.payload?.headers ?? [];
  const hv = (n: string) => h.find((x: any) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
  let html = ""; let text = "";
  function walk(part: any) { if (!part) return; if (part.mimeType === "text/html" && part.body?.data) html = Buffer.from(part.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"); else if (part.mimeType === "text/plain" && part.body?.data) text = Buffer.from(part.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"); if (part.parts) part.parts.forEach(walk); }
  walk(msgRes.data.payload);
  // Mark as read
  if (msgRes.data.labelIds?.includes("UNREAD")) await gmail.users.messages.modify({ userId: "me", id: messageId, requestBody: { removeLabelIds: ["UNREAD"] } }).catch(() => {});
  ok(res, { id: messageId, subject: hv("subject"), from: hv("from"), to: hv("to"), cc: hv("cc"), date: hv("date"), html, text, threadId: msgRes.data.threadId, provider: "GMAIL" });
}

async function _getOutlookMessage(account: any, messageId: string, res: Response) {
  const token = await getValidOutlookToken(account);
  const resp = await axios.get(`https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,conversationId`, { headers: { Authorization: `Bearer ${token}` } });
  const m = resp.data;
  // Mark as read
  await axios.patch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, { isRead: true }, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }).catch(() => {});
  ok(res, {
    id: m.id, subject: m.subject, threadId: m.conversationId,
    from: m.from?.emailAddress?.address || "", fromName: m.from?.emailAddress?.name || "",
    to: m.toRecipients?.map((r: any) => r.emailAddress?.address).join(", ") || "",
    cc: m.ccRecipients?.map((r: any) => r.emailAddress?.address).join(", ") || "",
    date: m.receivedDateTime,
    html: m.body?.contentType === "html" ? m.body.content : null,
    text: m.body?.contentType === "text" ? m.body.content : null,
    provider: "OUTLOOK",
  });
}

async function _getImapMessage(account: any, uid: string, res: Response) {
  const client = new ImapFlow({ host: account.imapHost, port: account.imapPort, secure: account.imapSecure, auth: { user: account.email, pass: account.smtpPassword }, logger: false });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const msg = await client.fetchOne(uid, { source: true, envelope: true });
    if (!msg || !msg.source || !msg.envelope) { notFound(res, "Message not found"); return; }
    const raw = msg.source.toString("utf-8");
    const htmlMatch = raw.match(/Content-Type: text\/html[^]*?(?:\r?\n\r?\n)([\s\S]*?)(?=--boundary|$)/i);
    const textMatch = raw.match(/Content-Type: text\/plain[^]*?(?:\r?\n\r?\n)([\s\S]*?)(?=--boundary|$)/i);
    ok(res, {
      id: uid, subject: msg.envelope.subject || "(no subject)",
      from: msg.envelope.from?.[0]?.address || "", to: msg.envelope.to?.map((a: any) => a.address).join(", ") || "",
      date: msg.envelope.date?.toISOString() || "", html: htmlMatch?.[1] || null,
      text: textMatch?.[1] || raw.slice(0, 2000), provider: account.provider,
    });
  } finally { lock.release(); }
  await client.logout();
}

// ─────────────────────────────────────────────────────────────────
//  SEND EMAIL
// ─────────────────────────────────────────────────────────────────

const sendSchema = z.object({
  to: z.string().min(1),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  isHtml: z.boolean().default(false),
  replyToMessageId: z.string().optional(),
  threadId: z.string().optional(),
});

export async function sendEmail(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { accountId } = req.params;
    const d = sendSchema.safeParse(req.body);
    if (!d.success) { badRequest(res, "Invalid send data"); return; }
    const account = await db().emailAccount.findFirst({ where: { id: accountId, userId: req.userId!, isActive: true } });
    if (!account) { notFound(res, "Account not found"); return; }

    if (account.provider === "GMAIL") {
      await _sendGmail(account, d.data, res); return;
    }
    if (account.provider === "OUTLOOK") {
      await _sendOutlook(account, d.data, res); return;
    }
    await _sendImap(account, d.data, res);
  } catch (e) { serverError(res, e); }
}

async function _sendGmail(account: any, d: any, res: Response) {
  const oAuth2Client = getGoogleClient();
  oAuth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client }) as any;
  const lines = [`From: ${account.email}`, `To: ${d.to}`, ...(d.cc ? [`Cc: ${d.cc}`] : []), ...(d.bcc ? [`Bcc: ${d.bcc}`] : []), `Subject: =?UTF-8?B?${Buffer.from(d.subject).toString("base64")}?=`, "MIME-Version: 1.0", `Content-Type: ${d.isHtml ? "text/html" : "text/plain"}; charset=utf-8`, "", d.body];
  const raw = Buffer.from(lines.join("\r\n")).toString("base64url");
  const sent = await gmail.users.messages.send({ userId: "me", requestBody: { raw, ...(d.threadId && { threadId: d.threadId }) } });
  ok(res, { messageId: sent.data.id, threadId: sent.data.threadId, provider: "GMAIL" });
}

async function _sendOutlook(account: any, d: any, res: Response) {
  const token = await getValidOutlookToken(account);
  const toRecipients = d.to.split(",").map((e: string) => ({ emailAddress: { address: e.trim() } }));
  const body = { message: { subject: d.subject, body: { contentType: d.isHtml ? "HTML" : "Text", content: d.body }, toRecipients, ...(d.cc ? { ccRecipients: d.cc.split(",").map((e: string) => ({ emailAddress: { address: e.trim() } })) } : {}), ...(d.bcc ? { bccRecipients: d.bcc.split(",").map((e: string) => ({ emailAddress: { address: e.trim() } })) } : {}) }, saveToSentItems: true };
  await axios.post("https://graph.microsoft.com/v1.0/me/sendMail", body, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  ok(res, { messageId: "sent", provider: "OUTLOOK" });
}

async function _sendImap(account: any, d: any, res: Response) {
  const transporter = nodemailer.createTransport({
    host: account.smtpHost, port: account.smtpPort, secure: account.smtpSecure,
    auth: { user: account.email, pass: account.smtpPassword },
  });
  const info = await transporter.sendMail({ from: account.email, to: d.to, cc: d.cc, bcc: d.bcc, subject: d.subject, [d.isHtml ? "html" : "text"]: d.body });
  ok(res, { messageId: info.messageId, provider: account.provider });
}

// ─────────────────────────────────────────────────────────────────
//  LIST FOLDERS / LABELS
// ─────────────────────────────────────────────────────────────────

export async function listFolders(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { accountId } = req.params;
    const account = await db().emailAccount.findFirst({ where: { id: accountId, userId: req.userId!, isActive: true } });
    if (!account) { notFound(res, "Account not found"); return; }

    if (account.provider === "GMAIL") {
      const oAuth2Client = getGoogleClient();
      oAuth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
      const gmail = google.gmail({ version: "v1", auth: oAuth2Client }) as any;
      const labelsRes = await gmail.users.labels.list({ userId: "me" });
      const labels = (labelsRes.data.labels ?? []).filter((l: any) => ["INBOX","SENT","DRAFT","STARRED","TRASH","SPAM"].includes(l.id ?? "") || l.type === "user").map((l: any) => ({ id: l.id, name: l.name, type: l.type, unread: l.messagesUnread || 0 }));
      ok(res, labels); return;
    }

    if (account.provider === "OUTLOOK") {
      const token = await getValidOutlookToken(account);
      const resp = await axios.get("https://graph.microsoft.com/v1.0/me/mailFolders?$select=id,displayName,unreadItemCount&$top=20", { headers: { Authorization: `Bearer ${token}` } });
      ok(res, resp.data.value.map((f: any) => ({ id: f.id, name: f.displayName, unread: f.unreadItemCount || 0 }))); return;
    }

    // IMAP — list mailboxes
    const client = new ImapFlow({ host: account.imapHost, port: account.imapPort, secure: account.imapSecure, auth: { user: account.email, pass: account.smtpPassword }, logger: false });
    await client.connect();
    const list = await client.list();
    await client.logout();
    ok(res, list.map((f: any) => ({ id: f.path, name: f.name, type: "user" })));
  } catch (e) { serverError(res, e); }
}

// ─────────────────────────────────────────────────────────────────
//  TRASH / DELETE MESSAGE
// ─────────────────────────────────────────────────────────────────

export async function trashMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const accountId = req.params.accountId as string;
    const messageId = req.params.messageId as string;
    const account = await db().emailAccount.findFirst({ where: { id: accountId, userId: req.userId!, isActive: true } });
    if (!account) { notFound(res, "Account not found"); return; }

    if (account.provider === "GMAIL") {
      const oAuth2Client = getGoogleClient();
      oAuth2Client.setCredentials({ access_token: account.accessToken, refresh_token: account.refreshToken });
      const gmail = google.gmail({ version: "v1", auth: oAuth2Client }) as any;
      await gmail.users.messages.trash({ userId: "me", id: messageId });
      ok(res, null, "Message moved to trash"); return;
    }

    if (account.provider === "OUTLOOK") {
      const token = await getValidOutlookToken(account);
      await axios.post(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/move`, { destinationId: "deleteditems" }, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      ok(res, null, "Message moved to trash"); return;
    }

    // IMAP
    const client = new ImapFlow({ host: account.imapHost, port: account.imapPort, secure: account.imapSecure, auth: { user: account.email, pass: account.smtpPassword }, logger: false });
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try { await client.messageMove(messageId as string, "Trash"); } finally { lock.release(); }
    await client.logout();
    ok(res, null, "Message moved to trash");
  } catch (e) { serverError(res, e); }
}
