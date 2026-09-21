import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Plus, X, Calendar, Clock, MapPin, Video, CheckCircle, XCircle, RefreshCw, Phone } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  inp: { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 12, outline: "none" } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  ghost: { background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 } as React.CSSProperties,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SCHEDULED:   { label: "Scheduled",   color: "#818cf8", bg: "#1e1b4b" },
  CONFIRMED:   { label: "Confirmed",   color: "#60a5fa", bg: "#1e3a5f" },
  COMPLETED:   { label: "Completed",   color: "#4ade80", bg: "#14532d" },
  CANCELLED:   { label: "Cancelled",   color: "#94a3b8", bg: "#1e293b" },
  NO_SHOW:     { label: "No Show",     color: "#f87171", bg: "#450a0a" },
  RESCHEDULED: { label: "Rescheduled", color: "#fbbf24", bg: "#451a03" },
};

interface Appointment {
  id: string; title: string; description?: string; scheduledAt: string; duration: number;
  location?: string; meetingLink?: string; status: string; outcome?: string;
  assignedToId?: string; leadId?: string; createdAt: string;
}

function AppointmentFormModal({ appt, onClose, onSaved }: { appt?: Appointment | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: appt?.title ?? "", description: appt?.description ?? "",
    scheduledAt: appt?.scheduledAt ? appt.scheduledAt.substring(0, 16) : "",
    duration: appt?.duration?.toString() ?? "30",
    location: appt?.location ?? "", meetingLink: appt?.meetingLink ?? "",
    status: appt?.status ?? "SCHEDULED", outcome: appt?.outcome ?? "",
  });
  const [saving, setSaving] = useState(false);
  const f = (k: string) => (v: string) => setForm(p => ({
...p, [k]: v }));

  async function save() {
    if (!form.title || !form.scheduledAt) return;
    setSaving(true);
    try {
      const payload = { ...form, duration: parseInt(form.duration), description: form.description || undefined, location: form.location || undefined, meetingLink: form.meetingLink || undefined, outcome: form.outcome || undefined };
      if (appt) await api.patch(`/appointments/${appt.id}`, payload);
      else await api.post("/appointments", payload);
      onSaved(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-md mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{appt ? "Edit Appointment" : "New Appointment"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Title *</label>
            <input style={{ ...S.inp, width: "100%" }} value={form.title} onChange={e => f("title")(e.target.value)} placeholder="Meeting with Rajesh Sharma" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Date & Time *</label>
              <input style={{ ...S.inp, width: "100%" }} type="datetime-local" value={form.scheduledAt} onChange={e => f("scheduledAt")(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Duration</label>
              <select style={{ ...S.inp, width: "100%" }} value={form.duration} onChange={e => f("duration")(e.target.value)}>
                {["15","30","45","60","90","120"].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Location / Address</label>
            <input style={{ ...S.inp, width: "100%" }} value={form.location} onChange={e => f("location")(e.target.value)} placeholder="Office, Client Site, Phone..." />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Meeting Link</label>
            <input style={{ ...S.inp, width: "100%" }} value={form.meetingLink} onChange={e => f("meetingLink")(e.target.value)} placeholder="https://meet.google.com/..." />
          </div>
          {appt && (
            <>
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Status</label>
                <select style={{ ...S.inp, width: "100%" }} value={form.status} onChange={e => f("status")(e.target.value)}>
                  {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Outcome / Notes</label>
                <textarea style={{ ...S.inp, width: "100%", resize: "vertical", minHeight: 60 } as React.CSSProperties} value={form.outcome} onChange={e => f("outcome")(e.target.value)} placeholder="What was the result?" />
              </div>
            </>
          )}
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Description</label>
            <textarea style={{ ...S.inp, width: "100%", resize: "vertical", minHeight: 60 } as React.CSSProperties} value={form.description} onChange={e => f("description")(e.target.value)} placeholder="Agenda, context..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={save} disabled={saving || !form.title || !form.scheduledAt} style={S.btn}><Calendar style={{ width: 12, height: 12 }} />{saving ? "Saving…" : appt ? "Update" : "Book"}</button>
        </div>
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list"|"today">("today");
  const [filterStatus, setFilterStatus] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
      const params = new URLSearchParams({ from, to });
      if (filterStatus) params.set("status", filterStatus);
      const [ar, tr] = await Promise.all([
        api.get(`/appointments?${params}`),
        api.get("/appointments/today"),
      ]);
      setAppointments(ar.data.data ?? []);
      setTodayAppts(tr.data.data ?? []);
    } catch {}
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function markStatus(id: string, status: string) {
    await api.patch(`/appointments/${id}`, { status });
    load();
  }

  async function deleteAppt(id: string) {
    if (!window.confirm("Delete this appointment?")) return;
    await api.delete(`/appointments/${id}`);
    load();
  }

  function formatTime(dt: string) {
    return new Date(dt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }
  function formatDate(dt: string) {
    return new Date(dt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  }

  const displayed = view === "today" ? todayAppts : appointments.filter(a => !filterStatus || a.status === filterStatus);

  // Group by date for list view
  const grouped: Record<string, Appointment[]> = {};
  displayed.forEach(a => {
    const key = new Date(a.scheduledAt).toDateString();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_appointments') }</h1>
          <p className="text-xs" style={{ color: "var(--text-ghost)" }}>Schedule & track client meetings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} style={S.ghost}><RefreshCw style={{ width: 13, height: 13 }} /></button>
          <button onClick={() => setShowAdd(true)} style={S.btn}><Plus style={{ width: 13, height: 13 }} /> New Appointment</button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Today", value: todayAppts.length, color: "#818cf8" },
          { label: "This Month", value: appointments.length, color: "#60a5fa" },
          { label: "Completed", value: appointments.filter(a => a.status === "COMPLETED").length, color: "#4ade80" },
          { label: "No Show", value: appointments.filter(a => a.status === "NO_SHOW").length, color: "#f87171" },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[11px]" style={{ color: "var(--text-ghost)" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Filter */}
      <div className="flex items-center gap-3 mb-4 flex-wrap" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        {(["today","list"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className="px-3 py-1.5 text-xs font-semibold capitalize"
            style={{ background: "none", border: "none", cursor: "pointer", color: view === v ? "#6366f1" : "var(--text-ghost)", borderBottom: view === v ? "2px solid #6366f1" : "2px solid transparent" }}>
            {v === "today" ? `Today (${todayAppts.length})` : "All Appointments"}
          </button>
        ))}
        {view === "list" && (
          <select style={{ ...S.inp, marginLeft: "auto" }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
      </div>

      {/* Appointment List */}
      {loading ? (
        <div className="text-center py-12" style={{ color: "var(--text-ghost)" }}>Loading…</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Calendar style={{ width: 36, height: 36, color: "var(--text-ghost)", opacity: 0.3 }} />
          <p className="text-sm" style={{ color: "var(--text-ghost)" }}>
            {view === "today" ? "No appointments today" : "No appointments found"}
          </p>
          <button onClick={() => setShowAdd(true)} style={S.btn}><Plus style={{ width: 12, height: 12 }} /> Book One</button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateStr, appts]) => (
            <div key={dateStr}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-ghost)" }}>
                {new Date(dateStr).toDateString() === new Date().toDateString() ? "Today" : formatDate(appts[0].scheduledAt)}
              </h3>
              <div className="space-y-2">
                {appts.map(appt => {
                  const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.SCHEDULED;
                  const now = new Date();
                  const scheduled = new Date(appt.scheduledAt);
                  const isPast = scheduled < now;
                  const endTime = new Date(scheduled.getTime() + appt.duration * 60000);

                  return (
                    <div key={appt.id} className="rounded-xl p-4 flex gap-4" style={{ ...S.card, opacity: appt.status === "CANCELLED" ? 0.6 : 1 }}>
                      {/* Time column */}
                      <div className="flex-shrink-0 text-center" style={{ width: 52 }}>
                        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{formatTime(appt.scheduledAt)}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-ghost)" }}>{formatTime(endTime.toISOString())}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-ghost)" }}>{appt.duration}m</p>
                      </div>

                      {/* Color bar */}
                      <div className="w-1 rounded-full flex-shrink-0" style={{ background: cfg.color }} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{appt.title}</h4>
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, fontWeight: 700, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {appt.location && (
                            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-ghost)" }}>
                              <MapPin style={{ width: 10, height: 10 }} />{appt.location}
                            </span>
                          )}
                          {appt.meetingLink && (
                            <a href={appt.meetingLink} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs" style={{ color: "#818cf8", textDecoration: "none" }}>
                              <Video style={{ width: 10, height: 10 }} />Join Meeting
                            </a>
                          )}
                        </div>
                        {appt.description && <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>{appt.description}</p>}
                        {appt.outcome && <p className="text-xs mt-1 italic" style={{ color: "#4ade80" }}>Outcome: {appt.outcome}</p>}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {appt.status === "SCHEDULED" && (
                          <>
                            <button onClick={() => markStatus(appt.id, "COMPLETED")} title="Mark Complete"
                              style={{ background: "#064e3b", border: "1px solid #065f46", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#4ade80", fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}>
                              <CheckCircle style={{ width: 10, height: 10 }} /> Done
                            </button>
                            <button onClick={() => markStatus(appt.id, "NO_SHOW")} title="No Show"
                              style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#f87171", fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}>
                              <XCircle style={{ width: 10, height: 10 }} /> N/S
                            </button>
                          </>
                        )}
                        <button onClick={() => setEditAppt(appt)}
                          style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "var(--text-secondary)", fontSize: 10 }}>
                          Edit
                        </button>
                        <button onClick={() => deleteAppt(appt.id)}
                          style={{ background: "none", border: "none", padding: "4px", cursor: "pointer", color: "var(--text-ghost)" }}>
                          <X style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AppointmentFormModal onClose={() => setShowAdd(false)} onSaved={load} />}
      {editAppt && <AppointmentFormModal appt={editAppt} onClose={() => setEditAppt(null)} onSaved={load} />}
    </div>
  );
}
