import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { FolderOpen, Search, FileText, FileSpreadsheet, File, Image, Download, Trash2, X } from "lucide-react";
import { useTranslation } from 'react-i18next';

const ENTITY_LABELS: Record<string, string> = {
  PRODUCT: "Inventory", PURCHASE_ORDER: "Purchase", SALES_ORDER: "Sales Orders",
  INVOICE: "Finance", EMPLOYEE: "HR", LEAD: "Leads", DEAL: "Deals",
  QUOTATION: "Quotations", PARTY: "CRM", GOODS_ENTRY: "Dispatch",
  WAREHOUSE: "Warehouse", PROJECT: "Projects",
};
const ENTITY_COLORS: Record<string, string> = {
  PRODUCT: "#34d399", PURCHASE_ORDER: "#c084fc", SALES_ORDER: "#f59e0b",
  INVOICE: "#f87171", EMPLOYEE: "#818cf8", LEAD: "#fb923c", DEAL: "#10b981",
  QUOTATION: "#60a5fa", PARTY: "#818cf8", GOODS_ENTRY: "#f59e0b",
};

interface Doc {
  id: string; originalName: string; mimeType: string; fileSize: number;
  entityType: string; entityId: string; description?: string; createdAt: string;
}
interface Stats { total: number; totalSize: number; byType: Array<{ entityType: string; _count: number }>; }

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return <FileText size={18} color="#ef4444" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv") || mimeType.includes("excel"))
    return <FileSpreadsheet size={18} color="#10b981" />;
  if (mimeType.startsWith("image/")) return <Image size={18} color="#a78bfa" />;
  if (mimeType.includes("word")) return <FileText size={18} color="#3b82f6" />;
  return <File size={18} color="#818cf8" />;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const S = {
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  th: { textAlign: "left" as const, padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 14px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
};

export default function DocumentsPage() {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (entityFilter) params.entityType = entityFilter;
      const [docsRes, statsRes] = await Promise.all([
        api.get("/documents", { params }),
        api.get("/documents/stats"),
      ]);
      setDocs(docsRes.data.data?.documents || []);
      setStats(statsRes.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, entityFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (doc: Doc) => {
    try {
      const r = await api.get(`/documents/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url; a.download = doc.originalName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { alert("Download failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this file permanently?")) return;
    try { await api.delete(`/documents/${id}`); setDocs(p => p.filter(d => d.id !== id)); load(); }
    catch { alert("Delete failed"); }
  };

  const activeTypes = stats?.byType || [];

  return (
    <div className="page-pad" style={{ minHeight: "100vh", background: "#070714" }}>
      {/* Header */}
      <div className="page-hdr" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FolderOpen size={20} color="#818CF8" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{ t('page_documents') }</h1>
            <p style={{ fontSize: 13, color: "var(--text-ghost)", marginTop: 2 }}>All uploaded files across your organization</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        <div style={S.kpi}>
          <div style={{ fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 }}>Total Files</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>{stats?.total ?? "—"}</div>
        </div>
        <div style={S.kpi}>
          <div style={{ fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 }}>Storage Used</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#818cf8", marginTop: 4 }}>{stats ? fmtSize(stats.totalSize) : "—"}</div>
        </div>
        <div style={S.kpi}>
          <div style={{ fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 }}>Modules With Files</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981", marginTop: 4 }}>{activeTypes.filter(t => t._count > 0).length}</div>
        </div>
      </div>

      {/* Module filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" as const }}>
        <button
          onClick={() => setEntityFilter("")}
          style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", ...(entityFilter === "" ? { background: "#6366f1", borderColor: "#6366f1", color: "white" } : { background: "transparent", borderColor: "var(--border-input)", color: "var(--text-ghost)" }) }}
        >
          All
        </button>
        {activeTypes.map(t => {
          const label = ENTITY_LABELS[t.entityType] || t.entityType;
          const color = ENTITY_COLORS[t.entityType] || "#818cf8";
          const active = entityFilter === t.entityType;
          return (
            <button
              key={t.entityType}
              onClick={() => setEntityFilter(active ? "" : t.entityType)}
              style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? color : color + "40"}`, background: active ? color + "20" : "transparent", color: active ? color : color + "aa" }}
            >
              {label} ({t._count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 18, maxWidth: 400 }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
        <input
          style={{ width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px 9px 32px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const }}
          placeholder="Search by file name or description..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer", padding: 2 }}><X size={13} /></button>
        )}
      </div>

      {/* File table */}
      <div className="table-wrap" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div>
        ) : docs.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <FolderOpen size={44} color="var(--border)" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "var(--text-ghost)", margin: 0, fontSize: 14 }}>No documents uploaded yet</p>
            <p style={{ color: "var(--text-ghost)", margin: "4px 0 0", fontSize: 12 }}>Upload files from any module — Inventory, Purchase, HR, Finance, etc.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["File", "Module", "Size", "Uploaded", "Actions"].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => {
                  const color = ENTITY_COLORS[doc.entityType] || "#818cf8";
                  const label = ENTITY_LABELS[doc.entityType] || doc.entityType;
                  return (
                    <tr key={doc.id}
                      onMouseEnter={e => (e.currentTarget.style.background = "#0A0A18")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <td style={S.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flexShrink: 0 }}>{getFileIcon(doc.mimeType)}</div>
                          <div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{doc.originalName}</div>
                            {doc.description && <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{doc.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={S.td}>
                        <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: color + "18", color }}>{label}</span>
                      </td>
                      <td style={{ ...S.td, color: "var(--text-faint)" }}>{fmtSize(doc.fileSize)}</td>
                      <td style={{ ...S.td, color: "var(--text-faint)", whiteSpace: "nowrap" as const }}>
                        {new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td style={S.td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => handleDownload(doc)}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818CF8" }}
                          >
                            <Download size={12} /> Download
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            style={{ padding: "5px 8px", borderRadius: 6, cursor: "pointer", background: "transparent", border: "1px solid var(--border-input)", color: "var(--text-ghost)" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-ghost)"; }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
