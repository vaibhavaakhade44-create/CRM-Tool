import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { TrendingUp, Plus, X, Users, FileText, Bell, CheckCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#10b981,#059669)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  tabs: { display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)" } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalBox: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 520, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" as const },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  textarea: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const, resize: "vertical" as const, minHeight: 80 },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
  g3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 } as React.CSSProperties,
};

const CALL_STATUS_COLORS: Record<string, string> = { ACTIVE: "#10b981", TARGET_HIT: "#6366f1", STOP_LOSS: "#ef4444", EXPIRED: "#6b7280", CANCELLED: "#6b7280" };
type TabType = "calls" | "reports" | "subscriptions" | "kyc" | "alerts";

export default function StockMarketPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabType>("calls");
  const [tradeCalls, setTradeCalls] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [kycRecords, setKYCRecords] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [callForm, setCallForm] = useState({ symbol: "", exchange: "NSE", callType: "BUY", segment: "EQUITY", entryPrice: "", targetPrice: "", stopLoss: "", rationale: "" });
  const [reportForm, setReportForm] = useState({ title: "", symbol: "", reportType: "EQUITY", rating: "", targetPrice: "", summary: "" });
  const [alertForm, setAlertForm] = useState({ symbol: "", alertType: "PRICE", triggerValue: "", message: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tcRes, rpRes, subRes, plRes, kycRes, alRes] = await Promise.all([
        api.get("/stock-market/trade-calls"),
        api.get("/stock-market/research"),
        api.get("/stock-market/subscriptions"),
        api.get("/stock-market/plans"),
        api.get("/stock-market/kyc"),
        api.get("/stock-market/alerts"),
      ]);
      setTradeCalls(tcRes.data.data || []);
      setReports(rpRes.data.data || []);
      setSubscriptions(subRes.data.data || []);
      setPlans(plRes.data.data || []);
      setKYCRecords(kycRes.data.data || []);
      setAlerts(alRes.data.data || []);
      setError("");
    } catch (e: any) { setError(e?.response?.data?.message || "Failed to load data. Please check your connection."); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveTradeCall = async () => {
    if (!callForm.symbol.trim()) return;
    setSaving(true);
    try {
      await api.post("/stock-market/trade-calls", { ...callForm, entryPrice: Number(callForm.entryPrice), targetPrice: callForm.targetPrice ? Number(callForm.targetPrice) : null, stopLoss: callForm.stopLoss ? Number(callForm.stopLoss) : null });
      setShowModal(false);
      setCallForm({ symbol: "", exchange: "NSE", callType: "BUY", segment: "EQUITY", entryPrice: "", targetPrice: "", stopLoss: "", rationale: "" });
      load();
    } catch {}
    setSaving(false);
  };

  const saveReport = async () => {
    if (!reportForm.title.trim()) return;
    setSaving(true);
    try {
      await api.post("/stock-market/research", { ...reportForm, targetPrice: reportForm.targetPrice ? Number(reportForm.targetPrice) : null });
      setShowModal(false);
      setReportForm({ title: "", symbol: "", reportType: "EQUITY", rating: "", targetPrice: "", summary: "" });
      load();
    } catch {}
    setSaving(false);
  };

  const saveAlert = async () => {
    if (!alertForm.symbol.trim() || !alertForm.message.trim()) return;
    setSaving(true);
    try {
      await api.post("/stock-market/alerts", { ...alertForm, triggerValue: alertForm.triggerValue ? Number(alertForm.triggerValue) : null });
      setShowModal(false);
      setAlertForm({ symbol: "", alertType: "PRICE", triggerValue: "", message: "" });
      load();
    } catch {}
    setSaving(false);
  };

  const deleteAlert = async (id: string) => {
    try { await api.delete(`/stock-market/alerts/${id}`); load(); } catch {}
  };

  const TabBtn = ({ id, label, icon: Icon }: { id: TabType; label: string; icon: any }) => (
    <button onClick={() => setTab(id)} style={{ padding: "9px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 400, color: tab === id ? "var(--text-primary)" : "var(--text-ghost)", borderBottom: tab === id ? "2px solid #10b981" : "2px solid transparent", marginBottom: -1, display: "flex", alignItems: "center", gap: 6 }}>
      <Icon size={13} />{label}
    </button>
  );

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}><TrendingUp size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />{ t('page_stock_market') }</h1>
          <p style={S.subtitle}>Trade calls, research reports, client subscriptions, KYC, and market alerts</p>
        </div>
        {tab !== "subscriptions" && tab !== "kyc" && (
          <button style={S.btn} onClick={() => setShowModal(true)}><Plus size={15} />
            {tab === "calls" ? "New Trade Call" : tab === "reports" ? "New Report" : "New Alert"}
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" }}>✕</button>
        </div>
      )}

      {/* SEBI Compliance Disclaimer */}
      <div style={{ background: "#ef444412", border: "1px solid #ef444430", borderRadius: 10, padding: "10px 14px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
        <div style={{ fontSize: 12, color: "var(--text-sec)" }}>
          <strong style={{ color: "#ef4444" }}>SEBI Disclaimer:</strong> Trade calls and research published here are for <strong>internal tracking only</strong> and do not constitute SEBI-registered investment advice. Providing investment recommendations to clients without SEBI Investment Advisor registration (IA Regulations 2013) is a criminal offence. Ensure all client-facing communications carry the required risk disclaimer.
          {" "}<a href="/compliance" style={{ color: "#818cf8", textDecoration: "underline" }}>Configure SEBI settings →</a>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active Calls", value: tradeCalls.filter(c => c.status === "ACTIVE").length, color: "#10b981", icon: TrendingUp },
          { label: "Subscriptions", value: subscriptions.filter(s => s.status === "ACTIVE").length, color: "#818cf8", icon: Users },
          { label: "Research Reports", value: reports.length, color: "#f59e0b", icon: FileText },
          { label: "KYC Verified", value: kycRecords.filter(k => k.isVerified).length, color: "#6366f1", icon: CheckCircle },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 }}>{k.label}</span>
              <k.icon size={15} color={k.color} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={S.tabs}>
        <TabBtn id="calls" label="Trade Calls" icon={TrendingUp} />
        <TabBtn id="reports" label="Research" icon={FileText} />
        <TabBtn id="subscriptions" label="Subscriptions" icon={Users} />
        <TabBtn id="kyc" label="KYC Records" icon={CheckCircle} />
        <TabBtn id="alerts" label="Market Alerts" icon={Bell} />
      </div>

      {tab === "calls" && (
        <div style={{ display: "grid", gap: 12 }}>
          {loading ? <div style={{ color: "var(--text-ghost)" }}>Loading...</div>
          : tradeCalls.length === 0 ? <div style={{ ...S.card, textAlign: "center", color: "var(--text-ghost)", padding: 40 }}>No trade calls yet</div>
          : tradeCalls.map((c: any) => (
            <div key={c.id} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{c.symbol}</span>
                    <span style={{ background: c.callType === "BUY" ? "#10b98122" : "#ef444422", color: c.callType === "BUY" ? "#10b981" : "#ef4444", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{c.callType}</span>
                    <span style={{ fontSize: 11, color: "var(--text-ghost)" }}>{c.exchange} · {c.segment}</span>
                  </div>
                  <div style={{ display: "flex", gap: 20 }}>
                    {c.entryPrice && <div><div style={{ fontSize: 10, color: "var(--text-ghost)" }}>ENTRY</div><div style={{ fontWeight: 700, color: "var(--text-primary)" }}>₹{c.entryPrice}</div></div>}
                    {c.targetPrice && <div><div style={{ fontSize: 10, color: "#10b981" }}>TARGET</div><div style={{ fontWeight: 700, color: "#10b981" }}>₹{c.targetPrice}</div></div>}
                    {c.stopLoss && <div><div style={{ fontSize: 10, color: "#ef4444" }}>STOP LOSS</div><div style={{ fontWeight: 700, color: "#ef4444" }}>₹{c.stopLoss}</div></div>}
                  </div>
                  {c.rationale && <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-ghost)" }}>{c.rationale}</div>}
                </div>
                <span style={{ background: (CALL_STATUS_COLORS[c.status] ?? "#6b7280") + "22", color: CALL_STATUS_COLORS[c.status] ?? "#6b7280", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{c.status.replace("_", " ")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "reports" && (
        <div style={S.card}>
          <div className="overflow-x-auto">
            <table style={S.table}>
            <thead><tr>{["Title", "Symbol", "Type", "Rating", "Target", "Published"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", padding: 32 }}>Loading...</td></tr>
              : reports.length === 0 ? <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", padding: 32 }}>No reports yet</td></tr>
              : reports.map((r: any) => (
                <tr key={r.id}>
                  <td style={S.td}><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.title}</span></td>
                  <td style={S.td}>{r.symbol ?? "—"}</td>
                  <td style={S.td}>{r.reportType}</td>
                  <td style={S.td}>{r.rating ? <span style={{ fontWeight: 700, color: r.rating === "BUY" ? "#10b981" : "#ef4444" }}>{r.rating}</span> : "—"}</td>
                  <td style={S.td}>{r.targetPrice ? `₹${r.targetPrice}` : "—"}</td>
                  <td style={S.td}>{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString("en-IN") : "Draft"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === "subscriptions" && (
        <div style={S.card}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Advisory Plans</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
              {plans.map((p: any) => (
                <div key={p.id} style={{ background: "var(--bg-hover)", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{p.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#10b981", margin: "8px 0" }}>₹{p.price.toLocaleString("en-IN")}<span style={{ fontSize: 11, color: "var(--text-ghost)", fontWeight: 400 }}>/{p.billingCycle.toLowerCase()}</span></div>
                  <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{p._count?.subscriptions ?? 0} subscribers</div>
                </div>
              ))}
              {plans.length === 0 && <div style={{ color: "var(--text-ghost)", fontSize: 13 }}>No plans created</div>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table style={S.table}>
            <thead><tr>{["Party", "Plan", "Amount", "Status", "KYC", "Start Date"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {subscriptions.length === 0 ? <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", padding: 32 }}>No subscriptions yet</td></tr>
              : subscriptions.map((s: any) => (
                <tr key={s.id}>
                  <td style={S.td}>{s.partyId?.slice(0, 10) ?? "—"}</td>
                  <td style={S.td}>{s.plan?.name}</td>
                  <td style={S.td}>₹{Number(s.amount).toLocaleString("en-IN")}</td>
                  <td style={S.td}><span style={{ color: s.status === "ACTIVE" ? "#10b981" : "#6b7280", fontWeight: 600 }}>{s.status}</span></td>
                  <td style={S.td}><span style={{ color: s.kycVerified ? "#10b981" : "#f59e0b", fontWeight: 600 }}>{s.kycVerified ? "Verified" : "Pending"}</span></td>
                  <td style={S.td}>{new Date(s.startDate).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === "kyc" && (
        <div style={S.card}>
          <div className="overflow-x-auto">
            <table style={S.table}>
            <thead><tr>{["Party", "PAN", "Demat Account", "Risk Profile", "Verified"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {kycRecords.length === 0 ? <tr><td colSpan={5} style={{ ...S.td, textAlign: "center", padding: 32 }}>No KYC records</td></tr>
              : kycRecords.map((k: any) => (
                <tr key={k.id}>
                  <td style={S.td}>{k.partyId?.slice(0, 10) ?? "—"}</td>
                  <td style={S.td}>{k.panNumber ?? "—"}</td>
                  <td style={S.td}>{k.dematAccount ?? "—"}</td>
                  <td style={S.td}>{k.riskProfile ?? "—"}</td>
                  <td style={S.td}><span style={{ color: k.isVerified ? "#10b981" : "#f59e0b", fontWeight: 700 }}>{k.isVerified ? "✓ Verified" : "Pending"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === "alerts" && (
        <div style={S.card}>
          <div className="overflow-x-auto">
            <table style={S.table}>
            <thead><tr>{["Symbol", "Type", "Trigger", "Message", "Active", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {alerts.length === 0 ? <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", padding: 32 }}>No alerts set</td></tr>
              : alerts.map((a: any) => (
                <tr key={a.id}>
                  <td style={S.td}><span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{a.symbol}</span></td>
                  <td style={S.td}>{a.alertType}</td>
                  <td style={S.td}>{a.triggerValue ? `₹${a.triggerValue}` : "—"}</td>
                  <td style={S.td}>{a.message}</td>
                  <td style={S.td}><span style={{ color: a.isActive ? "#10b981" : "#6b7280", fontWeight: 600 }}>{a.isActive ? "Active" : "Off"}</span></td>
                  <td style={S.td}><button onClick={() => deleteAlert(a.id)} style={{ background: "#ef444422", color: "#ef4444", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <div style={S.modal} onClick={() => setShowModal(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                {tab === "calls" ? "New Trade Call" : tab === "reports" ? "New Research Report" : "New Market Alert"}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            {tab === "calls" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="grid-r3">
                  <div><label style={S.label}>Symbol *</label><input style={S.input} placeholder="NIFTY50" value={callForm.symbol} onChange={e => setCallForm(p => ({ ...p, symbol: e.target.value }))} /></div>
                  <div><label style={S.label}>Exchange</label>
                    <select style={S.select} value={callForm.exchange} onChange={e => setCallForm(p => ({ ...p, exchange: e.target.value }))}>
                      {["NSE","BSE","MCX","NFO","CDS"].map(x => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                  <div><label style={S.label}>Type</label>
                    <select style={S.select} value={callForm.callType} onChange={e => setCallForm(p => ({ ...p, callType: e.target.value }))}>
                      {["BUY","SELL","SHORT","COVER"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid-r3">
                  <div><label style={S.label}>Entry ₹</label><input type="number" style={S.input} value={callForm.entryPrice} onChange={e => setCallForm(p => ({ ...p, entryPrice: e.target.value }))} /></div>
                  <div><label style={S.label}>Target ₹</label><input type="number" style={S.input} value={callForm.targetPrice} onChange={e => setCallForm(p => ({ ...p, targetPrice: e.target.value }))} /></div>
                  <div><label style={S.label}>Stop Loss ₹</label><input type="number" style={S.input} value={callForm.stopLoss} onChange={e => setCallForm(p => ({ ...p, stopLoss: e.target.value }))} /></div>
                </div>
                <div><label style={S.label}>Rationale</label><textarea style={S.textarea} value={callForm.rationale} onChange={e => setCallForm(p => ({ ...p, rationale: e.target.value }))} /></div>
                <button onClick={saveTradeCall} disabled={saving} style={{ ...S.btn, justifyContent: "center" }}>{saving ? "Saving..." : "Publish Call"}</button>
              </div>
            )}

            {tab === "reports" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label style={S.label}>Report Title *</label><input style={S.input} value={reportForm.title} onChange={e => setReportForm(p => ({ ...p, title: e.target.value }))} /></div>
                <div className="grid-r2">
                  <div><label style={S.label}>Symbol</label><input style={S.input} placeholder="RELIANCE" value={reportForm.symbol} onChange={e => setReportForm(p => ({ ...p, symbol: e.target.value }))} /></div>
                  <div><label style={S.label}>Rating</label>
                    <select style={S.select} value={reportForm.rating} onChange={e => setReportForm(p => ({ ...p, rating: e.target.value }))}>
                      <option value="">None</option>
                      {["BUY","SELL","HOLD","NEUTRAL","ACCUMULATE"].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div><label style={S.label}>Summary</label><textarea style={S.textarea} value={reportForm.summary} onChange={e => setReportForm(p => ({ ...p, summary: e.target.value }))} /></div>
                <button onClick={saveReport} disabled={saving} style={{ ...S.btn, justifyContent: "center" }}>{saving ? "Saving..." : "Save Report"}</button>
              </div>
            )}

            {tab === "alerts" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="grid-r2">
                  <div><label style={S.label}>Symbol *</label><input style={S.input} placeholder="NIFTY" value={alertForm.symbol} onChange={e => setAlertForm(p => ({ ...p, symbol: e.target.value }))} /></div>
                  <div><label style={S.label}>Alert Type</label>
                    <select style={S.select} value={alertForm.alertType} onChange={e => setAlertForm(p => ({ ...p, alertType: e.target.value }))}>
                      {["PRICE","VOLUME","NEWS","TECHNICAL"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div><label style={S.label}>Trigger Value</label><input type="number" style={S.input} placeholder="e.g. 24000" value={alertForm.triggerValue} onChange={e => setAlertForm(p => ({ ...p, triggerValue: e.target.value }))} /></div>
                <div><label style={S.label}>Alert Message *</label><textarea style={S.textarea} value={alertForm.message} onChange={e => setAlertForm(p => ({ ...p, message: e.target.value }))} /></div>
                <button onClick={saveAlert} disabled={saving} style={{ ...S.btn, justifyContent: "center" }}>{saving ? "Saving..." : "Create Alert"}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
