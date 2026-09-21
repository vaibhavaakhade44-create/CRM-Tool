import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { ALL_MODULES } from "@/lib/modules";
import { Check, X, Clock, Building2, User, MessageSquare } from "lucide-react";

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2, marginBottom: 24 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 } as React.CSSProperties,
};

type Status = "PENDING" | "APPROVED" | "DENIED";

interface ModuleRequest {
  id: string; moduleKey: string; status: Status; message?: string | null; responseNote?: string | null;
  requestedAt: string; resolvedAt?: string | null;
  organization: { id: string; name: string; slug: string };
  requestedBy: { id: string; name: string; email: string };
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", color: "#f59e0b", bg: "#f59e0b18" },
  APPROVED: { label: "Approved", color: "#10b981", bg: "#10b98118" },
  DENIED: { label: "Denied", color: "#f87171", bg: "#f8717118" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DenyPanel({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional, shown to the org)"
        style={{ flex: 1, background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 6, padding: "6px 10px", fontSize: 12.5, color: "var(--text-primary)" }} />
      <button onClick={() => onConfirm(note)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#f87171", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Confirm deny</button>
      <button onClick={onCancel} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-ghost)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
    </div>
  );
}

export default function SuperAdminModuleRequestsPage() {
  const [requests, setRequests] = useState<ModuleRequest[]>([]);
  const [filter, setFilter] = useState<Status | "ALL">("PENDING");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [denyingId, setDenyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/super-admin/module-requests", { params: filter !== "ALL" ? { status: filter } : {} });
      setRequests(res.data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id: string, decision: "APPROVE" | "DENY", responseNote?: string) => {
    setBusyId(id);
    try {
      await api.patch(`/super-admin/module-requests/${id}`, { decision, responseNote });
      setDenyingId(null);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div style={S.page}>
      <h1 style={S.title}>Module Requests</h1>
      <p style={S.subtitle}>Organizations asking for a module beyond what they started with. Approving adds it to their account instantly.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {(["PENDING", "APPROVED", "DENIED", "ALL"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            style={{
              padding: "6px 14px", borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              border: filter === s ? "1px solid #6366f1" : "1px solid var(--border)",
              background: filter === s ? "#6366f118" : "var(--bg-card)",
              color: filter === s ? "#818cf8" : "var(--text-sec)",
            }}>
            {s === "PENDING" ? `Pending${pendingCount ? ` (${pendingCount})` : ""}` : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-ghost)" }}>Loading…</div>
      ) : requests.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-ghost)" }}>
          <Clock size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p style={{ margin: 0 }}>No {filter !== "ALL" ? filter.toLowerCase() : ""} requests.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {requests.map((r) => {
            const cfg = STATUS_CONFIG[r.status];
            const modLabel = ALL_MODULES.find((m) => m.key === r.moduleKey)?.label || r.moduleKey;
            return (
              <div key={r.id} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{modLabel}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: "2px 8px", borderRadius: 99 }}>{cfg.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-sec)" }}>
                      <Building2 size={12} /> {r.organization.name}
                      <span style={{ color: "var(--text-ghost)" }}>·</span>
                      <User size={12} /> {r.requestedBy.name}
                      <span style={{ color: "var(--text-ghost)" }}>· {fmtDate(r.requestedAt)}</span>
                    </div>
                    {r.message && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 8, fontSize: 12.5, color: "var(--text-sec)" }}>
                        <MessageSquare size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span>{r.message}</span>
                      </div>
                    )}
                    {r.responseNote && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-ghost)", fontStyle: "italic" }}>Your note: "{r.responseNote}"</div>
                    )}
                  </div>

                  {r.status === "PENDING" && (
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => resolve(r.id, "APPROVE")} disabled={busyId === r.id}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 7, border: "none", background: "#10b981", color: "white", fontSize: 12.5, fontWeight: 600, cursor: busyId === r.id ? "default" : "pointer", opacity: busyId === r.id ? 0.6 : 1 }}>
                        <Check size={13} /> Approve
                      </button>
                      <button onClick={() => setDenyingId(denyingId === r.id ? null : r.id)}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-sec)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                        <X size={13} /> Deny
                      </button>
                    </div>
                  )}
                </div>

                {denyingId === r.id && (
                  <DenyPanel onCancel={() => setDenyingId(null)} onConfirm={(note) => resolve(r.id, "DENY", note)} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
