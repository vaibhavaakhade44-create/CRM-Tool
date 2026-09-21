import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Plus, Trash2, RotateCw, Send, ChevronDown, ChevronUp, Copy, CheckCircle, XCircle, Zap } from "lucide-react";
import { useTranslation } from 'react-i18next';

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

interface Delivery {
  id: string;
  event: string;
  success: boolean;
  statusCode: number | null;
  createdAt: string;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  deliveries: Delivery[];
  _count: { deliveries: number };
}

const ALL_EVENTS = [
  "invoice.created", "invoice.paid", "invoice.cancelled",
  "payment.received", "contact.created", "contact.updated",
  "purchase_order.created", "purchase_order.approved",
  "lead.created", "lead.converted", "stock.low", "work_order.completed",
];

function authHeaders(token: string, orgId: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-organization-id": orgId };
}

function EventBadge({ event }: { event: string }) {
  return (
    <span style={{
      fontSize: 10, padding: "2px 7px", borderRadius: 9999,
      background: "#1e1b4b", color: "#a5b4fc", border: "1px solid #3730a3",
      fontFamily: "monospace",
    }}>{event}</span>
  );
}

function AddWebhookModal({ events, onClose, onSaved }: { events: string[]; onClose: () => void; onSaved: () => void }) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [url, setUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const toggle = (e: string) => setSelected(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e]);

  async function save() {
    if (!url.trim()) { setErr("URL is required"); return; }
    if (!selected.length) { setErr("Select at least one event"); return; }
    setSaving(true);
    const r = await fetch(`${API}/webhooks`, {
      method: "POST",
      headers: authHeaders(token!, activeOrg!.id),
      body: JSON.stringify({ url: url.trim(), events: selected, description: desc || undefined }),
    });
    setSaving(false);
    if (r.ok) { onSaved(); onClose(); } else { const d = await r.json(); setErr(d.message || "Error"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="rounded-2xl p-6 w-full max-w-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>Add Webhook Endpoint</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Endpoint URL *</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-server.com/webhook"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--bg-hover)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Slack notifications"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: "var(--bg-hover)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text-secondary)" }}>Events to subscribe *</label>
            <div className="flex flex-wrap gap-2">
              {events.map(e => (
                <button key={e} onClick={() => toggle(e)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    background: selected.includes(e) ? "#4f46e5" : "var(--bg-hover)",
                    color: selected.includes(e) ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${selected.includes(e) ? "#4f46e5" : "var(--border-input)"}`,
                    fontFamily: "monospace",
                  }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#4f46e5" }}>
            {saving ? "Saving…" : "Create Webhook"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WebhookCard({ webhook, allEvents, onRefresh }: { webhook: Webhook; allEvents: string[]; onRefresh: () => void }) {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [expanded, setExpanded] = useState(false);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loadingDel, setLoadingDel] = useState(false);
  const [testing, setTesting] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState(false);
  const headers = () => authHeaders(token!, activeOrg!.id);

  async function loadDeliveries() {
    setLoadingDel(true);
    const r = await fetch(`${API}/webhooks/${webhook.id}/deliveries`, { headers: headers() });
    if (r.ok) { const d = await r.json(); setDeliveries(d.data ?? []); }
    setLoadingDel(false);
  }

  function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && deliveries.length === 0) loadDeliveries();
  }

  async function toggleActive() {
    await fetch(`${API}/webhooks/${webhook.id}`, {
      method: "PUT", headers: headers(),
      body: JSON.stringify({ isActive: !webhook.isActive }),
    });
    onRefresh();
  }

  async function test() {
    setTesting(true);
    await fetch(`${API}/webhooks/${webhook.id}/test`, { method: "POST", headers: headers() });
    setTesting(false);
    if (expanded) loadDeliveries();
    else { setExpanded(true); loadDeliveries(); }
  }

  async function rotate() {
    if (!confirm("Rotate secret? The current secret will stop working immediately.")) return;
    setRotating(true);
    await fetch(`${API}/webhooks/${webhook.id}/rotate-secret`, { method: "POST", headers: headers() });
    setRotating(false);
    onRefresh();
  }

  async function del() {
    if (!confirm("Delete this webhook endpoint?")) return;
    await fetch(`${API}/webhooks/${webhook.id}`, { method: "DELETE", headers: headers() });
    onRefresh();
  }

  function copySecret() {
    navigator.clipboard.writeText(webhook.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const lastFive = webhook.deliveries ?? [];
  const successRate = lastFive.length ? Math.round((lastFive.filter(d => d.success).length / lastFive.length) * 100) : null;

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono font-medium truncate" style={{ color: "var(--text-primary)" }}>{webhook.url}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${webhook.isActive ? "bg-green-900/40 text-green-400" : "bg-zinc-700/40 text-zinc-400"}`}>
              {webhook.isActive ? "Active" : "Paused"}
            </span>
          </div>
          {webhook.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>{webhook.description}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {webhook.events.map(e => <EventBadge key={e} event={e} />)}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs" style={{ color: "var(--text-ghost)" }}>{webhook._count.deliveries} deliveries</span>
            {successRate !== null && (
              <span className={`text-xs font-medium ${successRate >= 80 ? "text-green-400" : successRate >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                {successRate}% success
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={test} disabled={testing} title="Send test ping"
            className="p-1.5 rounded-lg transition-colors cursor-pointer" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
            <Send style={{ width: 13, height: 13 }} />
          </button>
          <button onClick={rotate} disabled={rotating} title="Rotate secret"
            className="p-1.5 rounded-lg transition-colors cursor-pointer" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
            <RotateCw style={{ width: 13, height: 13 }} />
          </button>
          <button onClick={toggleActive} title={webhook.isActive ? "Pause" : "Activate"}
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ background: webhook.isActive ? "#14532d33" : "#1e1b4b", color: webhook.isActive ? "#4ade80" : "#a5b4fc" }}>
            <Zap style={{ width: 13, height: 13 }} />
          </button>
          <button onClick={del} title="Delete"
            className="p-1.5 rounded-lg transition-colors cursor-pointer" style={{ background: "#450a0a33", color: "#f87171" }}>
            <Trash2 style={{ width: 13, height: 13 }} />
          </button>
          <button onClick={toggleExpand} className="p-1.5 rounded-lg cursor-pointer" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
            {expanded ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Secret */}
          <div className="mb-4">
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Signing Secret</p>
            <div className="flex items-center gap-2">
              <code className="text-xs px-3 py-1.5 rounded-lg font-mono flex-1 truncate"
                style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                {webhook.secret}
              </code>
              <button onClick={copySecret} className="p-1.5 rounded-lg cursor-pointer" style={{ background: "var(--bg-hover)", color: copied ? "#4ade80" : "var(--text-secondary)" }}>
                {copied ? <CheckCircle style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
              </button>
            </div>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-ghost)" }}>
              Verify with: <code>HMAC-SHA256(secret, request_body)</code> → compare to <code>X-BusinessOS-Signature</code> header
            </p>
          </div>

          {/* Delivery log */}
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Recent Deliveries</p>
          {loadingDel ? (
            <p className="text-xs" style={{ color: "var(--text-ghost)" }}>Loading…</p>
          ) : deliveries.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-ghost)" }}>No deliveries yet. Send a test ping.</p>
          ) : (
            <div className="space-y-1.5">
              {deliveries.map(d => (
                <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
                  style={{ background: "var(--bg-hover)" }}>
                  {d.success
                    ? <CheckCircle style={{ width: 12, height: 12, color: "#4ade80", flexShrink: 0 }} />
                    : <XCircle style={{ width: 12, height: 12, color: "#f87171", flexShrink: 0 }} />}
                  <span className="font-mono" style={{ color: "#a5b4fc" }}>{d.event}</span>
                  {d.statusCode && <span style={{ color: "var(--text-ghost)" }}>HTTP {d.statusCode}</span>}
                  <span className="ml-auto" style={{ color: "var(--text-ghost)" }}>{new Date(d.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WebhooksPage() {
  const { t } = useTranslation();
  const { accessToken: token, activeOrg } = useAuthStore();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [allEvents, setAllEvents] = useState<string[]>(ALL_EVENTS);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch(`${API}/webhooks`, {
      headers: { Authorization: `Bearer ${token}`, "x-organization-id": activeOrg!.id },
    });
    if (r.ok) {
      const d = await r.json();
      setWebhooks(d.data?.webhooks ?? []);
      if (d.data?.events) setAllEvents(d.data.events);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [activeOrg?.id]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_webhooks') }</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Send real-time event notifications to your external systems
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          <Plus style={{ width: 14, height: 14 }} />
          Add Endpoint
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl p-4 mb-6 flex gap-3"
        style={{ background: "#1e1b4b", border: "1px solid #3730a3" }}>
        <Zap style={{ width: 16, height: 16, color: "#818cf8", flexShrink: 0, marginTop: 1 }} />
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: "#c7d2fe" }}>How webhooks work</p>
          <p className="text-xs" style={{ color: "#818cf8" }}>
            BusinessOS sends a POST request to your endpoint URL when subscribed events occur. Each request includes an
            <code className="mx-1 px-1 rounded" style={{ background: "#312e81" }}>X-BusinessOS-Signature</code>
            header — verify it with your secret using HMAC-SHA256 to ensure authenticity.
          </p>
        </div>
      </div>

      {/* Webhook list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16">
          <Zap style={{ width: 40, height: 40, color: "var(--text-ghost)", margin: "0 auto 12px" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No webhook endpoints yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>Add an endpoint to start receiving events</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(w => (
            <WebhookCard key={w.id} webhook={w} allEvents={allEvents} onRefresh={load} />
          ))}
        </div>
      )}

      {/* Events reference */}
      <div className="mt-8 rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>Available Events</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allEvents.map(e => (
            <div key={e} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
              style={{ background: "var(--bg-hover)" }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#6366f1" }} />
              <code style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>{e}</code>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <AddWebhookModal events={allEvents} onClose={() => setShowAdd(false)} onSaved={load} />
      )}
    </div>
  );
}
