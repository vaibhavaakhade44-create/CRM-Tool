import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Search, Filter } from "lucide-react";
import api from "@/lib/api";
import ExportButton from "@/components/ui/ExportButton";
import { useTranslation } from 'react-i18next';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  description?: string;
  userEmail?: string;
  userName?: string;
  ipAddress?: string;
  createdAt: string;
}

const ACTION_COLOR: Record<string, string> = {
  CREATE: "#10b981", UPDATE: "#6366f1", DELETE: "#ef4444",
  LOGIN: "#f59e0b", LOGOUT: "var(--text-muted)", EXPORT: "#60a5fa",
};

export default function AuditPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resource, setResource] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/org-admin/audit-logs", {
        params: { page, limit: PAGE_SIZE, resource: resource !== "ALL" ? resource : undefined, search: search || undefined },
      });
      setLogs(r.data.data?.logs || []);
      setTotal(r.data.data?.total || 0);
    } catch { setLogs([]); }
    setLoading(false);
  }, [page, resource, search]);

  useEffect(() => { load(); }, [load]);

  const resources = ["ALL", "Party", "Invoice", "Product", "Employee", "User", "Organization"];

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{ t('page_audit') }</h1>
          <p style={{ fontSize: 13, color: "var(--text-ghost)", marginTop: 4 }}>
            Full history of every action taken in your organization
          </p>
        </div>
        <ExportButton
          data={logs.map(l => ({ action: l.action, resource: l.resource, description: l.description, user: l.userName, email: l.userEmail, ip: l.ipAddress, date: l.createdAt }))}
          filename="audit-trail"
        />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by user, action, resource…"
            style={{ width: "100%", background: "var(--bg-input)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px 8px 30px", color: "var(--text-primary)", fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={13} style={{ color: "var(--text-ghost)" }} />
          <select
            value={resource}
            onChange={e => { setResource(e.target.value); setPage(1); }}
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13 }}
          >
            {resources.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Time", "User", "Action", "Resource", "Description", "IP"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>
                <ShieldCheck size={32} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
                No audit logs found
              </td></tr>
            ) : logs.map(log => (
              <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-ghost)", whiteSpace: "nowrap" }}>
                  {new Date(log.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{log.userName || "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{log.userEmail}</div>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{
                    background: `${ACTION_COLOR[log.action] || "#6b7280"}20`,
                    color: ACTION_COLOR[log.action] || "var(--text-muted)",
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                  }}>{log.action}</span>
                </td>
                <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--text-sec)" }}>{log.resource}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {log.description || "—"}
                </td>
                <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-ghost)", fontFamily: "monospace" }}>{log.ipAddress || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: "6px 14px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>
            ← Prev
          </button>
          <span style={{ padding: "6px 12px", color: "var(--text-ghost)", fontSize: 13 }}>
            Page {page} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          <button disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage(p => p + 1)}
            style={{ padding: "6px 14px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: page >= Math.ceil(total / PAGE_SIZE) ? "not-allowed" : "pointer", opacity: page >= Math.ceil(total / PAGE_SIZE) ? 0.4 : 1 }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
