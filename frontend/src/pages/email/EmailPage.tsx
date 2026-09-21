import { useState, useEffect, useCallback, useRef } from "react";
import DOMPurify from "dompurify";
import api from "@/lib/api";
import {
  Mail, Send, Plus, Search, X, Trash2, RefreshCw,
  Inbox, Star, FileText, AlertTriangle, Loader2,
  Reply, ChevronLeft, MailOpen, Check,
  Plug, Wifi, ChevronDown,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useTranslation } from 'react-i18next';

// ── Styles ───────────────────────────────────────────────────
const S = {
  input: { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  ghost: { background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5 } as React.CSSProperties,
};

function timeAgo(d: string) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const PROVIDER_COLORS: Record<string, string> = { GMAIL: "#ea4335", OUTLOOK: "#0078d4", YAHOO: "#6001d2", IMAP: "#10b981" };
const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  GMAIL: <span style={{ fontWeight: 800, fontSize: 11, color: "#ea4335" }}>G</span>,
  OUTLOOK: <span style={{ fontWeight: 800, fontSize: 11, color: "#0078d4" }}>O</span>,
  YAHOO: <span style={{ fontWeight: 800, fontSize: 11, color: "#6001d2" }}>Y!</span>,
  IMAP: <Wifi style={{ width: 12, height: 12, color: "#10b981" }} />,
};

interface EmailAccount { id: string; provider: string; label: string; email: string; isPrimary: boolean; }
interface MailMessage { id: string; threadId?: string; subject: string; from: string; fromName?: string; to: string; date: string; snippet: string; unread: boolean; provider: string; }
interface MailFull extends MailMessage { html?: string; text?: string; cc?: string; }
interface Folder { id: string; name: string; unread?: number; }

// ─────────────────────────────────────────────────────────────────
//  CONNECT ACCOUNT MODAL
// ─────────────────────────────────────────────────────────────────

const IMAP_PRESETS: Record<string, { label: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }> = {
  YAHOO:        { label: "Yahoo Mail",   imapHost: "imap.mail.yahoo.com",  imapPort: 993, smtpHost: "smtp.mail.yahoo.com",  smtpPort: 465 },
  ZOHO:         { label: "Zoho Mail",    imapHost: "imap.zoho.com",         imapPort: 993, smtpHost: "smtp.zoho.com",         smtpPort: 465 },
  ICLOUD:       { label: "iCloud Mail",  imapHost: "imap.mail.me.com",      imapPort: 993, smtpHost: "smtp.mail.me.com",      smtpPort: 587 },
  OUTLOOK_IMAP: { label: "Outlook/Hotmail IMAP", imapHost: "outlook.office365.com", imapPort: 993, smtpHost: "smtp.office365.com", smtpPort: 587 },
  CUSTOM:       { label: "Custom IMAP",  imapHost: "", imapPort: 993, smtpHost: "", smtpPort: 465 },
};

function ConnectModal({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [step, setStep] = useState<"pick" | "imap">("pick");
  const [imapPreset, setImapPreset] = useState("YAHOO");
  const [form, setForm] = useState({ label: "", email: "", password: "", imapHost: "", imapPort: 993, smtpHost: "", smtpPort: 465, smtpSecure: true, imapSecure: true, provider: "YAHOO" as string });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const applyPreset = (key: string) => {
  const { t } = useTranslation();
    const p = IMAP_PRESETS[key];
    setImapPreset(key);
    setForm(f => ({ ...f, ...p, provider: key === "CUSTOM" ? "IMAP" : key === "YAHOO" ? "YAHOO" : "IMAP", label: f.label || p.label }));
  };

  const connectGmail = async () => {
    const r = await api.get("/email-accounts/gmail/auth-url");
    window.location.href = r.data.data.url;
  };

  const connectOutlook = async () => {
    const r = await api.get("/email-accounts/outlook/auth-url");
    window.location.href = r.data.data.url;
  };

  const connectImap = async () => {
    if (!form.email || !form.password || !form.imapHost || !form.smtpHost) { setErr("All fields are required"); return; }
    setSaving(true); setErr("");
    try {
      await api.post("/email-accounts/imap", {
        label: form.label || form.email, email: form.email, provider: form.provider,
        imapHost: form.imapHost, imapPort: form.imapPort, imapSecure: form.imapSecure,
        smtpHost: form.smtpHost, smtpPort: form.smtpPort, smtpSecure: form.smtpSecure,
        smtpPassword: form.password,
      });
      onConnected(); onClose();
    } catch (e: any) { setErr(e.response?.data?.message || "Connection failed. Check your credentials."); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl w-full mx-4 overflow-hidden" style={{ maxWidth: 480, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
            {step === "pick" ? "Connect Email Account" : "IMAP / SMTP Setup"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>

        {step === "pick" && (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Gmail */}
            <button onClick={connectGmail} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fce8e6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#ea4335", flexShrink: 0 }}>G</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>Gmail</div>
                <div style={{ fontSize: 12, color: "var(--text-ghost)" }}>Connect with Google OAuth — no password needed</div>
              </div>
            </button>

            {/* Outlook */}
            <button onClick={connectOutlook} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#e3f2ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#0078d4", flexShrink: 0 }}>O</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>Outlook / Microsoft 365</div>
                <div style={{ fontSize: 12, color: "var(--text-ghost)" }}>Hotmail, Live, Office 365 — connect with Microsoft OAuth</div>
              </div>
            </button>

            {/* IMAP/SMTP */}
            <button onClick={() => setStep("imap")} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Wifi style={{ width: 20, height: 20, color: "#10b981" }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>Yahoo / Zoho / iCloud / Custom</div>
                <div style={{ fontSize: 12, color: "var(--text-ghost)" }}>Any provider via IMAP + SMTP credentials</div>
              </div>
            </button>
          </div>
        )}

        {step === "imap" && (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Provider quick-select */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Quick Setup</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {Object.entries(IMAP_PRESETS).map(([key, p]) => (
                  <button key={key} onClick={() => applyPreset(key)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: 500, border: `1px solid ${imapPreset === key ? "#6366f1" : "var(--border)"}`, background: imapPreset === key ? "rgba(99,102,241,0.1)" : "var(--bg-hover)", color: imapPreset === key ? "#818cf8" : "var(--text-ghost)" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {err && <div style={{ padding: "8px 12px", borderRadius: 7, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12 }}>{err}</div>}

            <div className="grid-r2" style={{ gap: 10 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ fontSize: 11, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>Account Label</label>
                <input style={S.input} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder='e.g. "My Yahoo"' />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ fontSize: 11, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>Email Address *</label>
                <input style={S.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@yahoo.com" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ fontSize: 11, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>App Password *</label>
                <input style={S.input} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="App-specific password" />
                <p style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 4 }}>Use an app password, not your regular login password.</p>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>IMAP Host</label>
                <input style={S.input} value={form.imapHost} onChange={e => setForm(f => ({ ...f, imapHost: e.target.value }))} placeholder="imap.mail.yahoo.com" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>IMAP Port</label>
                <input style={S.input} type="number" value={form.imapPort} onChange={e => setForm(f => ({ ...f, imapPort: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>SMTP Host</label>
                <input style={S.input} value={form.smtpHost} onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))} placeholder="smtp.mail.yahoo.com" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>SMTP Port</label>
                <input style={S.input} type="number" value={form.smtpPort} onChange={e => setForm(f => ({ ...f, smtpPort: parseInt(e.target.value) }))} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button onClick={() => setStep("pick")} style={S.ghost}>Back</button>
              <button onClick={connectImap} disabled={saving} style={S.btn}>
                {saving ? <Loader2 style={{ width: 14, height: 14 }} /> : <Check style={{ width: 13, height: 13 }} />}
                {saving ? "Testing…" : "Connect & Test"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  COMPOSE MODAL
// ─────────────────────────────────────────────────────────────────

function ComposeModal({ accounts, defaultAccountId, onClose, onSent, replyTo }: {
  accounts: EmailAccount[]; defaultAccountId: string; onClose: () => void; onSent: () => void;
  replyTo?: { to: string; subject: string; threadId?: string } | null;
}) {
  const [form, setForm] = useState({ to: replyTo?.to ?? "", cc: "", bcc: "", subject: replyTo ? `Re: ${replyTo.subject.replace(/^Re: /i, "")}` : "", body: "", isHtml: false });
  const [fromId, setFromId] = useState(defaultAccountId);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);

  async function send() {
    if (!form.to || !form.subject || !form.body) { setErr("To, Subject and Body are required"); return; }
    setSending(true);
    try {
      await api.post(`/email-accounts/${fromId}/send`, {
        to: form.to, cc: form.cc || undefined, bcc: form.bcc || undefined,
        subject: form.subject, body: form.body, isHtml: form.isHtml,
        ...(replyTo?.threadId && { threadId: replyTo.threadId }),
      });
      onSent(); onClose();
    } catch (e: any) {
      setErr(e.response?.data?.message ?? "Failed to send");
    } finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6" style={{ pointerEvents: "none" }}>
      <div className="rounded-2xl overflow-hidden shadow-2xl w-full" style={{ maxWidth: 540, pointerEvents: "all", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          <span className="text-sm font-bold text-white">{replyTo ? "Reply" : "New Message"}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowCcBcc(v => !v)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", cursor: "pointer", borderRadius: 5, padding: "3px 8px", fontSize: 11 }}>CC/BCC</button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}><X style={{ width: 15, height: 15 }} /></button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {err && <p style={{ fontSize: 12, color: "#ef4444" }}>{err}</p>}
          {/* From account picker */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>From</label>
            <select style={{ ...S.input, colorScheme: "dark" }} value={fromId} onChange={e => setFromId(e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.email} ({a.provider})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>To</label>
            <input style={S.input} value={form.to} onChange={e => setForm(p => ({ ...p, to: e.target.value }))} placeholder="recipient@example.com (comma-separate multiple)" />
          </div>
          {showCcBcc && (
            <>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>CC</label>
                <input style={S.input} value={form.cc} onChange={e => setForm(p => ({ ...p, cc: e.target.value }))} placeholder="cc@example.com" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>BCC</label>
                <input style={S.input} value={form.bcc} onChange={e => setForm(p => ({ ...p, bcc: e.target.value }))} placeholder="bcc@example.com" />
              </div>
            </>
          )}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>Subject</label>
            <input style={S.input} value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Subject" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-ghost)", display: "block", marginBottom: 4 }}>Message</label>
            <textarea style={{ ...S.input, resize: "vertical", minHeight: 140 } as React.CSSProperties} value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="Write your message..." />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} style={S.ghost}>Cancel</button>
            <button onClick={send} disabled={sending} style={S.btn}>
              {sending ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Send style={{ width: 13, height: 13 }} />}
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  MESSAGE VIEWER
// ─────────────────────────────────────────────────────────────────

function MessageView({ accountId, messageId, onBack, onReply }: { accountId: string; messageId: string; onBack: () => void; onReply: (data: any) => void }) {
  const [msg, setMsg] = useState<MailFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/email-accounts/${accountId}/message/${messageId}`)
      .then(r => setMsg(r.data.data))
      .finally(() => setLoading(false));
  }, [accountId, messageId]);

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}><Loader2 style={{ width: 24, height: 24, color: "#6366f1", animation: "spin 1s linear infinite" }} /></div>;
  if (!msg) return <div style={{ padding: 24, color: "var(--text-ghost)" }}>Failed to load message</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <button onClick={onBack} style={{ ...S.ghost, padding: "5px 10px" }}>
          <ChevronLeft style={{ width: 14, height: 14 }} /> Back
        </button>
        <button onClick={() => onReply({ to: msg.from, subject: msg.subject, threadId: msg.threadId })} style={{ ...S.ghost, padding: "5px 10px" }}>
          <Reply style={{ width: 13, height: 13 }} /> Reply
        </button>
      </div>
      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{msg.subject}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "var(--text-ghost)" }}>
          <div><strong style={{ color: "var(--text-secondary)" }}>From:</strong> {msg.fromName ? `${msg.fromName} <${msg.from}>` : msg.from}</div>
          <div><strong style={{ color: "var(--text-secondary)" }}>To:</strong> {msg.to}</div>
          {msg.cc && <div><strong style={{ color: "var(--text-secondary)" }}>CC:</strong> {msg.cc}</div>}
          <div><strong style={{ color: "var(--text-secondary)" }}>Date:</strong> {msg.date ? new Date(msg.date).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" }) : ""}</div>
        </div>
      </div>
      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        {msg.html
          ? <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.html) }} style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-primary)" }} />
          : <pre style={{ fontFamily: "inherit", whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, color: "var(--text-primary)" }}>{msg.text}</pre>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  MAIN EMAIL PAGE
// ─────────────────────────────────────────────────────────────────

export default function EmailPage() {
  const location = useLocation();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState("INBOX");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [openMessageId, setOpenMessageId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Default folders for any provider
  const DEFAULT_FOLDERS: Folder[] = [
    { id: "INBOX", name: "Inbox" }, { id: "SENT", name: "Sent" },
    { id: "DRAFT", name: "Drafts" }, { id: "TRASH", name: "Trash" }, { id: "SPAM", name: "Spam" },
  ];

  const loadAccounts = useCallback(async () => {
    try {
      const r = await api.get("/email-accounts");
      const list: EmailAccount[] = r.data.data || [];
      setAccounts(list);
      if (list.length && !activeAccountId) {
        const primary = list.find(a => a.isPrimary) || list[0];
        setActiveAccountId(primary.id);
      }
    } catch { /* ignore */ }
  }, [activeAccountId]);

  useEffect(() => { loadAccounts(); }, []);

  // Handle OAuth redirect params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("connected") || params.get("error")) {
      loadAccounts();
      window.history.replaceState({}, "", "/email");
    }
  }, [location.search]);

  useEffect(() => {
    if (!activeAccountId) return;
    loadFolders();
    loadMessages();
  }, [activeAccountId, activeFolder]);

  const loadFolders = async () => {
    try {
      const r = await api.get(`/email-accounts/${activeAccountId}/folders`);
      setFolders(r.data.data || []);
    } catch { setFolders(DEFAULT_FOLDERS); }
  };

  const loadMessages = async (p = 1, q = search) => {
    if (!activeAccountId) return;
    setLoading(true);
    try {
      const r = await api.get(`/email-accounts/${activeAccountId}/inbox`, { params: { folder: activeFolder, page: p, search: q } });
      setMessages(p === 1 ? r.data.data.messages : [...messages, ...r.data.data.messages]);
      setNextPage(r.data.data.nextPageToken);
      setPage(p);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const disconnect = async (id: string) => {
    await api.delete(`/email-accounts/${id}`);
    setAccounts(a => a.filter(x => x.id !== id));
    if (activeAccountId === id) setActiveAccountId(accounts.find(a => a.id !== id)?.id || "");
  };

  const setPrimary = async (id: string) => {
    await api.patch(`/email-accounts/${id}/primary`);
    loadAccounts();
  };

  const activeAccount = accounts.find(a => a.id === activeAccountId);

  const displayFolders = folders.length ? folders : DEFAULT_FOLDERS;

  return (
    <div style={{ display: "flex", height: "100vh", overflowX: "auto", overflowY: "hidden", background: "var(--bg-main)" }}>

      {/* ── Left sidebar: accounts + folders ── */}
      <aside style={{ width: 220, minWidth: 220, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Compose button */}
        <div style={{ padding: "14px 12px 8px" }}>
          <button onClick={() => { setReplyTo(null); setShowCompose(true); }} disabled={accounts.length === 0} style={{ ...S.btn, width: "100%", justifyContent: "center", opacity: accounts.length === 0 ? 0.4 : 1 }}>
            <Plus style={{ width: 14, height: 14 }} /> Compose
          </button>
        </div>

        {/* Account switcher */}
        <div ref={accountMenuRef} style={{ padding: "0 12px 8px", position: "relative" }}>
          {accounts.length === 0 ? (
            <button onClick={() => setShowConnect(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", borderRadius: 9, background: "var(--bg-hover)", border: "1px dashed var(--border)", cursor: "pointer", width: "100%", fontSize: 12, color: "#6366f1", fontWeight: 600 }}>
              <Plug style={{ width: 13, height: 13 }} /> Connect Email
            </button>
          ) : (
            <>
              <button onClick={() => setShowAccountMenu(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, background: "var(--bg-hover)", border: "1px solid var(--border)", cursor: "pointer", width: "100%", textAlign: "left" }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: PROVIDER_COLORS[activeAccount?.provider || ""] + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {PROVIDER_ICONS[activeAccount?.provider || "IMAP"]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeAccount?.email || "No account"}</div>
                  <div style={{ fontSize: 10, color: "var(--text-ghost)" }}>{activeAccount?.provider}</div>
                </div>
                <ChevronDown style={{ width: 11, height: 11, color: "var(--text-ghost)", flexShrink: 0 }} />
              </button>

              {showAccountMenu && (
                <div style={{ position: "absolute", top: "100%", left: 12, right: 12, zIndex: 50, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
                  {accounts.map(acc => (
                    <div key={acc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: acc.id === activeAccountId ? "var(--bg-hover)" : "transparent" }}
                      onClick={() => { setActiveAccountId(acc.id); setShowAccountMenu(false); setOpenMessageId(null); }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: PROVIDER_COLORS[acc.provider] + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {PROVIDER_ICONS[acc.provider]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.email}</div>
                        {acc.isPrimary && <div style={{ fontSize: 9, color: "#6366f1" }}>Primary</div>}
                      </div>
                      <button onClick={e => { e.stopPropagation(); disconnect(acc.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)" }}>
                        <X style={{ width: 11, height: 11 }} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => { setShowConnect(true); setShowAccountMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", background: "none", border: "none", cursor: "pointer", width: "100%", fontSize: 12, color: "#6366f1", fontWeight: 600 }}>
                    <Plus style={{ width: 12, height: 12 }} /> Add Account
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Folder list */}
        <nav style={{ flex: 1, overflow: "auto", padding: "0 8px" }}>
          {displayFolders.map(f => {
            const icons: Record<string, React.ReactNode> = {
              INBOX: <Inbox style={{ width: 13, height: 13 }} />, inbox: <Inbox style={{ width: 13, height: 13 }} />,
              SENT: <Send style={{ width: 13, height: 13 }} />, sentitems: <Send style={{ width: 13, height: 13 }} />,
              DRAFT: <FileText style={{ width: 13, height: 13 }} />, drafts: <FileText style={{ width: 13, height: 13 }} />,
              STARRED: <Star style={{ width: 13, height: 13 }} />,
              TRASH: <Trash2 style={{ width: 13, height: 13 }} />, deleteditems: <Trash2 style={{ width: 13, height: 13 }} />,
              SPAM: <AlertTriangle style={{ width: 13, height: 13 }} />, junkemail: <AlertTriangle style={{ width: 13, height: 13 }} />,
            };
            const isActive = activeFolder === f.id;
            return (
              <button key={f.id} onClick={() => { setActiveFolder(f.id); setOpenMessageId(null); setPage(1); }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, width: "100%", border: "none", cursor: "pointer", fontSize: 12, textAlign: "left", marginBottom: 2, background: isActive ? "rgba(99,102,241,0.12)" : "transparent", color: isActive ? "#818cf8" : "var(--text-ghost)", fontWeight: isActive ? 600 : 400 }}>
                {icons[f.id] || <Mail style={{ width: 13, height: 13 }} />}
                <span style={{ flex: 1 }}>{f.name}</span>
                {(f.unread ?? 0) > 0 && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 9999, background: "#6366f1", color: "#fff", fontWeight: 700 }}>{f.unread}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Message list ── */}
      <div style={{ width: 320, minWidth: 320, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Search + refresh */}
        <div style={{ padding: "12px 12px 8px", display: "flex", gap: 6, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--text-ghost)" }} />
            <input style={{ ...S.input, paddingLeft: 30, fontSize: 12 }} value={search} placeholder="Search messages…"
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { setPage(1); loadMessages(1, search); } }} />
          </div>
          <button onClick={() => loadMessages(1)} style={{ ...S.ghost, padding: "7px 9px" }}>
            <RefreshCw style={{ width: 13, height: 13 }} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {accounts.length === 0 && (
            <div style={{ padding: 24, textAlign: "center" }}>
              <Mail style={{ width: 36, height: 36, color: "var(--text-ghost)", margin: "0 auto 12px", display: "block" }} />
              <div style={{ fontSize: 13, color: "var(--text-ghost)", marginBottom: 12 }}>No email accounts connected</div>
              <button onClick={() => setShowConnect(true)} style={{ ...S.btn, margin: "0 auto" }}>
                <Plug style={{ width: 13, height: 13 }} /> Connect Email
              </button>
            </div>
          )}

          {loading && messages.length === 0 && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <Loader2 style={{ width: 24, height: 24, color: "#6366f1", animation: "spin 1s linear infinite", display: "block", margin: "0 auto" }} />
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} onClick={() => setOpenMessageId(msg.id)}
              style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: openMessageId === msg.id ? "rgba(99,102,241,0.08)" : "transparent", borderLeft: openMessageId === msg.id ? "3px solid #6366f1" : "3px solid transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: msg.unread ? 700 : 500, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {msg.fromName || msg.from}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-ghost)", flexShrink: 0, marginLeft: 8 }}>{timeAgo(msg.date)}</span>
              </div>
              <div style={{ fontSize: 12, color: msg.unread ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: msg.unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{msg.subject}</div>
              <div style={{ fontSize: 11, color: "var(--text-ghost)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.snippet}</div>
            </div>
          ))}

          {nextPage && !loading && (
            <div style={{ padding: 12, textAlign: "center" }}>
              <button onClick={() => loadMessages(page + 1)} style={S.ghost}>Load more</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Message view / empty state ── */}
      <main style={{ flex: 1, minWidth: 320, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {openMessageId && activeAccountId
          ? <MessageView accountId={activeAccountId} messageId={openMessageId} onBack={() => setOpenMessageId(null)} onReply={data => { setReplyTo(data); setShowCompose(true); }} />
          : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-ghost)" }}>
              <MailOpen style={{ width: 48, height: 48, marginBottom: 16, opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>Select a message to read</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {accounts.length === 0 ? "Connect an email account to get started" : `${messages.length} message${messages.length === 1 ? "" : "s"} in ${activeFolder.toLowerCase()}`}
              </div>
            </div>
          )
        }
      </main>

      {/* Modals */}
      {showConnect && <ConnectModal onClose={() => setShowConnect(false)} onConnected={loadAccounts} />}
      {showCompose && accounts.length > 0 && (
        <ComposeModal accounts={accounts} defaultAccountId={activeAccountId} replyTo={replyTo} onClose={() => { setShowCompose(false); setReplyTo(null); }} onSent={() => loadMessages(1)} />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
