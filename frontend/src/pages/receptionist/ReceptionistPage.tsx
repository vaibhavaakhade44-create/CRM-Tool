import { useState, useEffect, useCallback } from "react";
import {
  ClipboardCheck, Plus, Users, Package, Search, X,
  LogOut, RefreshCw, CheckCircle,
} from "lucide-react";
import api from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { kPhone } from "@/lib/fieldRules";

// ── Types ────────────────────────────────────────────────────

interface Visitor {
  id: string; badgeNumber?: string; name: string; phone?: string; email?: string;
  company?: string; purpose?: string; whomToMeet?: string; department?: string;
  status: string; checkInTime: string; checkOutTime?: string; notes?: string;
}
interface Courier {
  id: string; type: string; courierCompany?: string; trackingNumber?: string;
  senderName?: string; senderCompany?: string; recipientName?: string; recipientDept?: string;
  description?: string; handledBy?: string; status: string; loggedAt: string; resolvedAt?: string;
}

// ── Constants ─────────────────────────────────────────────────

const VISITOR_COLOR: Record<string, string> = {
  CHECKED_IN: "#10b981", CHECKED_OUT: "#6b7280", EXPECTED: "#f59e0b", CANCELLED: "#ef4444",
};
const COURIER_COLOR: Record<string, string> = {
  PENDING: "#f59e0b", DELIVERED: "#10b981", RETURNED: "#ef4444",
};
const TAB_STYLE = (active: boolean): React.CSSProperties => ({
  padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
  background: active ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "var(--bg-hover)",
  color: active ? "white" : "var(--text-sec)",
});
const CARD: React.CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16,
};
const INPUT_STYLE: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--border-input)", background: "var(--bg-hover)",
  color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};
const BTN_PRIMARY: React.CSSProperties = {
  width: "100%", marginTop: 4, height: 40, borderRadius: 9, border: "none",
  background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white",
  fontSize: 14, fontWeight: 600, cursor: "pointer",
};
const BTN_SM: React.CSSProperties = {
  border: "none", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12,
};

const EMPTY_VISITOR = { name: "", phone: "", email: "", company: "", purpose: "", whomToMeet: "", department: "", idType: "", idNumber: "", vehicleNumber: "", notes: "" };
const EMPTY_COURIER = { type: "INCOMING", courierCompany: "", trackingNumber: "", senderName: "", senderCompany: "", recipientName: "", recipientDept: "", description: "", handledBy: "", notes: "" };

function badge(label: string, color: string) {
  return <span style={{ background: color + "20", color, padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{label.replace("_", " ")}</span>;
}
function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

// ── Main Component ────────────────────────────────────────────

export default function ReceptionistPage() {
  const [tab, setTab] = useState<"dashboard" | "visitors" | "couriers">("dashboard");
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [visitorSearch, setVisitorSearch] = useState("");
  const [visitorStatus, setVisitorStatus] = useState("");
  const [courierType, setCourierType] = useState("");
  const [courierStatus, setCourierStatus] = useState("");

  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);

  const [visitorForm, setVisitorForm] = useState(EMPTY_VISITOR);
  const [courierForm, setCourierForm] = useState(EMPTY_COURIER);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const vq = new URLSearchParams();
      if (visitorSearch) vq.set("search", visitorSearch);
      if (visitorStatus) vq.set("status", visitorStatus);
      const cq = new URLSearchParams();
      if (courierType) cq.set("type", courierType);
      if (courierStatus) cq.set("status", courierStatus);

      const [v, c, s] = await Promise.all([
        api.get(`/receptionist/visitors?${vq.toString()}`),
        api.get(`/receptionist/couriers?${cq.toString()}`),
        api.get("/receptionist/stats"),
      ]);
      setVisitors(v.data.data || []);
      setCouriers(c.data.data || []);
      setStats(s.data.data);
      setError("");
    } catch (e) { setError(getApiError(e)); }
    setLoading(false);
  }, [visitorSearch, visitorStatus, courierType, courierStatus]);

  useEffect(() => { load(); }, [visitorStatus, courierType, courierStatus]);

  async function saveVisitor() {
    if (!visitorForm.name.trim()) return;
    setSaving(true);
    try {
      await api.post("/receptionist/visitors", visitorForm);
      setShowVisitorModal(false);
      setVisitorForm(EMPTY_VISITOR);
      await load();
    } catch (e) { setError(getApiError(e)); }
    setSaving(false);
  }

  async function checkOut(id: string) {
    try {
      await api.post(`/receptionist/visitors/${id}/checkout`);
      setSelectedVisitor(null);
      await load();
    } catch (e) { setError(getApiError(e)); }
  }

  async function saveCourier() {
    setSaving(true);
    try {
      await api.post("/receptionist/couriers", courierForm);
      setShowCourierModal(false);
      setCourierForm(EMPTY_COURIER);
      await load();
    } catch (e) { setError(getApiError(e)); }
    setSaving(false);
  }

  async function updateCourierStatus(id: string, status: string) {
    try {
      await api.patch(`/receptionist/couriers/${id}/status`, { status });
      await load();
    } catch (e) { setError(getApiError(e)); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-main)", padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ClipboardCheck size={18} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Receptionist</h1>
            <p style={{ fontSize: 12, color: "var(--text-ghost)", margin: 0 }}>Visitor check-in/out and courier register — for any business</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {stats && (
            <>
              <Stat label="Visitors Today" value={stats.visitorsToday || 0} color="#818cf8" />
              <Stat label="Currently In" value={stats.currentlyIn || 0} color="#10b981" />
              <Stat label="Couriers Today" value={stats.couriersToday || 0} color="#f59e0b" />
              <Stat label="Pending Pickup" value={stats.couriersPending || 0} color="#ef4444" />
            </>
          )}
          <button onClick={load} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", color: "var(--text-sec)" }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 8, fontSize: 13, color: "#f87171", display: "flex", justifyContent: "space-between" }}>
          {error}
          <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171" }}><X size={14} /></button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {(["dashboard", "visitors", "couriers"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={TAB_STYLE(tab === t)}>
            {t === "dashboard" ? "🏢 Overview" : t === "visitors" ? "🧑 Visitors" : "📦 Couriers"}
          </button>
        ))}
      </div>

      {/* ══ DASHBOARD ══ */}
      {tab === "dashboard" && (
        <div>
          <div className="grid-r2" style={{ gap: 12, marginBottom: 20 }}>
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Users size={16} color="#10b981" />
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Currently Checked-In ({visitors.filter(v => v.status === "CHECKED_IN").length})</span>
              </div>
              {visitors.filter(v => v.status === "CHECKED_IN").slice(0, 6).map(v => (
                <div key={v.id} onClick={() => setSelectedVisitor(v)} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13, cursor: "pointer" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{v.name}</div>
                    <div style={{ color: "var(--text-ghost)", fontSize: 12 }}>{v.purpose || "Visiting"} {v.whomToMeet ? `— ${v.whomToMeet}` : ""}</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-ghost)" }}>{fmtDateTime(v.checkInTime)}</div>
                </div>
              ))}
              {!visitors.some(v => v.status === "CHECKED_IN") && <div style={{ color: "var(--text-ghost)", fontSize: 13 }}>No one currently checked in</div>}
            </div>
            <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Package size={16} color="#f59e0b" />
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Pending Courier Pickups</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>{stats?.couriersPending ?? 0}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setVisitorForm(EMPTY_VISITOR); setShowVisitorModal(true); }} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", fontSize: 12, color: "var(--text-sec)" }}>
                  + Check In Visitor
                </button>
                <button onClick={() => { setCourierForm(EMPTY_COURIER); setShowCourierModal(true); }} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", cursor: "pointer", fontSize: 12, color: "white", fontWeight: 600 }}>
                  + Log Courier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ VISITORS ══ */}
      {tab === "visitors" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={() => { setVisitorForm(EMPTY_VISITOR); setShowVisitorModal(true); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", cursor: "pointer", fontSize: 13, color: "white", fontWeight: 600 }}>
              <Plus size={14} /> Check In Visitor
            </button>
            <div style={{ position: "relative", minWidth: 220 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
              <input value={visitorSearch} onChange={e => setVisitorSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} placeholder="Search name, phone, company…"
                style={{ ...INPUT_STYLE, paddingLeft: 30 }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
              {["", "CHECKED_IN", "CHECKED_OUT", "EXPECTED", "CANCELLED"].map(s => (
                <button key={s} onClick={() => setVisitorStatus(s)} style={{ ...TAB_STYLE(visitorStatus === s), padding: "5px 10px", fontSize: 11 }}>
                  {s || "All"}
                </button>
              ))}
            </div>
          </div>

          <div style={CARD}>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Badge","Name","Phone","Company","Meeting","Check-in","Status","Action"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--text-ghost)" }}>Loading...</td></tr>
                : visitors.length === 0 ? <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--text-ghost)" }}>No visitors found</td></tr>
                : visitors.map(v => (
                  <tr key={v.id} style={{ cursor: "pointer" }} onClick={() => setSelectedVisitor(v)}>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "monospace", color: "#818cf8", borderBottom: "1px solid var(--bg-hover)" }}>{v.badgeNumber}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", borderBottom: "1px solid var(--bg-hover)" }}>{v.name}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" }}>{v.phone || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" }}>{v.company || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" }}>{v.whomToMeet || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-ghost)", borderBottom: "1px solid var(--bg-hover)" }}>{fmtDateTime(v.checkInTime)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--bg-hover)" }}>{badge(v.status, VISITOR_COLOR[v.status] || "#818cf8")}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--bg-hover)" }} onClick={e => e.stopPropagation()}>
                      {v.status === "CHECKED_IN" && (
                        <button onClick={() => checkOut(v.id)} style={{ ...BTN_SM, background: "#6366f120", color: "#6366f1", border: "1px solid #6366f140", display: "flex", alignItems: "center", gap: 4 }}>
                          <LogOut size={11} /> Check Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ COURIERS ══ */}
      {tab === "couriers" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={() => { setCourierForm(EMPTY_COURIER); setShowCourierModal(true); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", cursor: "pointer", fontSize: 13, color: "white", fontWeight: 600 }}>
              <Plus size={14} /> Log Courier
            </button>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["", "INCOMING", "OUTGOING"].map(t => (
                <button key={t} onClick={() => setCourierType(t)} style={{ ...TAB_STYLE(courierType === t), padding: "5px 10px", fontSize: 11 }}>{t || "All"}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
              {["", "PENDING", "DELIVERED", "RETURNED"].map(s => (
                <button key={s} onClick={() => setCourierStatus(s)} style={{ ...TAB_STYLE(courierStatus === s), padding: "5px 10px", fontSize: 11 }}>{s || "All"}</button>
              ))}
            </div>
          </div>

          <div style={CARD}>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Type","Courier Co.","Tracking #","From","To","Description","Status","Date","Action"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--text-ghost)" }}>Loading...</td></tr>
                : couriers.length === 0 ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--text-ghost)" }}>No courier logs found</td></tr>
                : couriers.map(c => (
                  <tr key={c.id}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--bg-hover)" }}>{badge(c.type, c.type === "INCOMING" ? "#10b981" : "#818cf8")}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" }}>{c.courierCompany || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "monospace", color: "var(--text-ghost)", borderBottom: "1px solid var(--bg-hover)" }}>{c.trackingNumber || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" }}>{c.senderName || c.senderCompany || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, borderBottom: "1px solid var(--bg-hover)" }}>{c.recipientName || c.recipientDept || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" }}>{c.description || "—"}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--bg-hover)" }}>{badge(c.status, COURIER_COLOR[c.status] || "#818cf8")}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-ghost)", borderBottom: "1px solid var(--bg-hover)" }}>{fmtDateTime(c.loggedAt)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--bg-hover)" }}>
                      {c.status === "PENDING" && c.type === "INCOMING" && (
                        <button onClick={() => updateCourierStatus(c.id, "DELIVERED")} style={{ ...BTN_SM, background: "#10b98120", color: "#10b981", border: "1px solid #10b98140", display: "flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle size={11} /> Mark Delivered
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Check-in Modal ── */}
      {showVisitorModal && (
        <Modal title="Check In Visitor" onClose={() => setShowVisitorModal(false)}>
          <div className="grid-r2" style={{ gap: 10 }}>
            <FF label="Full Name *"><input value={visitorForm.name} onChange={e => setVisitorForm(f => ({ ...f, name: e.target.value }))} placeholder="Visitor name" style={INPUT_STYLE} /></FF>
            <FF label="Phone"><input value={visitorForm.phone} onChange={e => setVisitorForm(f => ({ ...f, phone: e.target.value }))} onKeyDown={kPhone} maxLength={15} placeholder="+91 98765…" style={INPUT_STYLE} /></FF>
          </div>
          <FF label="Company / Organization"><input value={visitorForm.company} onChange={e => setVisitorForm(f => ({ ...f, company: e.target.value }))} style={INPUT_STYLE} /></FF>
          <div className="grid-r2" style={{ gap: 10 }}>
            <FF label="Purpose of Visit"><input value={visitorForm.purpose} onChange={e => setVisitorForm(f => ({ ...f, purpose: e.target.value }))} placeholder="Meeting, Delivery, Interview…" style={INPUT_STYLE} /></FF>
            <FF label="Whom to Meet"><input value={visitorForm.whomToMeet} onChange={e => setVisitorForm(f => ({ ...f, whomToMeet: e.target.value }))} placeholder="Employee / department" style={INPUT_STYLE} /></FF>
          </div>
          <div className="grid-r2" style={{ gap: 10 }}>
            <FF label="ID Type"><input value={visitorForm.idType} onChange={e => setVisitorForm(f => ({ ...f, idType: e.target.value }))} placeholder="Aadhaar, PAN, License…" style={INPUT_STYLE} /></FF>
            <FF label="ID Number"><input value={visitorForm.idNumber} onChange={e => setVisitorForm(f => ({ ...f, idNumber: e.target.value }))} style={INPUT_STYLE} /></FF>
          </div>
          <FF label="Vehicle Number"><input value={visitorForm.vehicleNumber} onChange={e => setVisitorForm(f => ({ ...f, vehicleNumber: e.target.value }))} placeholder="Optional" style={INPUT_STYLE} /></FF>
          <FF label="Notes"><input value={visitorForm.notes} onChange={e => setVisitorForm(f => ({ ...f, notes: e.target.value }))} style={INPUT_STYLE} /></FF>
          <button onClick={saveVisitor} disabled={saving || !visitorForm.name.trim()} style={BTN_PRIMARY}>{saving ? "Checking in…" : "Check In"}</button>
        </Modal>
      )}

      {/* ── Courier Modal ── */}
      {showCourierModal && (
        <Modal title="Log Courier / Package" onClose={() => setShowCourierModal(false)}>
          <FF label="Type *">
            <select value={courierForm.type} onChange={e => setCourierForm(f => ({ ...f, type: e.target.value }))} style={INPUT_STYLE}>
              <option value="INCOMING">Incoming (delivered to us)</option>
              <option value="OUTGOING">Outgoing (dispatched from us)</option>
            </select>
          </FF>
          <div className="grid-r2" style={{ gap: 10 }}>
            <FF label="Courier Company"><input value={courierForm.courierCompany} onChange={e => setCourierForm(f => ({ ...f, courierCompany: e.target.value }))} placeholder="BlueDart, FedEx, DTDC…" style={INPUT_STYLE} /></FF>
            <FF label="Tracking Number"><input value={courierForm.trackingNumber} onChange={e => setCourierForm(f => ({ ...f, trackingNumber: e.target.value }))} style={INPUT_STYLE} /></FF>
          </div>
          {courierForm.type === "INCOMING" ? (
            <div className="grid-r2" style={{ gap: 10 }}>
              <FF label="Sender Name/Company"><input value={courierForm.senderName} onChange={e => setCourierForm(f => ({ ...f, senderName: e.target.value }))} style={INPUT_STYLE} /></FF>
              <FF label="For (Recipient)"><input value={courierForm.recipientName} onChange={e => setCourierForm(f => ({ ...f, recipientName: e.target.value }))} placeholder="Employee / department" style={INPUT_STYLE} /></FF>
            </div>
          ) : (
            <div className="grid-r2" style={{ gap: 10 }}>
              <FF label="Sent By"><input value={courierForm.recipientName} onChange={e => setCourierForm(f => ({ ...f, recipientName: e.target.value }))} placeholder="Employee / department" style={INPUT_STYLE} /></FF>
              <FF label="Recipient (destination)"><input value={courierForm.senderName} onChange={e => setCourierForm(f => ({ ...f, senderName: e.target.value }))} style={INPUT_STYLE} /></FF>
            </div>
          )}
          <FF label="Description"><input value={courierForm.description} onChange={e => setCourierForm(f => ({ ...f, description: e.target.value }))} placeholder="Documents, parcel, sample…" style={INPUT_STYLE} /></FF>
          <FF label="Handled By"><input value={courierForm.handledBy} onChange={e => setCourierForm(f => ({ ...f, handledBy: e.target.value }))} placeholder="Your name" style={INPUT_STYLE} /></FF>
          <button onClick={saveCourier} disabled={saving} style={BTN_PRIMARY}>{saving ? "Saving…" : "Log Courier"}</button>
        </Modal>
      )}

      {/* ── Visitor Detail ── */}
      {selectedVisitor && (
        <Modal title={selectedVisitor.name} onClose={() => setSelectedVisitor(null)}>
          <div style={{ marginBottom: 12 }}>{badge(selectedVisitor.status, VISITOR_COLOR[selectedVisitor.status] || "#818cf8")}</div>
          <div className="grid-r2" style={{ gap: 10, marginBottom: 14 }}>
            {[
              { label: "Badge", val: selectedVisitor.badgeNumber || "—" },
              { label: "Phone", val: selectedVisitor.phone || "—" },
              { label: "Company", val: selectedVisitor.company || "—" },
              { label: "Purpose", val: selectedVisitor.purpose || "—" },
              { label: "Whom to Meet", val: selectedVisitor.whomToMeet || "—" },
              { label: "Check-in", val: fmtDateTime(selectedVisitor.checkInTime) },
              { label: "Check-out", val: fmtDateTime(selectedVisitor.checkOutTime) },
            ].map(({ label, val }) => (
              <div key={label} style={{ background: "var(--bg-hover)", borderRadius: 8, padding: "9px 12px" }}>
                <div style={{ fontSize: 10, color: "var(--text-ghost)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>
          {selectedVisitor.notes && (
            <div style={{ marginBottom: 14, background: "var(--bg-hover)", borderRadius: 8, padding: "9px 12px" }}>
              <div style={{ fontSize: 10, color: "var(--text-ghost)", fontWeight: 700, textTransform: "uppercase" }}>Notes</div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 4 }}>{selectedVisitor.notes}</div>
            </div>
          )}
          {selectedVisitor.status === "CHECKED_IN" && (
            <button onClick={() => checkOut(selectedVisitor.id)} style={BTN_PRIMARY}>Check Out</button>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-ghost)" }}>{label}</div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
