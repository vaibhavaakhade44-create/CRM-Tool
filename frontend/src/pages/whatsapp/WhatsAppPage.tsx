import { useState, useEffect, useRef } from "react";
import { MessageCircle, Settings, Send, CheckCheck, Clock, AlertCircle, Users, Zap, ExternalLink, Copy, Check } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from 'react-i18next';

interface WAConfig { connected: boolean; phoneNumber?: string; displayName?: string; isActive?: boolean; }
interface WAMessage { id: string; direction: string; toPhone: string; fromPhone?: string; content: string; templateName?: string; status: string; createdAt: string; lead?: { name: string } | null; }

// ── Setup guide ───────────────────────────────────────────────
function SetupGuide({ onConfigured }: { onConfigured: () => void }) {
  const { activeOrg } = useAuthStore();
  const [form, setForm] = useState({ phoneNumberId: "", accessToken: "", wabaId: "", phoneNumber: "", displayName: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phoneNumberId || !form.accessToken) { setError("Phone Number ID and Access Token are required"); return; }
    setSaving(true); setError("");
    try {
      await api.post("/whatsapp/config", form, { headers: { "x-organization-id": activeOrg?.id } });
      onConfigured();
    } catch (err: any) { setError(err.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="rounded-2xl p-6 mb-6" style={{ background: "linear-gradient(135deg,rgba(37,211,102,0.1),rgba(37,211,102,0.05))", border: "1px solid rgba(37,211,102,0.2)" }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,211,102,0.15)" }}>
            <MessageCircle className="w-5 h-5" style={{ color: "#25d366" }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Connect WhatsApp Business</h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Send messages directly to your leads via Meta's WhatsApp Cloud API</p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-6">
        {[
          { n: "1", title: "Create Meta Business Account", desc: "Go to business.facebook.com and create/verify your business account." },
          { n: "2", title: "Set up WhatsApp Business API", desc: "Go to developers.facebook.com → My Apps → Create App → Business → Add WhatsApp product." },
          { n: "3", title: "Get Phone Number ID & Token", desc: "In WhatsApp → API Setup, copy the Phone Number ID and generate a permanent System User token." },
          { n: "4", title: "Add Webhook (optional)", desc: `Set webhook URL to your-backend.com/api/whatsapp/webhook for incoming messages.` },
        ].map(s => (
          <div key={s.n} className="flex gap-3 p-3 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white" style={{ background: "#4f46e5" }}>{s.n}</div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={save} className="space-y-4 rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Enter Your Credentials</h3>
        {[
          { key: "phoneNumberId", label: "Phone Number ID *", placeholder: "e.g. 123456789012345" },
          { key: "accessToken", label: "Access Token *", placeholder: "Paste your permanent system user token" },
          { key: "wabaId", label: "WABA ID (for templates)", placeholder: "WhatsApp Business Account ID" },
          { key: "phoneNumber", label: "Phone Number", placeholder: "e.g. +91 98765 43210" },
          { key: "displayName", label: "Display Name", placeholder: "e.g. OM Import Export" },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
            <input
              type={key === "accessToken" ? "password" : "text"}
              placeholder={placeholder}
              value={(form as any)[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
            />
          </div>
        ))}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
          style={{ background: saving ? "#16a34a99" : "#16a34a" }}>
          {saving ? "Connecting…" : "Connect WhatsApp"}
        </button>
      </form>
    </div>
  );
}

// ── Message status icon ───────────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  if (status === "SENT" || status === "DELIVERED") return <CheckCheck className="w-3 h-3" style={{ color: "#25d366" }} />;
  if (status === "FAILED") return <AlertCircle className="w-3 h-3 text-red-400" />;
  if (status === "RECEIVED") return null;
  return <Clock className="w-3 h-3" style={{ color: "var(--text-ghost)" }} />;
}

// ── Compose / send panel ──────────────────────────────────────
function SendPanel({ onSent }: { onSent: () => void }) {
  const { activeOrg } = useAuthStore();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; msg?: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !message) return;
    setSending(true); setResult(null);
    try {
      await api.post("/whatsapp/send", { to: phone, message }, { headers: { "x-organization-id": activeOrg?.id } });
      setResult({ ok: true, msg: "Message sent!" });
      setMessage(""); onSent();
    } catch (err: any) {
      setResult({ ok: false, msg: err.response?.data?.message || "Failed to send" });
    } finally { setSending(false); }
  }

  return (
    <form onSubmit={send} className="p-4 rounded-2xl space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-ghost)" }}>New Message</p>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Phone Number</label>
        <input
          type="tel"
          placeholder="e.g. 9876543210"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Message</label>
        <textarea
          rows={4}
          placeholder="Type your message…"
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
        />
      </div>
      {result && (
        <p className={`text-xs ${result.ok ? "text-emerald-400" : "text-red-400"}`}>{result.msg}</p>
      )}
      <button type="submit" disabled={sending || !phone || !message}
        className="w-full py-2 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2"
        style={{ background: sending ? "#16a34a99" : "#16a34a" }}>
        <Send className="w-3.5 h-3.5" />
        {sending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

// ── Bulk campaign sender ──────────────────────────────────────
function BulkSendPanel() {
  const { activeOrg } = useAuthStore();
  const [leads, setLeads] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    api.get("/leads?limit=100", { headers: { "x-organization-id": activeOrg?.id } })
      .then(r => setLeads((r.data?.leads || r.data || []).filter((l: any) => l.phone && !l.isDoNotCall)))
      .catch(() => setLeads([]));
  }, [activeOrg]);

  function toggle(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function send() {
    if (!message || selected.size === 0) return;
    setSending(true); setResult(null);
    try {
      const r = await api.post("/whatsapp/bulk-send",
        { leadIds: Array.from(selected), message },
        { headers: { "x-organization-id": activeOrg?.id } }
      );
      setResult(r.data);
      setSelected(new Set()); setMessage("");
    } catch (err: any) { setResult({ error: err.response?.data?.message }); }
    finally { setSending(false); }
  }

  return (
    <div className="space-y-3">
      <div className="p-4 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-ghost)" }}>
          Bulk Campaign — {selected.size} selected
        </p>
        <textarea
          rows={3}
          placeholder="Campaign message to send to selected leads…"
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm resize-none mb-3"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
        />
        {result && (
          <div className="mb-3 p-2 rounded-lg text-xs" style={{ background: "var(--bg-hover)" }}>
            {result.error
              ? <span className="text-red-400">{result.error}</span>
              : <span style={{ color: "var(--text-secondary)" }}>Sent: {result.sent} | Failed: {result.failed} | Skipped: {result.skipped}</span>
            }
          </div>
        )}
        <button onClick={send} disabled={sending || selected.size === 0 || !message}
          className="w-full py-2 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2"
          style={{ background: sending ? "#16a34a99" : "#16a34a" }}>
          <Users className="w-3.5 h-3.5" />
          {sending ? "Sending…" : `Send to ${selected.size} lead${selected.size !== 1 ? "s" : ""}`}
        </button>
      </div>

      {/* Lead list */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-4 py-2 flex items-center justify-between" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {leads.length} leads with phone (excl. DNC)
          </span>
          <button onClick={() => setSelected(leads.length === selected.size ? new Set() : new Set(leads.map(l => l.id)))}
            className="text-xs" style={{ color: "#818cf8" }}>
            {leads.length === selected.size ? "Deselect all" : "Select all"}
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {leads.map(lead => (
            <div key={lead.id} onClick={() => toggle(lead.id)}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${selected.has(lead.id) ? "bg-indigo-600" : ""}`}
                style={{ border: selected.has(lead.id) ? "none" : "1px solid var(--border-input)" }}>
                {selected.has(lead.id) && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{lead.name}</p>
                <p className="text-[11px]" style={{ color: "var(--text-ghost)" }}>{lead.phone}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg-hover)", color: "var(--text-ghost)" }}>{lead.status}</span>
            </div>
          ))}
          {leads.length === 0 && <p className="text-center py-6 text-sm" style={{ color: "var(--text-ghost)" }}>No leads with phone numbers</p>}
        </div>
      </div>
    </div>
  );
}

// ── Message history ───────────────────────────────────────────
function MessageHistory({ refresh }: { refresh: number }) {
  const { activeOrg } = useAuthStore();
  const [messages, setMessages] = useState<WAMessage[]>([]);

  useEffect(() => {
    api.get("/whatsapp/messages", { headers: { "x-organization-id": activeOrg?.id } })
      .then(r => setMessages(r.data?.messages || []))
      .catch(() => setMessages([]));
  }, [activeOrg, refresh]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-4 py-3" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-ghost)" }}>Recent Messages</p>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-center py-8 text-sm" style={{ color: "var(--text-ghost)" }}>No messages yet</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: msg.direction === "INBOUND" ? "rgba(37,211,102,0.15)" : "rgba(99,102,241,0.15)" }}>
              <MessageCircle className="w-3.5 h-3.5" style={{ color: msg.direction === "INBOUND" ? "#25d366" : "#818cf8" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  {msg.direction === "INBOUND" ? msg.fromPhone : msg.toPhone}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: msg.direction === "INBOUND" ? "rgba(37,211,102,0.1)" : "rgba(99,102,241,0.1)", color: msg.direction === "INBOUND" ? "#25d366" : "#818cf8" }}>
                  {msg.direction === "INBOUND" ? "received" : "sent"}
                </span>
                <StatusIcon status={msg.status} />
              </div>
              <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{msg.content}</p>
            </div>
            <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-ghost)" }}>
              {new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function WhatsAppPage() {
  const { t } = useTranslation();
  const { activeOrg } = useAuthStore();
  const [config, setConfig] = useState<WAConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"send" | "bulk" | "settings">("send");
  const [refreshCount, setRefreshCount] = useState(0);

  async function loadConfig() {
    try {
      const r = await api.get("/whatsapp/config", { headers: { "x-organization-id": activeOrg?.id } });
      setConfig(r.data);
    } catch { setConfig({ connected: false }); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (activeOrg) loadConfig(); }, [activeOrg]);

  async function disconnect() {
    if (!confirm("Disconnect WhatsApp?")) return;
    await api.delete("/whatsapp/config", { headers: { "x-organization-id": activeOrg?.id } });
    setConfig({ connected: false });
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!config?.connected) return <SetupGuide onConfigured={loadConfig} />;

  const TABS = [
    { key: "send", label: "Send Message", Icon: Send },
    { key: "bulk", label: "Bulk Campaign", Icon: Users },
    { key: "settings", label: "Settings", Icon: Settings },
  ] as const;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,211,102,0.12)" }}>
            <MessageCircle className="w-5 h-5" style={{ color: "#25d366" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_whatsapp') }</h1>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {config.displayName || "Connected"} · {config.phoneNumber}
              </p>
            </div>
          </div>
        </div>
        <a href="https://business.facebook.com/wa/manage" target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          <ExternalLink className="w-3 h-3" />
          Meta Dashboard
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", width: "fit-content" }}>
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === key
              ? { background: "#4f46e5", color: "#fff" }
              : { color: "var(--text-secondary)" }}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {tab === "send" && <SendPanel onSent={() => setRefreshCount(c => c + 1)} />}
          {tab === "bulk" && <BulkSendPanel />}
          {tab === "settings" && (
            <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Connection Settings</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Status</span>
                  <span className="text-emerald-400 font-medium">Connected</span>
                </div>
                <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Display Name</span>
                  <span style={{ color: "var(--text-primary)" }}>{config.displayName || "—"}</span>
                </div>
                <div className="flex justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Phone</span>
                  <span style={{ color: "var(--text-primary)" }}>{config.phoneNumber || "—"}</span>
                </div>
              </div>
              <button onClick={disconnect} className="w-full py-2 rounded-xl text-sm font-medium text-red-400 transition-colors"
                style={{ border: "1px solid rgba(248,113,113,0.3)" }}>
                Disconnect WhatsApp
              </button>
              <button onClick={() => setConfig({ connected: false })} className="w-full py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                Update Credentials
              </button>
            </div>
          )}
        </div>

        {/* Message history always visible on right */}
        <MessageHistory refresh={refreshCount} />
      </div>
    </div>
  );
}
