import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Stethoscope, Calendar, Clock, User, Phone, ChevronRight,
  Activity, AlertTriangle, LogOut, Home, RefreshCw, Heart,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const diffLabel = (apptDate: string) => {
  const ms = new Date(apptDate).getTime() - Date.now();
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);
  if (ms < 0)    return { label: "Overdue",           color: "#ef4444" };
  if (h < 1)     return { label: `In ${m}m`,          color: "#f97316" };
  if (h < 24)    return { label: `In ${h}h ${m}m`,    color: "#f59e0b" };
  const days = Math.ceil(ms / 86_400_000);
  return { label: `In ${days} day${days > 1 ? "s" : ""}`, color: "#10b981" };
};

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "#818cf8", CONFIRMED: "#10b981", COMPLETED: "#6b7280",
  CANCELLED: "#ef4444", NO_SHOW: "#f59e0b",
};

// ── Component ─────────────────────────────────────────────
export default function DoctorDashboardPage() {
  const navigate    = useNavigate();
  const logout      = useAuthStore((s) => s.logout);
  const [doctor, setDoctor]     = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/health/my-doctor-profile");
      setDoctor(data.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not load your doctor profile.");
    }
    setLoading(false);
  }

  async function handleLogout() {
    await logout();
    navigate("/health-portal/login", { replace: true });
  }

  // ── Styles ──
  const S = {
    page:  { minHeight: "100vh", background: "#f0fdf4", fontFamily: "system-ui,-apple-system,sans-serif" } as React.CSSProperties,
    header:{ background: "linear-gradient(135deg,#0f766e,#059669)", padding: "0 clamp(16px,3vw,40px)", display: "flex", alignItems: "center", height: 60, gap: 14 } as React.CSSProperties,
    main:  { padding: "28px clamp(16px,3vw,40px)", maxWidth: 1100, margin: "0 auto" } as React.CSSProperties,
    card:  { background: "white", borderRadius: 12, border: "1px solid #d1fae5", padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" } as React.CSSProperties,
    statCard: (accent: string) => ({ background: "white", borderRadius: 10, border: `1px solid ${accent}30`, padding: "16px 18px", flex: 1, minWidth: 120 } as React.CSSProperties),
    apptCard: (upcoming: boolean) => ({
      background: upcoming ? "#f0fdf4" : "white",
      border: `1px solid ${upcoming ? "#10b98130" : "#e2e8f0"}`,
      borderLeft: `3px solid ${upcoming ? "#10b981" : "#818cf8"}`,
      borderRadius: 10, padding: "14px 16px", cursor: "pointer",
      transition: "box-shadow 0.15s",
    } as React.CSSProperties),
  };

  if (loading) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#0f766e", fontSize: 14 }}>
      <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} /> Loading your dashboard…
    </div>
  );

  if (error) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <AlertTriangle size={40} color="#ef4444" style={{ marginBottom: 12 }} />
        <p style={{ color: "#374151", fontSize: 14 }}>{error}</p>
        <button onClick={() => navigate("/health")} style={{ marginTop: 12, padding: "10px 22px", background: "#0f766e", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          Go to Admin View
        </button>
      </div>
    </div>
  );

  const todayAppts    = doctor?.appointments ?? [];
  const upcomingAppts = doctor?.upcomingAppointments ?? [];

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Stethoscope size={20} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>{doctor?.name}</div>
          <div style={{ fontSize: 11, color: "#d1fae5" }}>{doctor?.specialization} · {doctor?.department}</div>
        </div>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#d1fae5", textDecoration: "none", marginRight: 8 }}>
          <Home size={13} /> Main Site
        </Link>
        <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <LogOut size={13} /> Logout
        </button>
      </header>

      <main style={S.main}>
        {/* Greeting */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: "clamp(18px,2.5vw,24px)", fontWeight: 800, color: "#064e3b", margin: "0 0 4px" }}>
            Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, {doctor?.name?.replace("Dr. ", "Dr. ")} 👋
          </h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} · City Care Clinic
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "Today's Schedule",   val: todayAppts.length,            color: "#10b981", icon: <Calendar size={16} color="#10b981" /> },
            { label: "Upcoming (7 days)",  val: upcomingAppts.length,         color: "#6366f1", icon: <Clock    size={16} color="#6366f1" /> },
            { label: "Consultation Fee",   val: `₹${doctor?.consultationFee}`,color: "#f59e0b", icon: <Heart   size={16} color="#f59e0b" /> },
            { label: "Experience",         val: `${doctor?.experience} yrs`,   color: "#0f766e", icon: <Activity size={16} color="#0f766e"/> },
          ].map((s) => (
            <div key={s.label} style={S.statCard(s.color)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>{s.icon}<span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>{s.label}</span></div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>{s.val}</div>
            </div>
          ))}
        </div>

        <div className="grid-r2" style={{ gap: 20, alignItems: "start" }}>

          {/* Today's Appointments */}
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Calendar size={16} color="#10b981" />
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#064e3b", margin: 0 }}>Today's Schedule</h2>
              <span style={{ marginLeft: "auto", fontSize: 11, background: "#10b98115", color: "#059669", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{todayAppts.length} appointments</span>
            </div>

            {todayAppts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "#9ca3af" }}>
                <Calendar size={32} color="#d1fae5" style={{ margin: "0 auto 8px", display: "block" }} />
                <p style={{ fontSize: 13, margin: 0 }}>No appointments scheduled for today</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {todayAppts.map((a: any) => {
                  const diff = diffLabel(a.appointmentDate);
                  const open = expanded === a.id;
                  return (
                    <div key={a.id} style={S.apptCard(false)} onClick={() => setExpanded(open ? null : a.id)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: "#818cf820", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <User size={16} color="#818cf8" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{a.patient?.name}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{a.patient?.patientCode} · {a.timeSlot}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: diff.color }}>{diff.label}</div>
                          <div style={{ fontSize: 10, background: (STATUS_COLOR[a.status] || "#6b7280") + "20", color: STATUS_COLOR[a.status] || "#6b7280", padding: "2px 6px", borderRadius: 4, fontWeight: 700, marginTop: 2 }}>{a.status}</div>
                        </div>
                      </div>
                      {open && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                          {a.chiefComplaint && <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}><b>Complaint:</b> {a.chiefComplaint}</div>}
                          {a.patient?.phone && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
                              <Phone size={11} />{a.patient.phone}
                            </div>
                          )}
                          {a.patient?.allergies?.length > 0 && (
                            <div style={{ marginTop: 8, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 10px", fontSize: 11, color: "#dc2626" }}>
                              <AlertTriangle size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
                              Allergies: {a.patient.allergies.join(", ")}
                            </div>
                          )}
                          {a.patient?.chronicConds?.length > 0 && (
                            <div style={{ marginTop: 6, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px", fontSize: 11, color: "#b45309" }}>
                              Conditions: {a.patient.chronicConds.join(", ")}
                            </div>
                          )}
                          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                            <button onClick={(e) => { e.stopPropagation(); navigate("/health"); }} style={{ flex: 1, padding: "7px 0", background: "#0f766e", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                              Open Full Records
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Appointments */}
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Clock size={16} color="#6366f1" />
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#064e3b", margin: 0 }}>Upcoming (Next 7 Days)</h2>
              <span style={{ marginLeft: "auto", fontSize: 11, background: "#6366f115", color: "#6366f1", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{upcomingAppts.length}</span>
            </div>

            {upcomingAppts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "#9ca3af" }}>
                <Clock size={32} color="#e0e7ff" style={{ margin: "0 auto 8px", display: "block" }} />
                <p style={{ fontSize: 13, margin: 0 }}>No upcoming appointments this week</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {upcomingAppts.map((a: any) => {
                  const diff = diffLabel(a.appointmentDate);
                  return (
                    <div key={a.id} style={S.apptCard(true)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: "#10b98120", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <User size={16} color="#10b981" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{a.patient?.name}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>
                            {fmtDate(a.appointmentDate)} · {a.timeSlot}
                          </div>
                          {a.chiefComplaint && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.chiefComplaint}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: diff.color }}>{diff.label}</div>
                          <div style={{ fontSize: 10, background: (STATUS_COLOR[a.status] || "#6b7280") + "20", color: STATUS_COLOR[a.status] || "#6b7280", padding: "2px 6px", borderRadius: 4, fontWeight: 700, marginTop: 2 }}>{a.status}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Doctor info card */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #d1fae5" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Your Profile</div>
              {[
                { label: "Registration", val: doctor?.registrationNo },
                { label: "Qualification", val: doctor?.qualification },
                { label: "Available", val: doctor?.availableDays?.join(", ") },
                { label: "Slot Duration", val: `${doctor?.slotDuration} min` },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid #f0fdf4" }}>
                  <span style={{ color: "#6b7280" }}>{row.label}</span>
                  <span style={{ color: "#0f172a", fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{row.val}</span>
                </div>
              ))}
              <button onClick={() => navigate("/health")} style={{ marginTop: 14, width: "100%", padding: "9px 0", background: "linear-gradient(135deg,#0f766e,#10b981)", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                Open Full Health Panel <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
