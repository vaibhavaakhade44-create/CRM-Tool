import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  Inbox, CheckCircle, Phone, Mail, Building2,
  Users, Clock, RefreshCw, ChevronDown, MessageSquare,
  UserCheck, XCircle, Loader2,
} from "lucide-react";

type Status = "NEW" | "CONTACTED" | "ONBOARDED" | "REJECTED";

interface DemoRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  teamSize?: string;
  message?: string;
  status: Status;
  adminNotes?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; Icon: any }> = {
  NEW:       { label: "New",       color: "#6366f1", bg: "#6366f120", Icon: Inbox },
  CONTACTED: { label: "Contacted", color: "#f59e0b", bg: "#f59e0b20", Icon: Phone },
  ONBOARDED: { label: "Onboarded", color: "#10b981", bg: "#10b98120", Icon: UserCheck },
  REJECTED:  { label: "Rejected",  color: "#ef4444", bg: "#ef444420", Icon: XCircle },
};

const ALL_STATUSES: Status[] = ["NEW", "CONTACTED", "ONBOARDED", "REJECTED"];

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function AccessRequestsPage() {
  const [requests, setRequests]   = useState<DemoRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<Status | "ALL">("ALL");
  const [saving, setSaving]       = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [notes, setNotes]         = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/super-admin/demo-requests");
      setRequests(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: Status) => {
    setSaving(id + status);
    try {
      await api.patch(`/super-admin/demo-requests/${id}`, { status });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } finally {
      setSaving(null);
    }
  };

  const saveNotes = async (id: string) => {
    setSaving(id + "notes");
    try {
      await api.patch(`/super-admin/demo-requests/${id}`, { adminNotes: notes[id] ?? "" });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, adminNotes: notes[id] } : r));
    } finally {
      setSaving(null);
    }
  };

  const filtered = filter === "ALL" ? requests : requests.filter(r => r.status === filter);

  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = requests.filter(r => r.status === s).length;
    return acc;
  }, {} as Record<Status, number>);

  return (
    <div style={{ padding: "28px 32px", fontFamily: "system-ui,-apple-system,sans-serif", minHeight: "100vh", background: "var(--bg-main,#0f0f1a)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text-primary,#e2e8f0)" }}>Access Requests</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-ghost,#6b7280)" }}>
            Demo & account requests submitted from the landing page
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border,#2a2a4a)", background: "transparent", color: "var(--text-ghost,#6b7280)", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {ALL_STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button key={s} onClick={() => setFilter(filter === s ? "ALL" : s)}
              style={{ background: filter === s ? cfg.bg : "var(--bg-card,#1a1a2e)", border: `1px solid ${filter === s ? cfg.color : "var(--border,#2a2a4a)"}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <cfg.Icon size={14} color={cfg.color} />
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cfg.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary,#e2e8f0)" }}>{counts[s]}</div>
            </button>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["ALL", ...ALL_STATUSES] as (Status|"ALL")[]).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid var(--border,#2a2a4a)", background: filter === s ? "#6366f1" : "transparent", color: filter === s ? "white" : "var(--text-ghost,#6b7280)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {s === "ALL" ? `All (${requests.length})` : `${STATUS_CONFIG[s].label} (${counts[s]})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 12, color: "var(--text-ghost,#6b7280)" }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-ghost,#6b7280)" }}>
          <Inbox size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ margin: 0 }}>No requests yet</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(r => {
            const cfg   = STATUS_CONFIG[r.status];
            const isExp = expanded === r.id;
            return (
              <div key={r.id} style={{ background: "var(--bg-card,#1a1a2e)", border: "1px solid var(--border,#2a2a4a)", borderRadius: 14, overflow: "hidden", transition: "border-color 0.15s" }}>
                {/* Main row */}
                <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  {/* Status dot */}
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary,#e2e8f0)" }}>{r.name}</span>
                      <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40`, borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{cfg.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text-ghost,#6b7280)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={10} /> {timeAgo(r.createdAt)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-ghost,#6b7280)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Building2 size={11} />{r.organization}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Mail size={11} />{r.email}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={11} />{r.phone}</span>
                      {r.teamSize && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={11} />{r.teamSize}</span>}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {ALL_STATUSES.filter(s => s !== r.status).map(s => {
                      const c2 = STATUS_CONFIG[s];
                      const isLoading = saving === r.id + s;
                      return (
                        <button key={s} onClick={() => updateStatus(r.id, s)} disabled={!!saving}
                          style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${c2.color}50`, background: c2.bg, color: c2.color, fontSize: 11, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
                          {isLoading ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : c2.label}
                        </button>
                      );
                    })}
                    <button onClick={() => setExpanded(isExp ? null : r.id)}
                      style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border,#2a2a4a)", background: "transparent", color: "var(--text-ghost,#6b7280)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                      <MessageSquare size={11} />
                      <ChevronDown size={10} style={{ transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                    </button>
                  </div>
                </div>

                {/* Expanded panel */}
                {isExp && (
                  <div style={{ borderTop: "1px solid var(--border,#2a2a4a)", padding: "16px 20px", background: "rgba(0,0,0,0.15)" }}>
                    <div className="grid-r2" style={{ gap: 16, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost,#6b7280)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Request Details</div>
                        <div style={{ fontSize: 13, color: "var(--text-primary,#e2e8f0)", lineHeight: 1.8 }}>
                          <div>📅 {fmtDate(r.createdAt)}</div>
                          {r.message && <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(99,102,241,0.08)", borderRadius: 8, border: "1px solid #6366f120", fontSize: 13, color: "var(--text-secondary,#94a3b8)", lineHeight: 1.5 }}>
                            💬 "{r.message}"
                          </div>}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost,#6b7280)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Admin Notes</div>
                        <textarea
                          value={notes[r.id] ?? (r.adminNotes || "")}
                          onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                          placeholder="Add internal notes about this request…"
                          rows={3}
                          style={{ width: "100%", background: "var(--bg-main,#0f0f1a)", border: "1px solid var(--border,#2a2a4a)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary,#e2e8f0)", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }}
                        />
                        <button onClick={() => saveNotes(r.id)} disabled={saving === r.id + "notes"}
                          style={{ marginTop: 8, padding: "7px 16px", borderRadius: 7, border: "none", background: "#6366f1", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                          {saving === r.id + "notes" ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><CheckCircle size={11} /> Save Notes</>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
