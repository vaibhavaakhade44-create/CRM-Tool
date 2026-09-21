import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Calendar, Phone, Mail, MessageSquare, Users, Plus, X, Search, Clock, CheckCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  kpi: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  kpiValue: { fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "4px 0 0" } as React.CSSProperties,
  kpiLabel: { fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
};

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  CALL:     { icon: Phone,         color: "#6366f1", label: "Call" },
  EMAIL:    { icon: Mail,          color: "#818cf8", label: "Email" },
  MEETING:  { icon: Users,         color: "#10b981", label: "Meeting" },
  NOTE:     { icon: MessageSquare, color: "#f59e0b", label: "Note" },
  WHATSAPP: { icon: MessageSquare, color: "#25d366", label: "WhatsApp" },
};

interface Activity {
  id: string; type: string; subject?: string; description: string; outcome?: string;
  followUpDate?: string; createdAt: string;
  party?: { id: string; name: string } | null;
  createdBy?: { name: string; email: string } | null;
}
interface Party { id: string; name: string; }

const emptyForm = { type: "NOTE", partyId: "", subject: "", description: "", outcome: "", followUpDate: "" };

export default function ActivitiesPage() {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...emptyForm });
  const [tab, setTab] = useState<"all" | "upcoming">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, pRes] = await Promise.all([
        api.get("/parties/communications?limit=300"),
        api.get("/parties?limit=300"),
      ]);
      setActivities(aRes.data.data?.communications || aRes.data.data || []);
      setParties(pRes.data.data?.parties || pRes.data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.partyId || !form.description) {
      setError("Party and Description are required"); return;
    }
    setSaving(true); setError("");
    try {
      await api.post(`/parties/${form.partyId}/communications`, {
        type: form.type,
        subject: form.subject || undefined,
        description: form.description,
        outcome: form.outcome || undefined,
        followUpDate: form.followUpDate || undefined,
      });
      setShowModal(false);
      setForm({ ...emptyForm });
      load();
    } catch (e: any) { setError(e?.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const now = new Date();
  const upcoming = activities.filter(a => a.followUpDate && new Date(a.followUpDate) >= now);
  const overdue = activities.filter(a => a.followUpDate && new Date(a.followUpDate) < now);

  const displayed = tab === "upcoming"
    ? [...overdue.sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime()),
      ...upcoming.sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime())]
    : activities.filter(a =>
        (!typeFilter || a.type === typeFilter) &&
        (!search || (a.description + (a.subject || "") + (a.party?.name || "")).toLowerCase().includes(search.toLowerCase()))
      );

  return (
    <div className="page-pad">
      <div className="page-hdr">
        <div>
          <h1 style={S.title}>{ t('page_activities') }</h1>
          <p style={S.subtitle}>Track calls, meetings, emails, notes and scheduled follow-ups</p>
        </div>
        <button style={S.btn} onClick={() => { setForm({ ...emptyForm }); setError(""); setShowModal(true); }}>
          <Plus size={15} /> Log Activity
        </button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        {[
          { label: "Total Activities", value: activities.length, color: "#6366f1" },
          { label: "Follow-ups Due", value: upcoming.length, color: "#f59e0b" },
          { label: "Overdue", value: overdue.length, color: "#ef4444" },
          { label: "This Month", value: activities.filter(a => new Date(a.createdAt).getMonth() === now.getMonth()).length, color: "#10b981" },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <span style={S.kpiLabel}>{k.label}</span>
            <div style={{ ...S.kpiValue, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["all", "upcoming"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 14px", borderRadius: 8, border: `1px solid ${tab === t ? "#6366f1" : "var(--border)"}`,
            background: tab === t ? "#6366f120" : "transparent", color: tab === t ? "#818CF8" : "var(--text-ghost)",
            cursor: "pointer", fontSize: 12, fontWeight: 600,
          }}>
            {t === "all" ? "All Activities" : `Follow-ups (${upcoming.length + overdue.length})`}
          </button>
        ))}
        {tab === "all" && Object.entries(TYPE_META).map(([key, meta]) => (
          <button key={key} onClick={() => setTypeFilter(typeFilter === key ? "" : key)} style={{
            padding: "5px 12px", borderRadius: 8, border: `1px solid ${typeFilter === key ? meta.color : meta.color + "40"}`,
            background: typeFilter === key ? meta.color + "25" : "transparent", color: meta.color,
            cursor: "pointer", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 5,
          }}>
            <meta.icon size={12} /> {meta.label}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab === "all" && (
        <div style={{ position: "relative", maxWidth: 360, marginBottom: 16 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
          <input style={{ ...S.input, paddingLeft: 34 }} placeholder="Search activities..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {/* Activity Feed */}
      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading activities...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {displayed.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", padding: 48, color: "var(--text-ghost)" }}>
              <Calendar size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-sec)" }}>
                {tab === "upcoming" ? "No follow-ups scheduled" : "No activities logged yet"}
              </p>
              <p style={{ fontSize: 13, marginTop: 6 }}>Click "Log Activity" to start tracking interactions</p>
            </div>
          ) : (
            displayed.map((a, i) => {
              const meta = TYPE_META[a.type] || TYPE_META.NOTE;
              const Icon = meta.icon;
              const isOverdue = a.followUpDate && new Date(a.followUpDate) < now;
              const isDue = a.followUpDate && new Date(a.followUpDate) >= now && new Date(a.followUpDate) < new Date(Date.now() + 24*3600*1000);
              return (
                <div key={a.id} style={{ display: "flex", gap: 0 }}>
                  {/* Timeline */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 48, flexShrink: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: meta.color + "20", border: `2px solid ${meta.color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
                      <Icon size={15} color={meta.color} />
                    </div>
                    {i < displayed.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--bg-hover)", minHeight: 16, marginTop: 4 }} />}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: 20, paddingLeft: 12 }}>
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: meta.color + "20", color: meta.color }}>{meta.label}</span>
                          {a.party && <span style={{ fontSize: 12, color: "#818CF8", fontWeight: 600 }}>{a.party.name}</span>}
                          {a.subject && <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>— {a.subject}</span>}
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-ghost)", flexShrink: 0 }}>{new Date(a.createdAt).toLocaleDateString("en-IN")}</span>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--text-sec)", lineHeight: 1.6, margin: 0 }}>{a.description}</p>
                      {a.outcome && <p style={{ fontSize: 12, color: "var(--text-ghost)", marginTop: 6, fontStyle: "italic" }}>Outcome: {a.outcome}</p>}
                      {a.followUpDate && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: isOverdue ? "#ef444420" : isDue ? "#f59e0b20" : "#6366f120", color: isOverdue ? "#ef4444" : isDue ? "#f59e0b" : "#818CF8" }}>
                          {isOverdue ? <><X size={10} /> Overdue: </> : <><Clock size={10} /> Follow-up: </>}
                          {new Date(a.followUpDate).toLocaleDateString("en-IN")}
                        </div>
                      )}
                      {a.createdBy && <p style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 6 }}>by {a.createdBy.name}</p>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Log Activity Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-inner" style={{ maxWidth: 500 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>Log Activity</h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {error && <div style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Activity Type</label>
                  <select style={S.select} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Party / Customer *</label>
                  <select style={S.select} value={form.partyId} onChange={e => setForm(p => ({ ...p, partyId: e.target.value }))}>
                    <option value="">— Select —</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={S.label}>Subject</label>
                <input style={S.input} placeholder="e.g. Follow-up call regarding proposal" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Description *</label>
                <textarea style={{ ...S.input, minHeight: 80, resize: "vertical" }} placeholder="Describe what happened or was discussed..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Outcome</label>
                  <input style={S.input} placeholder="e.g. Interested, sending quote" value={form.outcome} onChange={e => setForm(p => ({ ...p, outcome: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Follow-up Date</label>
                  <input type="date" style={S.input} value={form.followUpDate} onChange={e => setForm(p => ({ ...p, followUpDate: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={save} style={S.btn} disabled={saving}>{saving ? "Saving..." : <><CheckCircle size={14} /> Log Activity</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
