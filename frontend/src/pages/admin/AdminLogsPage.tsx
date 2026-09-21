import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { ScrollText, Search } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "28px 32px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  sub: { fontSize: 13, color: "var(--text-ghost)", marginTop: 4, marginBottom: 28 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "11px 14px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "#10b981", UPDATE: "#6366f1", DELETE: "#ef4444", LOGIN: "#f59e0b",
  LOGOUT: "#818cf8", ACCESS: "#60a5fa", INVITE: "#a78bfa",
};

interface Log {
  id: string; action: string; resource: string; resourceId?: string;
  description?: string; userName?: string; userEmail?: string;
  ipAddress?: string; createdAt: string;
}

export default function AdminLogsPage() {
  const { t } = useTranslation();
  const { activeOrg } = useAuthStore();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/org-admin/audit-logs?search=${search}&page=${page}&limit=${limit}`);
      setLogs(r.data.data.logs || []);
      setTotal(r.data.data.total || 0);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  }, [activeOrg?.id, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-pad">
      <h1 style={S.title}>{ t('page_audit') }</h1>
      <p style={S.sub}>Complete history of all actions performed in your organisation</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
          <input
            style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px 8px 36px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            placeholder="Search by action, resource, user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span style={{ fontSize: 12, color: "var(--text-ghost)" }}>{total} total entries</span>
      </div>

      <div style={S.card}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>
            <ScrollText size={36} style={{ margin: "0 auto 12px", display: "block", color: "var(--border)" }} />
            No audit logs found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Time", "User", "Action", "Resource", "Description", "IP"].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const ac = ACTION_COLORS[log.action?.toUpperCase()] || "#818cf8";
                  return (
                    <tr key={log.id}>
                      <td style={{ ...S.td, fontSize: 11, color: "var(--text-ghost)", whiteSpace: "nowrap" }}>
                        {new Date(log.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td style={S.td}>
                        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{log.userName || "—"}</div>
                        <div style={{ fontSize: 10, color: "var(--text-ghost)" }}>{log.userEmail}</div>
                      </td>
                      <td style={S.td}>
                        <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700, background: ac + "20", color: ac }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontSize: 12 }}>
                        <span style={{ color: "#818cf8" }}>{log.resource}</span>
                        {log.resourceId && <span style={{ fontSize: 10, color: "var(--text-ghost)", display: "block" }}>#{log.resourceId.slice(0, 8)}</span>}
                      </td>
                      <td style={{ ...S.td, fontSize: 12, color: "var(--text-sec)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.description || "—"}
                      </td>
                      <td style={{ ...S.td, fontSize: 11, color: "var(--text-ghost)", fontFamily: "monospace" }}>
                        {log.ipAddress || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "16px 0 0" }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-hover)", color: page === 1 ? "var(--text-ghost)" : "var(--text-sec)", cursor: page === 1 ? "default" : "pointer", fontSize: 12 }}>
                  ← Prev
                </button>
                <span style={{ padding: "6px 14px", fontSize: 12, color: "var(--text-ghost)" }}>
                  Page {page} of {totalPages}
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-hover)", color: page === totalPages ? "var(--text-ghost)" : "var(--text-sec)", cursor: page === totalPages ? "default" : "pointer", fontSize: 12 }}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
