import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Phone, Plus, X, PhoneCall, PhoneOff, BarChart2, List, Shield, Megaphone } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  tabs: { display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)" } as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const },
  th: { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalBox: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 480, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" as const },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  textarea: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const, resize: "vertical" as const, minHeight: 80 },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
  fltSelect: { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const },
};

const OUTCOME_COLORS: Record<string, string> = {
  CONNECTED: "#10b981", NO_ANSWER: "#6b7280", BUSY: "#f59e0b",
  INTERESTED: "#818cf8", NOT_INTERESTED: "#ef4444", CONVERTED: "#6366f1",
};

type TabType = "calls" | "scripts" | "dnc" | "campaigns";

export default function TelecallingPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabType>("calls");
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [callStats, setCallStats] = useState<any>(null);
  const [scripts, setScripts] = useState<any[]>([]);
  const [dncList, setDncList] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Call log form
  const [callForm, setCallForm] = useState({ phone: "", outcome: "CONNECTED", duration: "", notes: "" });
  const [scriptForm, setScriptForm] = useState({ name: "", category: "", content: "", objections: "" });
  const [dncPhone, setDncPhone] = useState("");
  const [campaignForm, setCampaignForm] = useState({ name: "", description: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes, statsRes, dRes, campRes] = await Promise.all([
        api.get("/telecalling/calls?limit=50"),
        api.get("/telecalling/scripts"),
        api.get("/telecalling/calls/stats"),
        api.get("/telecalling/dnc"),
        api.get("/telecalling/campaigns"),
      ]);
      setCallLogs(cRes.data.data?.logs || []);
      setScripts(sRes.data.data || []);
      setCallStats(statsRes.data.data);
      setDncList(dRes.data.data || []);
      setCampaigns(campRes.data.data || []);
      setError("");
    } catch (e: any) { setError(e?.response?.data?.message || "Failed to load data. Please check your connection."); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveCall = async () => {
    if (!callForm.phone.trim()) return;
    setSaving(true);
    try {
      await api.post("/telecalling/calls", { ...callForm, duration: callForm.duration ? Number(callForm.duration) : null });
      setShowModal(false);
      setCallForm({ phone: "", outcome: "CONNECTED", duration: "", notes: "" });
      load();
    } catch {}
    setSaving(false);
  };

  const saveScript = async () => {
    if (!scriptForm.name.trim() || !scriptForm.content.trim()) return;
    setSaving(true);
    try {
      await api.post("/telecalling/scripts", scriptForm);
      setShowModal(false);
      setScriptForm({ name: "", category: "", content: "", objections: "" });
      load();
    } catch {}
    setSaving(false);
  };

  const addDNC = async () => {
    if (!dncPhone.trim()) return;
    try { await api.post("/telecalling/dnc", { phone: dncPhone }); setDncPhone(""); load(); } catch {}
  };

  const removeDNC = async (id: string) => {
    try { await api.delete(`/telecalling/dnc/${id}`); load(); } catch {}
  };

  const saveCampaign = async () => {
    if (!campaignForm.name.trim()) return;
    setSaving(true);
    try {
      await api.post("/telecalling/campaigns", campaignForm);
      setShowModal(false);
      setCampaignForm({ name: "", description: "" });
      load();
    } catch {}
    setSaving(false);
  };

  const TabBtn = ({ id, label, icon: Icon }: { id: TabType; label: string; icon: any }) => (
    <button onClick={() => setTab(id)} style={{ padding: "9px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 400, color: tab === id ? "var(--text-primary)" : "var(--text-ghost)", borderBottom: tab === id ? "2px solid #818cf8" : "2px solid transparent", marginBottom: -1, display: "flex", alignItems: "center", gap: 6 }}>
      <Icon size={13} />{label}
    </button>
  );

  const totalByOutcome = (outcome: string) => callStats?.byOutcome?.find((o: any) => o.outcome === outcome)?._count?.id ?? 0;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}><Phone size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Tele-calling Center</h1>
          <p style={S.subtitle}>Manage calls, scripts, DNC list, and dialer campaigns</p>
        </div>
        <button style={S.btn} onClick={() => setShowModal(true)}><Plus size={15} />
          {tab === "calls" ? "Log Call" : tab === "scripts" ? "Add Script" : tab === "campaigns" ? "New Campaign" : "Add to DNC"}
        </button>
      </div>
      {error && (
        <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" }}>✕</button>
        </div>
      )}

      {/* TRAI Compliance Banner */}
      <div style={{ background: "#f59e0b12", border: "1px solid #f59e0b30", borderRadius: 10, padding: "10px 14px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Shield size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: "#f59e0b" }}>
          <strong>TRAI Compliance:</strong> Outbound commercial calls are permitted only between <strong>9:00 AM – 9:00 PM IST</strong>. Always scrub numbers against the NDNC registry before dialling. Calls to DNC-registered numbers attract ₹25,000+ penalty per complaint. Register SMS headers on TRAI DLT platform before sending bulk messages.
          {" "}<a href="/compliance" style={{ color: "#818cf8", textDecoration: "underline" }}>Manage compliance settings →</a>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Calls", value: callStats?.total ?? 0, color: "#818cf8", icon: PhoneCall },
          { label: "Connected", value: totalByOutcome("CONNECTED"), color: "#10b981", icon: Phone },
          { label: "No Answer", value: totalByOutcome("NO_ANSWER"), color: "#6b7280", icon: PhoneOff },
          { label: "Converted", value: totalByOutcome("CONVERTED"), color: "#6366f1", icon: BarChart2 },
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
        <TabBtn id="calls" label="Call Logs" icon={Phone} />
        <TabBtn id="scripts" label="Call Scripts" icon={List} />
        <TabBtn id="dnc" label="DNC List" icon={Shield} />
        <TabBtn id="campaigns" label="Campaigns" icon={Megaphone} />
      </div>

      {tab === "calls" && (
        <div style={S.card}>
          <div className="overflow-x-auto">
            <table style={S.table}>
            <thead><tr>{["Phone", "Outcome", "Duration", "Notes", "Called At"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} style={{ ...S.td, textAlign: "center", padding: 32 }}>Loading...</td></tr>
              : callLogs.length === 0 ? <tr><td colSpan={5} style={{ ...S.td, textAlign: "center", padding: 32 }}>No calls logged yet</td></tr>
              : callLogs.map((c: any) => (
                <tr key={c.id}>
                  <td style={S.td}><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.phone}</span></td>
                  <td style={S.td}>
                    {c.outcome && <span style={{ background: (OUTCOME_COLORS[c.outcome] ?? "#6b7280") + "22", color: OUTCOME_COLORS[c.outcome] ?? "#6b7280", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{c.outcome.replace("_", " ")}</span>}
                  </td>
                  <td style={S.td}>{c.duration ? `${c.duration}s` : "—"}</td>
                  <td style={S.td}>{c.notes ?? "—"}</td>
                  <td style={S.td}>{new Date(c.calledAt).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === "scripts" && (
        <div style={{ display: "grid", gap: 16 }}>
          {loading ? <div style={{ textAlign: "center", color: "var(--text-ghost)", padding: 40 }}>Loading...</div>
          : scripts.length === 0 ? <div style={{ ...S.card, textAlign: "center", color: "var(--text-ghost)", padding: 40 }}>No scripts yet</div>
          : scripts.map((s: any) => (
            <div key={s.id} style={S.card}>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 15, marginBottom: 8 }}>{s.name}
                {s.category && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-ghost)", fontWeight: 400 }}>• {s.category}</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-sec)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{s.content}</div>
              {s.objections && <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--bg-hover)", borderRadius: 8, fontSize: 12, color: "var(--text-ghost)" }}><strong>Objection Handling:</strong> {s.objections}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === "dnc" && (
        <div style={S.card}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input style={{ ...S.input, maxWidth: 300 }} placeholder="Phone number to block" value={dncPhone} onChange={e => setDncPhone(e.target.value)} />
            <button style={S.btn} onClick={addDNC}>Add to DNC</button>
          </div>
          <div className="overflow-x-auto">
            <table style={S.table}>
            <thead><tr>{["Phone", "Reason", "Added On", "Remove"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {dncList.length === 0 ? <tr><td colSpan={4} style={{ ...S.td, textAlign: "center", padding: 32 }}>DNC list is empty</td></tr>
              : dncList.map((d: any) => (
                <tr key={d.id}>
                  <td style={S.td}>{d.phone}</td>
                  <td style={S.td}>{d.reason ?? "—"}</td>
                  <td style={S.td}>{new Date(d.createdAt).toLocaleDateString("en-IN")}</td>
                  <td style={S.td}><button onClick={() => removeDNC(d.id)} style={{ background: "#ef444422", color: "#ef4444", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === "campaigns" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {campaigns.map((c: any) => (
            <div key={c.id} style={S.card}>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14, marginBottom: 8 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-ghost)", marginBottom: 12 }}>{c.description ?? "No description"}</div>
              <div className="grid-r2" style={{ gap: 8 }}>
                {[{ label: "Target", val: c.targetCount }, { label: "Dialed", val: c.dialedCount }, { label: "Connected", val: c.connectedCount }, { label: "Converted", val: c.convertedCount }].map(m => (
                  <div key={m.label} style={{ background: "var(--bg-hover)", borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ fontSize: 10, color: "var(--text-ghost)", fontWeight: 600, textTransform: "uppercase" }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{m.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, display: "inline-block", background: "#818cf822", color: "#818cf8", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{c.status}</div>
            </div>
          ))}
          {campaigns.length === 0 && <div style={{ ...S.card, textAlign: "center", color: "var(--text-ghost)", padding: 40 }}>No campaigns yet</div>}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <div style={S.modal} onClick={() => setShowModal(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                {tab === "calls" ? "Log Call" : tab === "scripts" ? "New Script" : "New Campaign"}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            {tab === "calls" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label style={S.label}>Phone *</label><input style={S.input} value={callForm.phone} onChange={e => setCallForm(p => ({ ...p, phone: e.target.value }))} /></div>
                <div className="grid-r2">
                  <div><label style={S.label}>Outcome</label>
                    <select style={S.select} value={callForm.outcome} onChange={e => setCallForm(p => ({ ...p, outcome: e.target.value }))}>
                      {["CONNECTED","NO_ANSWER","BUSY","VOICEMAIL","WRONG_NUMBER","CALLBACK_REQUESTED","INTERESTED","NOT_INTERESTED","CONVERTED"].map(s => <option key={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </div>
                  <div><label style={S.label}>Duration (secs)</label><input type="number" style={S.input} value={callForm.duration} onChange={e => setCallForm(p => ({ ...p, duration: e.target.value }))} /></div>
                </div>
                <div><label style={S.label}>Notes</label><textarea style={S.textarea} value={callForm.notes} onChange={e => setCallForm(p => ({ ...p, notes: e.target.value }))} /></div>
                <button onClick={saveCall} disabled={saving} style={{ ...S.btn, justifyContent: "center" }}>{saving ? "Saving..." : "Log Call"}</button>
              </div>
            )}

            {tab === "scripts" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="grid-r2">
                  <div><label style={S.label}>Script Name *</label><input style={S.input} value={scriptForm.name} onChange={e => setScriptForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div><label style={S.label}>Category</label><input style={S.input} value={scriptForm.category} onChange={e => setScriptForm(p => ({ ...p, category: e.target.value }))} /></div>
                </div>
                <div><label style={S.label}>Script Content *</label><textarea style={{ ...S.textarea, minHeight: 120 }} value={scriptForm.content} onChange={e => setScriptForm(p => ({ ...p, content: e.target.value }))} /></div>
                <div><label style={S.label}>Objection Handling</label><textarea style={S.textarea} value={scriptForm.objections} onChange={e => setScriptForm(p => ({ ...p, objections: e.target.value }))} /></div>
                <button onClick={saveScript} disabled={saving} style={{ ...S.btn, justifyContent: "center" }}>{saving ? "Saving..." : "Save Script"}</button>
              </div>
            )}

            {tab === "campaigns" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label style={S.label}>Campaign Name *</label><input style={S.input} value={campaignForm.name} onChange={e => setCampaignForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div><label style={S.label}>Description</label><textarea style={S.textarea} value={campaignForm.description} onChange={e => setCampaignForm(p => ({ ...p, description: e.target.value }))} /></div>
                <button onClick={saveCampaign} disabled={saving} style={{ ...S.btn, justifyContent: "center" }}>{saving ? "Saving..." : "Create Campaign"}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
