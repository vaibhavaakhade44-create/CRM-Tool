import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/api";
import { BarChart3, TrendingUp, Package, Users, ShoppingCart, DollarSign, Download, PieChart, Activity, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2, marginBottom: 24 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--bg-hover)" } as React.CSSProperties,
};

function BarChart({ data, color = "#6366f1" }: { data: { label: string; value: number; raw?: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: "var(--text-sec)" }}>{d.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color }}>{d.raw !== undefined ? d.raw : d.value}</span>
          </div>
          <div style={{ height: 8, background: "var(--bg-hover)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(d.value / max) * 100}%`, background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let cumulative = 0;
  const size = 120, cx = 60, cy = 60, r = 44, strokeWidth = 14;
  const circumference = 2 * Math.PI * r;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-hover)" strokeWidth={strokeWidth} />
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * circumference;
          const offset = circumference - cumulative * circumference;
          cumulative += pct;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color}
              strokeWidth={strokeWidth} strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round" />
          );
        })}
        <text x={cx} y={cy + 4} textAnchor="middle" fill="var(--text-primary)" fontSize={14} fontWeight={700}>{total}</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--text-sec)", flex: 1 }}>{seg.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: seg.color }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function downloadCsv(filename: string, rows: string[][], headers: string[]) {
  const lines = [headers, ...rows].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const { activeOrg } = useAuthStore();
  const activeOrgId = activeOrg?.id;

  const [stats, setStats] = useState<any>(null);
  const [invStats, setInvStats] = useState<any>(null);
  const [finStats, setFinStats] = useState<any>(null);
  const [leadStats, setLeadStats] = useState<any>(null);
  const [hrStats, setHrStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, iRes, fRes, lRes, hRes] = await Promise.all([
        api.get("/org-admin/stats").catch(() => ({ data: { data: {} } })),
        api.get("/inventory/summary").catch(() => ({ data: { data: {} } })),
        api.get("/finance/summary").catch(() => ({ data: { data: {} } })),
        api.get("/leads/stats").catch(() => ({ data: { data: {} } })),
        api.get("/hr/summary").catch(() => ({ data: { data: {} } })),
      ]);
      setStats(dRes.data.data);
      setInvStats(iRes.data.data);
      setFinStats(fRes.data.data);
      setLeadStats(lRes.data.data);
      setHrStats(hRes.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [activeOrgId]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n?: number) => n ? `₹${(n / 100000).toFixed(1)}L` : "₹0";
  const fmtK = (n?: number) => n ? (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`) : "₹0";

  const handleExport = async (type: string) => {
    setExporting(type);
    try {
      if (type === "parties") {
        const r = await api.get("/parties?limit=1000");
        const parties = r.data.data?.parties || r.data.data || [];
        downloadCsv("contacts.csv", parties.map((p: any) => [p.name, p.type, p.email || "", p.phone || "", p.city || "", p.country || "", p.gstin || "", p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : ""]),
          ["Name", "Type", "Email", "Phone", "City", "Country", "GSTIN", "Created"]);
      } else if (type === "inventory") {
        const r = await api.get("/inventory?limit=1000");
        const items = r.data.data?.products || r.data.data || [];
        downloadCsv("inventory.csv", items.map((p: any) => [p.name, p.sku || "", p.unit || "", p.currentStock || p.quantity || 0, p.reorderLevel || 0, p.costPrice || 0, p.sellingPrice || 0]),
          ["Name", "SKU", "Unit", "Qty", "Reorder Level", "Cost Price", "Selling Price"]);
      } else if (type === "invoices") {
        const r = await api.get("/finance?limit=1000");
        const invoices = r.data.data?.invoices || r.data.data || [];
        downloadCsv("invoices.csv", invoices.map((inv: any) => [inv.invoiceNumber || "", inv.party?.name || "", inv.status || "", inv.total || 0, inv.paidAmount || 0, (inv.total || 0) - (inv.paidAmount || 0), inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "", inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("en-IN") : ""]),
          ["Invoice #", "Party", "Status", "Total", "Paid", "Outstanding", "Due Date", "Created"]);
      } else if (type === "leads") {
        const r = await api.get("/leads?limit=1000");
        const leads = r.data.data?.leads || r.data.data || [];
        downloadCsv("leads.csv", leads.map((l: any) => [l.name || "", l.status || "", l.source || "", l.value || 0, l.company || "", l.email || "", l.phone || "", l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-IN") : ""]),
          ["Lead", "Status", "Source", "Value", "Company", "Email", "Phone", "Created"]);
      }
    } catch { /* ignore */ }
    setExporting(null);
  };

  const kpis = [
    { icon: Users, label: "Total Contacts", value: stats?.parties ?? "—", color: "#6366f1" },
    { icon: ShoppingCart, label: "Total Orders", value: stats?.orders ?? "—", color: "#f59e0b" },
    { icon: Package, label: "Products", value: invStats?.totalProducts ?? stats?.products ?? "—", color: "#10b981" },
    { icon: TrendingUp, label: "Lead Pipeline", value: leadStats ? fmt(leadStats.pipeline) : "—", color: "#a78bfa" },
  ];

  const leadStatusData = leadStats?.byStatus
    ? (leadStats.byStatus as { status: string; _count: number }[]).map((s) => ({ label: s.status, value: s._count, raw: s._count }))
    : [];

  const financeChartData = [
    { label: "Receivable", value: finStats?.totalReceivable || 0 },
    { label: "Payable", value: finStats?.totalPayable || 0 },
  ];

  const inventoryChartData = [
    { label: "Total Products", value: invStats?.totalProducts || 0, raw: invStats?.totalProducts || 0 },
    { label: "Low Stock", value: invStats?.lowStock || 0, raw: invStats?.lowStock || 0 },
    { label: "Out of Stock", value: invStats?.outOfStock || 0, raw: invStats?.outOfStock || 0 },
  ];

  const leadDonut = [
    { label: "Won", value: leadStats?.won || 0, color: "#10b981" },
    { label: "Lost", value: leadStats?.lost || 0, color: "#ef4444" },
    { label: "Pipeline", value: (leadStats?.total || 0) - (leadStats?.won || 0) - (leadStats?.lost || 0), color: "#818cf8" },
  ].filter(d => d.value > 0);

  const exports: { key: string; label: string; note: string; Icon: LucideIcon }[] = [
    { key: "parties",   label: "Party / Customer List",   note: "All CRM contacts with details",       Icon: Users      },
    { key: "inventory", label: "Inventory Stock Report",  note: "Products, quantities & prices",       Icon: Package    },
    { key: "invoices",  label: "Outstanding Invoices",    note: "All invoices with balance due",       Icon: FileText   },
    { key: "leads",     label: "Lead Pipeline Report",    note: "All leads with status & value",       Icon: TrendingUp },
  ];

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={S.title}>{ t('page_reports') }</h1>
          <p style={S.subtitle}>Business overview, charts, financial summaries and performance metrics</p>
        </div>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading analytics...</div> : (
        <>
          {/* KPI Row */}
          <div className="kpi-grid">
            {kpis.map(k => (
              <div key={k.label} style={S.kpi}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 }}>{k.label}</span>
                  <k.icon size={16} color={k.color} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: k.color, marginTop: 6 }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Charts Row 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>
            {/* Finance Bar Chart */}
            <div style={S.card}>
              <div style={S.cardTitle}><DollarSign size={16} color="#10b981" /> Finance Overview</div>
              <BarChart data={financeChartData} color="#10b981" />
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--bg-hover)" }}>
                {[
                  { label: "Paid Invoices", value: finStats?.paidInvoices ?? 0, color: "#6366f1" },
                  { label: "Overdue", value: finStats?.overdueInvoices ?? 0, color: "#ef4444" },
                ].map(r => (
                  <div key={r.label} style={S.row}>
                    <span style={{ fontSize: 13, color: "var(--text-sec)" }}>{r.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: r.color }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lead Donut */}
            <div style={S.card}>
              <div style={S.cardTitle}><PieChart size={16} color="#a78bfa" /> Lead Conversion</div>
              {leadDonut.length > 0 ? <DonutChart segments={leadDonut} /> : <div style={{ color: "var(--text-ghost)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No lead data yet</div>}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--bg-hover)" }}>
                <div style={S.row}>
                  <span style={{ fontSize: 13, color: "var(--text-sec)" }}>Pipeline Value</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>{fmt(leadStats?.pipeline)}</span>
                </div>
              </div>
            </div>

            {/* Inventory Bar Chart */}
            <div style={S.card}>
              <div style={S.cardTitle}><Package size={16} color="#f59e0b" /> Inventory Status</div>
              <BarChart data={inventoryChartData} color="#f59e0b" />
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--bg-hover)" }}>
                <div style={S.row}>
                  <span style={{ fontSize: 13, color: "var(--text-sec)" }}>Inventory Value</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>{fmt(invStats?.totalValue)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>
            {/* Lead Pipeline by status */}
            {leadStatusData.length > 0 && (
              <div style={S.card}>
                <div style={S.cardTitle}><Activity size={16} color="#818cf8" /> Pipeline by Stage</div>
                <BarChart data={leadStatusData.slice(0, 7).map(d => ({ ...d, value: d.value }))} color="#818cf8" />
              </div>
            )}

            {/* HR Summary */}
            {hrStats && (
              <div style={S.card}>
                <div style={S.cardTitle}><Users size={16} color="#60a5fa" /> HR Overview</div>
                {[
                  { label: "Total Employees", value: hrStats?.totalEmployees ?? 0, color: "#60a5fa" },
                  { label: "Active", value: hrStats?.activeEmployees ?? 0, color: "#10b981" },
                  { label: "On Leave Today", value: hrStats?.onLeave ?? 0, color: "#f59e0b" },
                  { label: "Pending Leaves", value: hrStats?.pendingLeaves ?? 0, color: "#a78bfa" },
                ].map(r => (
                  <div key={r.label} style={S.row}>
                    <span style={{ fontSize: 13, color: "var(--text-sec)" }}>{r.label}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: r.color }}>{r.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* CSV Exports */}
            <div style={S.card}>
              <div style={S.cardTitle}><BarChart3 size={16} color="#818cf8" /> Quick Exports</div>
              {exports.map(e => (
                <div key={e.key} style={{ ...S.row, cursor: "pointer" }} onClick={() => handleExport(e.key)}>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text-sec)", display: "flex", alignItems: "center", gap: 6 }}>
                      <e.Icon size={14} color="#818cf8" />{e.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2 }}>{e.note}</div>
                  </div>
                  <button
                    disabled={exporting === e.key}
                    style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", background: exporting === e.key ? "#6366f120" : "var(--bg-hover)", color: exporting === e.key ? "#818CF8" : "#6366f1", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}
                  >
                    <Download size={12} />{exporting === e.key ? "Exporting..." : "CSV"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
