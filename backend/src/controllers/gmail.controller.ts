import { Request, Response } from "express";
import { google } from "googleapis";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, created, badRequest, notFound, serverError, unauthorized } from "../utils/response";

const db = () => (prisma as any);

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.BACKEND_URL || "http://localhost:5000"}/api/gmail/callback`
  );
}

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ── Get OAuth URL ────────────────────────────────────────────
export async function getAuthUrl(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      badRequest(res, "Gmail OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"); return;
    }
    const oAuth2Client = getOAuthClient();
    const url = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state: req.userId, // pass userId through the OAuth flow
    });
    ok(res, { url });
  } catch (err) { serverError(res, err); }
}

// ── OAuth Callback ───────────────────────────────────────────
export async function handleCallback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state: userId } = req.query as Record<string, string>;
    if (!code || !userId) { res.status(400).send("Missing code or state"); return; }

    const oAuth2Client = getOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Get user's Gmail address
    const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    await db().gmailAccount.upsert({
      where: { userId },
      create: {
        id: require("crypto").randomUUID(),
        userId,
        email: profile.email!,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || "",
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600_000),
      },
      update: {
        email: profile.email!,
        accessToken: tokens.access_token!,
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600_000),
        updatedAt: new Date(),
      },
    });

    // Redirect back to the frontend email page
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/email?gmail=connected`);
  } catch (err: any) {
    console.error("Gmail callback error:", err.message);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/email?gmail=error`);
  }
}

// ── Get connection status ────────────────────────────────────
export async function getStatus(req: OrgRequest, res: Response): Promise<void> {
  try {
    const account = await db().gmailAccount.findUnique({ where: { userId: req.userId } });
    ok(res, { connected: !!account, email: account?.email ?? null });
  } catch (err) { serverError(res, err); }
}

// ── Disconnect Gmail ─────────────────────────────────────────
export async function disconnect(req: OrgRequest, res: Response): Promise<void> {
  try {
    await db().gmailAccount.deleteMany({ where: { userId: req.userId } });
    ok(res, { disconnected: true });
  } catch (err) { serverError(res, err); }
}

// Helper: get authenticated Gmail client for a user (cast to any to avoid googleapis type overload issues)
async function getGmailClient(userId: string): Promise<any | null> {
  const account = await db().gmailAccount.findUnique({ where: { userId } });
  if (!account) return null;

  const oAuth2Client = getOAuthClient();
  oAuth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiresAt.getTime(),
  });

  // Auto-refresh if expired
  if (account.expiresAt < new Date()) {
    const { credentials } = await oAuth2Client.refreshAccessToken();
    await db().gmailAccount.update({
      where: { userId },
      data: {
        accessToken: credentials.access_token!,
        expiresAt: new Date(credentials.expiry_date || Date.now() + 3600_000),
        updatedAt: new Date(),
      },
    });
    oAuth2Client.setCredentials(credentials);
  }

  return google.gmail({ version: "v1", auth: oAuth2Client }) as any;
}

// Helper: decode base64url encoded part
function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

// Helper: extract body from Gmail message parts
function extractBody(payload: any): { html: string; text: string } {
  let html = "";
  let text = "";

  function walk(part: any) {
    if (!part) return;
    if (part.mimeType === "text/html" && part.body?.data) {
      html = decodeBase64(part.body.data);
    } else if (part.mimeType === "text/plain" && part.body?.data) {
      text = decodeBase64(part.body.data);
    }
    if (part.parts) part.parts.forEach(walk);
  }

  walk(payload);
  return { html, text };
}

// Helper: extract header value
function header(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// ── List inbox messages ──────────────────────────────────────
export async function listInbox(req: OrgRequest, res: Response): Promise<void> {
  try {
    const gmail = await getGmailClient(req.userId!);
    if (!gmail) { unauthorized(res, "Gmail not connected"); return; }

    const { label = "INBOX", q = "", pageToken, maxResults = "20" } = req.query as Record<string, string>;

    const listRes = await gmail.users.messages.list({
      userId: "me",
      labelIds: [label],
      q: q || undefined,
      pageToken: pageToken || undefined,
      maxResults: Math.min(parseInt(maxResults), 50),
    });

    const messages = listRes.data.messages ?? [];

    // Fetch metadata for each message in parallel (batch of 10)
    const details = await Promise.all(
      messages.slice(0, 20).map((m: any) =>
        gmail.users.messages.get({
          userId: "me",
          id: m.id,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "To", "Date", "Message-ID"],
        }).then((r: any) => {
          const h = r.data.payload?.headers ?? [];
          return {
            id: r.data.id,
            threadId: r.data.threadId,
            snippet: r.data.snippet,
            labelIds: r.data.labelIds,
            internalDate: r.data.internalDate,
            subject: header(h, "subject") || "(no subject)",
            from: header(h, "from"),
            to: header(h, "to"),
            date: header(h, "date"),
            unread: r.data.labelIds?.includes("UNREAD") ?? false,
          };
        })
      )
    );

    ok(res, { messages: details, nextPageToken: listRes.data.nextPageToken ?? null, resultSizeEstimate: listRes.data.resultSizeEstimate ?? 0 });
  } catch (err: any) {
    if (err.code === 401) { unauthorized(res, "Gmail token expired. Please reconnect."); return; }
    serverError(res, err);
  }
}

// ── Get single message (full body) ──────────────────────────
export async function getMessage(req: OrgRequest, res: Response): Promise<void> {
  try {
    const gmail = await getGmailClient(req.userId!);
    if (!gmail) { unauthorized(res, "Gmail not connected"); return; }

    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id: req.params.id,
      format: "full",
    });

    const h = msgRes.data.payload?.headers ?? [];
    const { html, text } = extractBody(msgRes.data.payload);

    // Mark as read
    if (msgRes.data.labelIds?.includes("UNREAD")) {
      await gmail.users.messages.modify({
        userId: "me",
        id: req.params.id,
        requestBody: { removeLabelIds: ["UNREAD"] },
      }).catch(() => {});
    }

    ok(res, {
      id: msgRes.data.id,
      threadId: msgRes.data.threadId,
      subject: header(h, "subject") || "(no subject)",
      from: header(h, "from"),
      to: header(h, "to"),
      cc: header(h, "cc"),
      date: header(h, "date"),
      messageId: header(h, "message-id"),
      html,
      text,
      snippet: msgRes.data.snippet,
      labelIds: msgRes.data.labelIds,
    });
  } catch (err: any) {
    if (err.code === 401) { unauthorized(res, "Gmail token expired. Please reconnect."); return; }
    serverError(res, err);
  }
}

// ── Get full thread ──────────────────────────────────────────
export async function getThread(req: OrgRequest, res: Response): Promise<void> {
  try {
    const gmail = await getGmailClient(req.userId!);
    if (!gmail) { unauthorized(res, "Gmail not connected"); return; }

    const threadRes = await gmail.users.threads.get({
      userId: "me",
      id: req.params.id,
      format: "full",
    });

    const messages = (threadRes.data.messages ?? []).map((msg: any) => {
      const h = msg.payload?.headers ?? [];
      const { html, text } = extractBody(msg.payload);
      return {
        id: msg.id,
        subject: header(h, "subject"),
        from: header(h, "from"),
        to: header(h, "to"),
        date: header(h, "date"),
        html,
        text,
        unread: msg.labelIds?.includes("UNREAD") ?? false,
      };
    });

    ok(res, { id: threadRes.data.id, messages });
  } catch (err: any) {
    if (err.code === 401) { unauthorized(res, "Gmail token expired. Please reconnect."); return; }
    serverError(res, err);
  }
}

// ── Send email via Gmail API ─────────────────────────────────
export async function sendGmail(req: OrgRequest, res: Response): Promise<void> {
  try {
    const gmail = await getGmailClient(req.userId!);
    if (!gmail) { unauthorized(res, "Gmail not connected"); return; }

    const { to, cc, subject, body, isHtml = false, threadId } = req.body;
    if (!to || !subject || !body) { badRequest(res, "to, subject, body are required"); return; }

    const account = await db().gmailAccount.findUnique({ where: { userId: req.userId } });
    const from = account?.email ?? "me";

    const mimeLines = [
      `From: ${from}`,
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset=utf-8`,
      "",
      body,
    ];

    const raw = Buffer.from(mimeLines.join("\r\n")).toString("base64url");

    const sent = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw, ...(threadId && { threadId }) },
    });

    ok(res, { messageId: sent.data.id, threadId: sent.data.threadId });
  } catch (err: any) {
    if (err.code === 401) { unauthorized(res, "Gmail token expired. Please reconnect."); return; }
    serverError(res, err);
  }
}

// ── Trash a message ──────────────────────────────────────────
export async function trashMessage(req: OrgRequest, res: Response): Promise<void> {
  try {
    const gmail = await getGmailClient(req.userId!);
    if (!gmail) { unauthorized(res, "Gmail not connected"); return; }

    await gmail.users.messages.trash({ userId: "me", id: req.params.id });
    ok(res, { trashed: true });
  } catch (err: any) { serverError(res, err); }
}

// ── List Gmail labels ────────────────────────────────────────
export async function listLabels(req: OrgRequest, res: Response): Promise<void> {
  try {
    const gmail = await getGmailClient(req.userId!);
    if (!gmail) { unauthorized(res, "Gmail not connected"); return; }

    const labelsRes = await gmail.users.labels.list({ userId: "me" });
    const labels = (labelsRes.data.labels ?? []).filter((l: any) =>
      ["INBOX", "SENT", "DRAFT", "STARRED", "TRASH", "SPAM"].includes(l.id ?? "") ||
      l.type === "user"
    ).map((l: any) => ({ id: l.id, name: l.name, type: l.type, messagesTotal: l.messagesTotal, messagesUnread: l.messagesUnread }));

    ok(res, { labels });
  } catch (err: any) { serverError(res, err); }
}
