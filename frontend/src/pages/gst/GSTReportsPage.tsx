import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { FileText, Download, TrendingUp, TrendingDown, DollarSign, BarChart3, RefreshCw } from "lucide-react";
import { useTranslation } from 'react-i18next';

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const S = {
  title:  { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  sub:    { fontSize: 13, color: "var(--text-ghost)", marginTop: 4, marginBottom: 24 } as React.CSSProperties,
  card:   { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 16 } as React.CSSProperties,
  kpi:    { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" } as React.CSSProperties,
  label:  { fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em" } as React.CSSProperties,
  th:     { padding: "8px 12px", textAlign: "left" as const, fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" as const },
  td:     { padding: "10px 12px", fontSize: 12, color: "var(--text-primary)", borderBottom: "1px solid var(--border)" },
  tdNum:  { padding: "10px 12px", fontSize: 12, color: "var(--text-primary)", borderBottom: "1px solid var(--border)", textAlign: "right" as const, fontVariantNumeric: "tabular-nums" },
};

function fmt(n: number) { return "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtN(n: number) { return (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function KPI({ label, value, color = "#6366f1", icon }: { label: string; value: string; color?: string; icon: React.ReactNode }) {
  return (
    <div style={S.kpi}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <span style={S.label}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function exportCSV(rows: any[], filename: string, headers: string[], keys: string[]) {
  const lines = [headers.join(","), ...rows.map(r => keys.map(k => `"${r[k] ?? ""}"`).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function GSTReportsPage() {
  const { t } = useTranslation();
  const now = new Date();
  const [tab, setTab] = useState<"gstr1" | "gstr3b" | "itc" | "annual">("gstr3b");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [gstr1, setGstr1] = useState<any>(null);
  const [gstr3b, setGstr3b] = useState<any>(null);
  const [itc, setItc] = useState<any>(null);
  const [annual, setAnnual] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "gstr1") {
        const r = await api.get(`/gst/gstr1?month=${month}&year=${year}`);
        setGstr1(r.data.data);
      } else if (tab === "gstr3b") {
        const r = await api.get(`/gst/gstr3b?month=${month}&year=${year}`);
        setGstr3b(r.data.data);
      } else if (tab === "itc") {
        const r = await api.get(`/gst/itc-ledger?month=${month}&year=${year}`);
        setItc(r.data.data);
      } else {
        const r = await api.get(`/gst/annual-summary?year=${year}`);
        setAnnual(r.data.data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [tab, month, year]);

  useEffect(() => { load(); }, [load]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)} style={{
      padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
      background: tab === t ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "var(--bg-card)",
      color: tab === t ? "white" : "var(--text-ghost)",
    }}>{label}</button>
  );

  const selectStyle: React.CSSProperties = {
    background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8,
    padding: "7px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none",
  };

  return (
    <div className="page-pad">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={S.title}>{ t('page_gst') }</h1>
          <p style={S.sub}>GSTR-1, GSTR-3B, ITC Ledger and Annual Summary for GST compliance filing</p>
        </div>
        <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-sec)", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {tabBtn("gstr3b", "GSTR-3B")}
          {tabBtn("gstr1", "GSTR-1")}
          {tabBtn("itc", "ITC Ledger")}
          {tabBtn("annual", "Annual")}
        </div>
        {tab !== "annual" && (
          <select value={month} onChange={e => setMonth(+e.target.value)} style={selectStyle}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        )}
        <select value={year} onChange={e => setYear(+e.target.value)} style={selectStyle}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <div style={{ padding: 60, textAlign: "center", color: "var(--text-ghost)" }}>Loading GST data…</div>}

      {/* ── GSTR-3B ── */}
      {!loading && tab === "gstr3b" && gstr3b && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
            <KPI label="Outward Taxable" value={fmt(gstr3b.outward.taxableValue)} color="#6366f1" icon={<TrendingUp size={14} color="#6366f1" />} />
            <KPI label="Tax Liability" value={fmt(gstr3b.outward.total)} color="#f59e0b" icon={<DollarSign size={14} color="#f59e0b" />} />
            <KPI label="ITC Available" value={fmt(gstr3b.itc.total)} color="#10b981" icon={<TrendingDown size={14} color="#10b981" />} />
            <KPI label="Net Tax Payable" value={fmt(gstr3b.netTax.total)} color="#ef4444" icon={<FileText size={14} color="#ef4444" />} />
          </div>

          <div className="grid-r2" style={{ gap: 16, marginBottom: 16 }}>
            {/* Outward */}
            <div style={S.card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingUp size={14} color="#6366f1" /> 3.1 — Outward Supplies
              </div>
              {[
                ["Taxable Value", fmt(gstr3b.outward.taxableValue)],
                ["IGST", fmt(gstr3b.outward.igst)],
                ["CGST", fmt(gstr3b.outward.cgst)],
                ["SGST", fmt(gstr3b.outward.sgst)],
                ["Total Tax", fmt(gstr3b.outward.total)],
                ["Invoices", gstr3b.outward.invoiceCount],
              ].map(([k, v]) => (
                <div key={k as string} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span style={{ color: "var(--text-sec)" }}>{k}</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* ITC */}
            <div style={S.card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingDown size={14} color="#10b981" /> 4 — ITC Available
              </div>
              {[
                ["Taxable Value", fmt(gstr3b.itc.taxableValue)],
                ["IGST Credit", fmt(gstr3b.itc.igst)],
                ["CGST Credit", fmt(gstr3b.itc.cgst)],
                ["SGST Credit", fmt(gstr3b.itc.sgst)],
                ["Total ITC", fmt(gstr3b.itc.total)],
                ["Purchase Invoices", gstr3b.itc.invoiceCount],
              ].map(([k, v]) => (
                <div key={k as string} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span style={{ color: "var(--text-sec)" }}>{k}</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Net Tax */}
          <div style={{ ...S.card, background: "#ef444408", border: "1px solid #ef444430" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", marginBottom: 14 }}>5 — Net Tax Payable</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
              {[["IGST Payable", fmt(gstr3b.netTax.igst), "#6366f1"], ["CGST Payable", fmt(gstr3b.netTax.cgst), "#10b981"], ["SGST Payable", fmt(gstr3b.netTax.sgst), "#f59e0b"], ["Total Payable", fmt(gstr3b.netTax.total), "#ef4444"]].map(([k, v, c]) => (
                <div key={k as string} style={{ textAlign: "center", padding: "14px", borderRadius: 10, background: (c as string) + "15", border: `1px solid ${c}30` }}>
                  <div style={{ fontSize: 11, color: "var(--text-ghost)", marginBottom: 4, fontWeight: 700, textTransform: "uppercase" }}>{k}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c as string }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── GSTR-1 ── */}
      {!loading && tab === "gstr1" && gstr1 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 20 }}>
            <KPI label="Total Invoices" value={gstr1.totals.invoiceCount.toString()} color="#6366f1" icon={<FileText size={14} color="#6366f1" />} />
            <KPI label="Taxable Value" value={fmt(gstr1.totals.taxableValue)} color="#f59e0b" icon={<DollarSign size={14} color="#f59e0b" />} />
            <KPI label="Total IGST" value={fmt(gstr1.totals.igst)} color="#6366f1" icon={<TrendingUp size={14} color="#6366f1" />} />
            <KPI label="CGST + SGST" value={fmt(gstr1.totals.cgst + gstr1.totals.sgst)} color="#10b981" icon={<TrendingUp size={14} color="#10b981" />} />
          </div>

          {/* B2B */}
          {gstr1.b2b.length > 0 && (
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>B2B Supplies — {gstr1.b2b.length} invoices</span>
                <button onClick={() => exportCSV(gstr1.b2b, `gstr1-b2b-${month}-${year}.csv`, ["Invoice No","Date","Party","GSTIN","Place","Taxable","IGST","CGST","SGST","Total"], ["invoiceNumber","invoiceDate","partyName","partyGSTIN","placeOfSupply","taxableValue","igst","cgst","sgst","total"])}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-hover)", color: "var(--text-sec)", cursor: "pointer", fontSize: 12 }}>
                  <Download size={12} /> Export CSV
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    {["Invoice No","Date","Party","GSTIN","Type","Taxable","IGST","CGST","SGST","Total"].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {gstr1.b2b.map((r: any, i: number) => (
                      <tr key={i}>
                        <td style={S.td}>{r.invoiceNumber}</td>
                        <td style={S.td}>{new Date(r.invoiceDate).toLocaleDateString("en-IN")}</td>
                        <td style={S.td}>{r.partyName}</td>
                        <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11 }}>{r.partyGSTIN}</td>
                        <td style={S.td}><span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: r.isInterState ? "#6366f120" : "#10b98120", color: r.isInterState ? "#818cf8" : "#10b981", fontWeight: 700 }}>{r.isInterState ? "IGST" : "CGST+SGST"}</span></td>
                        <td style={S.tdNum}>{fmtN(r.taxableValue)}</td>
                        <td style={S.tdNum}>{fmtN(r.igst)}</td>
                        <td style={S.tdNum}>{fmtN(r.cgst)}</td>
                        <td style={S.tdNum}>{fmtN(r.sgst)}</td>
                        <td style={{ ...S.tdNum, fontWeight: 700 }}>{fmtN(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* HSN Summary */}
          {gstr1.hsnSummary.length > 0 && (
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>HSN / SAC Summary</span>
                <button onClick={() => exportCSV(gstr1.hsnSummary, `gstr1-hsn-${month}-${year}.csv`, ["HSN","Description","Qty","Taxable","IGST","CGST","SGST"], ["hsnCode","description","totalQty","taxableValue","igst","cgst","sgst"])}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-hover)", color: "var(--text-sec)", cursor: "pointer", fontSize: 12 }}>
                  <Download size={12} /> Export CSV
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["HSN/SAC","Description","Total Qty","Taxable Value","IGST","CGST","SGST"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {gstr1.hsnSummary.map((r: any, i: number) => (
                      <tr key={i}>
                        <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700 }}>{r.hsnCode}</td>
                        <td style={S.td}>{r.description}</td>
                        <td style={S.tdNum}>{fmtN(r.totalQty)}</td>
                        <td style={S.tdNum}>{fmtN(r.taxableValue)}</td>
                        <td style={S.tdNum}>{fmtN(r.igst)}</td>
                        <td style={S.tdNum}>{fmtN(r.cgst)}</td>
                        <td style={S.tdNum}>{fmtN(r.sgst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {gstr1.b2b.length === 0 && gstr1.hsnSummary.length === 0 && (
            <div style={{ ...S.card, textAlign: "center", padding: 60, color: "var(--text-ghost)" }}>No invoices found for {MONTHS[month - 1]} {year}</div>
          )}
        </div>
      )}

      {/* ── ITC Ledger ── */}
      {!loading && tab === "itc" && itc && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Input Tax Credit Ledger — {itc.entries?.length || 0} entries</span>
              <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 700, color: "#10b981" }}>Total ITC: {fmt(itc.total)}</span>
            </div>
            <button onClick={() => exportCSV(itc.entries || [], `itc-ledger-${month}-${year}.csv`, ["Invoice No","Date","Vendor","GSTIN","Taxable","IGST","CGST","SGST","Total ITC"], ["invoiceNumber","invoiceDate","vendorName","vendorGSTIN","taxableValue","igst","cgst","sgst","totalITC"])}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-hover)", color: "var(--text-sec)", cursor: "pointer", fontSize: 12 }}>
              <Download size={12} /> Export CSV
            </button>
          </div>
          {itc.entries?.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-ghost)" }}>No purchase invoices for {MONTHS[month - 1]} {year}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Invoice No","Date","Vendor","GSTIN","Taxable","IGST","CGST","SGST","ITC"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {(itc.entries || []).map((r: any, i: number) => (
                    <tr key={i}>
                      <td style={S.td}>{r.invoiceNumber}</td>
                      <td style={S.td}>{new Date(r.invoiceDate).toLocaleDateString("en-IN")}</td>
                      <td style={S.td}>{r.vendorName}</td>
                      <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11 }}>{r.vendorGSTIN || "—"}</td>
                      <td style={S.tdNum}>{fmtN(r.taxableValue)}</td>
                      <td style={S.tdNum}>{fmtN(r.igst)}</td>
                      <td style={S.tdNum}>{fmtN(r.cgst)}</td>
                      <td style={S.tdNum}>{fmtN(r.sgst)}</td>
                      <td style={{ ...S.tdNum, fontWeight: 700, color: "#10b981" }}>{fmtN(r.totalITC)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Annual Summary ── */}
      {!loading && tab === "annual" && annual && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 14, color: "var(--text-sec)" }}>
            Annual GST Summary — {annual.year} &nbsp;|&nbsp; GSTIN: <strong style={{ fontFamily: "monospace" }}>{annual.orgGSTIN || "Not configured"}</strong>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--bg-card)", borderRadius: 12, overflow: "hidden" }}>
              <thead><tr style={{ background: "var(--bg-hover)" }}>
                {["Month","Invoices","Taxable Value","Tax Liability","ITC","Net Payable"].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {annual.months.map((r: any) => (
                  <tr key={r.month}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{r.label} {annual.year}</td>
                    <td style={S.tdNum}>{r.invoiceCount}</td>
                    <td style={S.tdNum}>{fmtN(r.outwardTaxable)}</td>
                    <td style={S.tdNum}>{fmtN(r.outwardTax)}</td>
                    <td style={{ ...S.tdNum, color: "#10b981" }}>{fmtN(r.itc)}</td>
                    <td style={{ ...S.tdNum, fontWeight: 700, color: r.netPayable > 0 ? "#ef4444" : "var(--text-ghost)" }}>
                      {fmtN(r.netPayable)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "var(--bg-hover)", fontWeight: 700 }}>
                  <td style={{ ...S.td, fontWeight: 700 }}>TOTAL</td>
                  <td style={S.tdNum}>{annual.months.reduce((s: number, r: any) => s + r.invoiceCount, 0)}</td>
                  <td style={S.tdNum}>{fmtN(annual.months.reduce((s: number, r: any) => s + r.outwardTaxable, 0))}</td>
                  <td style={S.tdNum}>{fmtN(annual.months.reduce((s: number, r: any) => s + r.outwardTax, 0))}</td>
                  <td style={{ ...S.tdNum, color: "#10b981" }}>{fmtN(annual.months.reduce((s: number, r: any) => s + r.itc, 0))}</td>
                  <td style={{ ...S.tdNum, color: "#ef4444" }}>{fmtN(annual.months.reduce((s: number, r: any) => s + r.netPayable, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button onClick={() => exportCSV(annual.months, `gst-annual-${annual.year}.csv`, ["Month","Invoices","Taxable","Tax","ITC","Net Payable"], ["label","invoiceCount","outwardTaxable","outwardTax","itc","netPayable"])}
            style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-sec)", cursor: "pointer", fontSize: 13 }}>
            <Download size={13} /> Export Annual CSV
          </button>
        </div>
      )}
    </div>
  );
}
