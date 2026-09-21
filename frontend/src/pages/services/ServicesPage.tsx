import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Briefcase, Plus, X, Book, MessageSquare, FileText, Grid } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
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
};

const CONTRACT_STATUS_COLOR: Record<string, string> = { ACTIVE: "#10b981", DRAFT: "#6b7280", PAUSED: "#f59e0b", EXPIRED: "#ef4444", CANCELLED: "#6b7280" };
type TabType = "catalog" | "contracts" | "kb" | "chat";

export default function ServicesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabType>("catalog");
  const [catalog, setCatalog] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newMsg, setNewMsg] = useState("");

  const [catalogForm, setCatalogForm] = useState({ name: "", description: "", category: "", unitPrice: "", unit: "service", deliveryDays: "" });
  const [contractForm, setContractForm] = useState({ title: "", description: "", value: "", billingCycle: "MONTHLY", autoRenew: false });
  const [kbForm, setKBForm] = useState({ title: "", content: "", category: "", isPublic: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, conRes, kbRes, msgRes] = await Promise.all([
        api.get("/services/catalog"),
        api.get("/services/contracts"),
        api.get("/services/kb"),
        api.get("/services/messages?limit=50"),
      ]);
      setCatalog(catRes.data.data || []);
      setContracts(conRes.data.data || []);
      setArticles(kbRes.data.data || []);
      setMessages(msgRes.data.data || []);
      setError("");
    } catch (e: any) { setError(e?.response?.data?.message || "Failed to load data. Please check your connection."); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveCatalog = async () => {
    if (!catalogForm.name.trim() || !catalogForm.unitPrice) return;
    setSaving(true);
    try {
      await api.post("/services/catalog", { ...catalogForm, unitPrice: Number(catalogForm.unitPrice), deliveryDays: catalogForm.deliveryDays ? Number(catalogForm.deliveryDays) : null });
      setShowModal(false);
      setCatalogForm({ name: "", description: "", category: "", unitPrice: "", unit: "service", deliveryDays: "" });
      load();
    } catch {}
    setSaving(false);
  };

  const saveContract = async () => {
    if (!contractForm.title.trim()) return;
    setSaving(true);
    try {
      await api.post("/services/contracts", { ...contractForm, value: contractForm.value ? Number(contractForm.value) : null });
      setShowModal(false);
      setContractForm({ title: "", description: "", value: "", billingCycle: "MONTHLY", autoRenew: false });
      load();
    } catch {}
    setSaving(false);
  };

  const saveKB = async () => {
    if (!kbForm.title.trim() || !kbForm.content.trim()) return;
    setSaving(true);
    try {
      await api.post("/services/kb", kbForm);
      setShowModal(false);
      setKBForm({ title: "", content: "", category: "", isPublic: false });
      load();
    } catch {}
    setSaving(false);
  };

  const sendMsg = async () => {
    if (!newMsg.trim()) return;
    try { await api.post("/services/messages", { message: newMsg }); setNewMsg(""); load(); } catch {}
  };

  const TabBtn = ({ id, label, icon: Icon }: { id: TabType; label: string; icon: any }) => (
    <button onClick={() => setTab(id)} style={{ padding: "9px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 400, color: tab === id ? "var(--text-primary)" : "var(--text-ghost)", borderBottom: tab === id ? "2px solid #818cf8" : "2px solid transparent", marginBottom: -1, display: "flex", alignItems: "center", gap: 6 }}>
      <Icon size={13} />{label}
    </button>
  );

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}><Briefcase size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />{ t('page_services') }</h1>
          <p style={S.subtitle}>Service catalog, recurring contracts, knowledge base, and team chat</p>
        </div>
        {tab !== "chat" && <button style={S.btn} onClick={() => setShowModal(true)}><Plus size={15} />
          {tab === "catalog" ? "Add Service" : tab === "contracts" ? "New Contract" : "New Article"}
        </button>}
      </div>

      {error && (
        <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" }}>✕</button>
        </div>
      )}

      <div style={S.tabs}>
        <TabBtn id="catalog" label="Service Catalog" icon={Grid} />
        <TabBtn id="contracts" label="Contracts" icon={FileText} />
        <TabBtn id="kb" label="Knowledge Base" icon={Book} />
        <TabBtn id="chat" label="Team Chat" icon={MessageSquare} />
      </div>

      {tab === "catalog" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {loading ? <div style={{ color: "var(--text-ghost)" }}>Loading...</div>
          : catalog.length === 0 ? <div style={{ ...S.card, textAlign: "center", color: "var(--text-ghost)", padding: 40 }}>No services in catalog</div>
          : catalog.map((item: any) => (
            <div key={item.id} style={S.card}>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14, marginBottom: 4 }}>{item.name}</div>
              {item.category && <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 600, marginBottom: 8 }}>{item.category}</div>}
              {item.description && <div style={{ fontSize: 12, color: "var(--text-ghost)", marginBottom: 12, lineHeight: 1.5 }}>{item.description}</div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "#10b981", fontSize: 16 }}>₹{item.unitPrice.toLocaleString("en-IN")}</span>
                <span style={{ fontSize: 11, color: "var(--text-ghost)" }}>per {item.unit}</span>
              </div>
              {item.deliveryDays && <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-ghost)" }}>Delivery: {item.deliveryDays} days</div>}
            </div>
          ))}
        </div>
      )}

      {tab === "contracts" && (
        <div style={S.card}>
          <div className="overflow-x-auto">
            <table style={S.table}>
            <thead><tr>{["Contract", "Billing", "Value", "Status", "Auto Renew"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} style={{ ...S.td, textAlign: "center", padding: 32 }}>Loading...</td></tr>
              : contracts.length === 0 ? <tr><td colSpan={5} style={{ ...S.td, textAlign: "center", padding: 32 }}>No contracts yet</td></tr>
              : contracts.map((c: any) => (
                <tr key={c.id}>
                  <td style={S.td}><div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.title}</div><div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{c.description}</div></td>
                  <td style={S.td}>{c.billingCycle}</td>
                  <td style={S.td}>{c.value ? `₹${Number(c.value).toLocaleString("en-IN")}` : "—"}</td>
                  <td style={S.td}><span style={{ background: (CONTRACT_STATUS_COLOR[c.status] ?? "#6b7280") + "22", color: CONTRACT_STATUS_COLOR[c.status] ?? "#6b7280", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{c.status}</span></td>
                  <td style={S.td}><span style={{ color: c.autoRenew ? "#10b981" : "#6b7280", fontWeight: 600 }}>{c.autoRenew ? "Yes" : "No"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === "kb" && (
        <div style={{ display: "grid", gap: 12 }}>
          {loading ? <div style={{ color: "var(--text-ghost)" }}>Loading...</div>
          : articles.length === 0 ? <div style={{ ...S.card, textAlign: "center", color: "var(--text-ghost)", padding: 40 }}>No articles yet</div>
          : articles.map((a: any) => (
            <div key={a.id} style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{a.title}</div>
                  {a.category && <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 600, marginTop: 2 }}>{a.category}</div>}
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-ghost)" }}>
                  <span>👁 {a.views}</span>
                  <span>👍 {a.helpful}</span>
                  {a.isPublic && <span style={{ color: "#10b981", fontWeight: 600 }}>PUBLIC</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "chat" && (
        <div style={{ ...S.card, display: "flex", flexDirection: "column", height: 500 }}>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "4px 0" }}>
            {messages.length === 0 ? <div style={{ textAlign: "center", color: "var(--text-ghost)", padding: 40 }}>No messages yet</div>
            : messages.map((m: any) => (
              <div key={m.id} style={{ background: "var(--bg-hover)", borderRadius: 10, padding: "10px 14px", maxWidth: "70%", alignSelf: "flex-start" }}>
                <div style={{ fontSize: 12, color: "var(--text-ghost)", marginBottom: 4 }}>{m.senderId.slice(0, 8)}... · {new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{m.message}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <input style={{ ...S.input, flex: 1 }} placeholder="Type a message..." value={newMsg} onChange={e => setNewMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()} />
            <button onClick={sendMsg} style={S.btn}>Send</button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <div style={S.modal} onClick={() => setShowModal(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                {tab === "catalog" ? "Add Service" : tab === "contracts" ? "New Contract" : "New Article"}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            {tab === "catalog" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="grid-r2">
                  <div><label style={S.label}>Name *</label><input style={S.input} value={catalogForm.name} onChange={e => setCatalogForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div><label style={S.label}>Category</label><input style={S.input} value={catalogForm.category} onChange={e => setCatalogForm(p => ({ ...p, category: e.target.value }))} /></div>
                </div>
                <div><label style={S.label}>Description</label><textarea style={S.textarea} value={catalogForm.description} onChange={e => setCatalogForm(p => ({ ...p, description: e.target.value }))} /></div>
                <div className="grid-r2">
                  <div><label style={S.label}>Unit Price (₹) *</label><input type="number" style={S.input} value={catalogForm.unitPrice} onChange={e => setCatalogForm(p => ({ ...p, unitPrice: e.target.value }))} /></div>
                  <div><label style={S.label}>Unit</label><input style={S.input} value={catalogForm.unit} onChange={e => setCatalogForm(p => ({ ...p, unit: e.target.value }))} /></div>
                </div>
                <button onClick={saveCatalog} disabled={saving} style={{ ...S.btn, justifyContent: "center" }}>{saving ? "Saving..." : "Add Service"}</button>
              </div>
            )}

            {tab === "contracts" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><label style={S.label}>Contract Title *</label><input style={S.input} value={contractForm.title} onChange={e => setContractForm(p => ({ ...p, title: e.target.value }))} /></div>
                <div><label style={S.label}>Description</label><textarea style={S.textarea} value={contractForm.description} onChange={e => setContractForm(p => ({ ...p, description: e.target.value }))} /></div>
                <div className="grid-r2">
                  <div><label style={S.label}>Value (₹)</label><input type="number" style={S.input} value={contractForm.value} onChange={e => setContractForm(p => ({ ...p, value: e.target.value }))} /></div>
                  <div><label style={S.label}>Billing Cycle</label>
                    <select style={S.select} value={contractForm.billingCycle} onChange={e => setContractForm(p => ({ ...p, billingCycle: e.target.value }))}>
                      {["MONTHLY","QUARTERLY","HALF_YEARLY","YEARLY","ONE_TIME"].map(s => <option key={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" id="autoRenew" checked={contractForm.autoRenew} onChange={e => setContractForm(p => ({ ...p, autoRenew: e.target.checked }))} />
                  <label htmlFor="autoRenew" style={{ fontSize: 13, color: "var(--text-sec)", cursor: "pointer" }}>Auto-renew</label>
                </div>
                <button onClick={saveContract} disabled={saving} style={{ ...S.btn, justifyContent: "center" }}>{saving ? "Saving..." : "Create Contract"}</button>
              </div>
            )}

            {tab === "kb" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="grid-r2">
                  <div><label style={S.label}>Title *</label><input style={S.input} value={kbForm.title} onChange={e => setKBForm(p => ({ ...p, title: e.target.value }))} /></div>
                  <div><label style={S.label}>Category</label><input style={S.input} value={kbForm.category} onChange={e => setKBForm(p => ({ ...p, category: e.target.value }))} /></div>
                </div>
                <div><label style={S.label}>Content *</label><textarea style={{ ...S.textarea, minHeight: 120 }} value={kbForm.content} onChange={e => setKBForm(p => ({ ...p, content: e.target.value }))} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" id="isPublic" checked={kbForm.isPublic} onChange={e => setKBForm(p => ({ ...p, isPublic: e.target.checked }))} />
                  <label htmlFor="isPublic" style={{ fontSize: 13, color: "var(--text-sec)", cursor: "pointer" }}>Make Public</label>
                </div>
                <button onClick={saveKB} disabled={saving} style={{ ...S.btn, justifyContent: "center" }}>{saving ? "Saving..." : "Publish Article"}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
