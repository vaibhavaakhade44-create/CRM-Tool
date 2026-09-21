import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import {
  Heart, Search, User, Calendar, Clipboard, TestTube,
  Activity, AlertTriangle, X, ChevronDown, ChevronUp, Phone, Mail,
  Bell, Clock,
} from "lucide-react";

const S = {
  page: { minHeight: "100vh", background: "#0f0f1a", display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "40px 20px" },
  hero: { textAlign: "center" as const, marginBottom: 40 },
  card: { background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 680 },
  input: { width: "100%", background: "#252540", border: "1px solid #3a3a5a", borderRadius: 10, padding: "12px 16px", color: "#e2e8f0", fontSize: 15, outline: "none", boxSizing: "border-box" as const, textTransform: "uppercase" as const, letterSpacing: "0.1em", fontWeight: 700 },
  btn: { background: "linear-gradient(135deg,#ef4444,#dc2626)", border: "none", color: "white", padding: "12px 28px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  section: { background: "#252540", border: "1px solid #2a2a4a", borderRadius: 12, marginBottom: 16, overflow: "hidden" } as React.CSSProperties,
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", userSelect: "none" as const },
  sectionBody: { padding: "0 18px 16px", borderTop: "1px solid #2a2a4a" },
  pill: (color: string) => ({ display: "inline-block", background: color + "20", color, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid ${color}40` }),
  row: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #2a2a4a30", fontSize: 13 } as React.CSSProperties,
  label: { color: "#6b7280", fontWeight: 500 },
  val: { color: "#e2e8f0", fontWeight: 600, textAlign: "right" as const, maxWidth: "60%" },
};

function CollapsibleSection({ title, icon: Icon, color, children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={S.section}>
      <div style={S.sectionHeader} onClick={() => setOpen(!open)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={15} color={color} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>{title}</span>
        </div>
        {open ? <ChevronUp size={16} color="#6b7280" /> : <ChevronDown size={16} color="#6b7280" />}
      </div>
      {open && <div style={S.sectionBody}>{children}</div>}
    </div>
  );
}

function countdownLabel(dateStr: string, timeSlot: string): string {
  const [h, m] = (timeSlot || "00:00").split(":").map(Number);
  const appt = new Date(dateStr);
  appt.setHours(h, m, 0, 0);
  const diff = appt.getTime() - Date.now();
  if (diff <= 0) return "Now / Overdue";
  const hours = Math.floor(diff / 3600000);
  const mins  = Math.floor((diff % 3600000) / 60000);
  if (hours < 1)  return `In ${mins}m`;
  if (hours < 24) return `In ${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `In ${days} day${days !== 1 ? "s" : ""}`;
}

function UpcomingBanner({ appointments }: { appointments: any[] }) {
  const now = Date.now();
  const h48 = 48 * 3600 * 1000;

  const soon = appointments
    .filter(a => ["SCHEDULED", "CONFIRMED"].includes(a.status))
    .map(a => {
      const [h, m] = (a.timeSlot || "00:00").split(":").map(Number);
      const d = new Date(a.appointmentDate);
      d.setHours(h, m, 0, 0);
      return { ...a, _ts: d.getTime() };
    })
    .filter(a => a._ts > now && a._ts - now <= h48)
    .sort((a, b) => a._ts - b._ts);

  if (!soon.length) return null;

  const next = soon[0];
  const isVeryClose = next._ts - now <= 2 * 3600 * 1000;

  return (
    <div style={{
      width: "100%", maxWidth: 680, marginBottom: 20,
      background: isVeryClose
        ? "linear-gradient(135deg,#7f1d1d,#991b1b)"
        : "linear-gradient(135deg,#1e3a5f,#1e40af)",
      border: `1px solid ${isVeryClose ? "#dc2626" : "#3b82f6"}`,
      borderRadius: 14, padding: "16px 20px",
      boxShadow: isVeryClose ? "0 0 24px #dc262640" : "0 0 24px #3b82f640",
      animation: isVeryClose ? "pulse 2s infinite" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: isVeryClose ? "#dc262630" : "#3b82f630",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Bell size={20} color={isVeryClose ? "#fca5a5" : "#93c5fd"} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "white", marginBottom: 3 }}>
            {isVeryClose ? "⚡ Appointment Very Soon!" : "🔔 Upcoming Appointment Reminder"}
          </div>
          <div style={{ fontSize: 13, color: isVeryClose ? "#fca5a5" : "#bfdbfe" }}>
            Dr. <strong>{next.doctor?.name}</strong> · {next.doctor?.specialization}
          </div>
          <div style={{ fontSize: 12, color: isVeryClose ? "#fca5a5" : "#93c5fd", marginTop: 2, display: "flex", alignItems: "center", gap: 10 }}>
            <span>📅 {new Date(next.appointmentDate).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}</span>
            <span>🕐 {next.timeSlot}</span>
            <span style={{
              background: isVeryClose ? "#dc262620" : "#3b82f620",
              border: `1px solid ${isVeryClose ? "#dc262650" : "#3b82f650"}`,
              borderRadius: 20, padding: "1px 8px", fontWeight: 700,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <Clock size={10} /> {countdownLabel(next.appointmentDate, next.timeSlot)}
            </span>
          </div>
        </div>
      </div>

      {soon.length > 1 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${isVeryClose ? "#dc262640" : "#3b82f640"}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: isVeryClose ? "#fca5a5" : "#93c5fd", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
            {soon.length - 1} More Within 48 Hours
          </div>
          {soon.slice(1).map(a => (
            <div key={a.id} style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4, display: "flex", gap: 10 }}>
              <span>Dr. {a.doctor?.name}</span>
              <span>·</span>
              <span>{new Date(a.appointmentDate).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}</span>
              <span>{a.timeSlot}</span>
              <span style={{ color: "#94a3b8" }}>({countdownLabel(a.appointmentDate, a.timeSlot)})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PatientPortalPage() {
  const [searchParams] = useSearchParams();
  const [code, setCode]       = useState(searchParams.get("code") ?? "");
  const [orgSlug, setOrgSlug] = useState(searchParams.get("orgSlug") ?? "");
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState<any>(null);
  const [error, setError]     = useState("");

  const search = async (overrideCode?: string, overrideSlug?: string) => {
    const c = (overrideCode ?? code).trim().toUpperCase();
    const s = overrideSlug ?? orgSlug;
    if (!c) return;
    setLoading(true); setError(""); setPatient(null);
    try {
      const params = new URLSearchParams({ patientCode: c });
      if (s) params.set("orgSlug", s);
      const r = await api.get(`/health/portal?${params.toString()}`);
      setPatient(r.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Patient not found. Please check the code and try again.");
    }
    setLoading(false);
  };

  // Auto-load when navigated with ?code= from Health Portal Login
  useEffect(() => {
    const urlCode = searchParams.get("code");
    const urlSlug = searchParams.get("orgSlug");
    if (urlCode) {
      setCode(urlCode.toUpperCase());
      if (urlSlug) setOrgSlug(urlSlug);
      search(urlCode, urlSlug ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const bgLabel = (bg: string) => bg.replace("_","").replace("POS","+").replace("NEG","-");

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.hero}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#ef4444,#dc2626)", marginBottom: 16, boxShadow: "0 8px 32px rgba(239,68,68,0.4)" }}>
          <Heart size={28} color="white" />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#e2e8f0", margin: "0 0 8px" }}>Patient Portal</h1>
        <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>Enter your Patient Code to view your medical records, appointments, and prescriptions.</p>
      </div>

      {/* Search box */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          Your Patient Code
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            style={S.input}
            placeholder="PT-00001"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && search()}
          />
          <button onClick={() => search()} disabled={loading || !code.trim()} style={{ ...S.btn, opacity: (loading || !code.trim()) ? 0.6 : 1, cursor: (loading || !code.trim()) ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
            <Search size={16} />{loading ? "Searching…" : "View Records"}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 12, background: "#ef444420", border: "1px solid #ef444440", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} />{error}
          </div>
        )}
        <p style={{ fontSize: 12, color: "#4b5563", marginTop: 12, marginBottom: 0 }}>
          Your patient code was given to you during registration (format: PT-XXXXX). Contact the clinic if you don't have it.
        </p>
      </div>

      {/* Results */}
      {patient && (
        <div style={{ width: "100%", maxWidth: 680 }}>

          {/* ── Upcoming appointment banner ── */}
          {patient.appointments?.length > 0 && (
            <UpcomingBanner appointments={patient.appointments} />
          )}

          {/* Patient header card */}
          <div style={{ ...S.card, marginBottom: 20, background: "linear-gradient(135deg,#1a1a2e,#252540)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#ef444420", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #ef444440", flexShrink: 0 }}>
                <User size={26} color="#ef4444" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "#e2e8f0" }}>{patient.name}</h2>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={S.pill("#818cf8")}>{patient.patientCode}</span>
                  {patient.bloodGroup && <span style={S.pill("#ef4444")}>Blood: {bgLabel(patient.bloodGroup)}</span>}
                  {patient.gender && <span style={S.pill("#10b981")}>{patient.gender}</span>}
                </div>
              </div>
              <button onClick={() => { setPatient(null); setCode(""); }} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={18} /></button>
            </div>

            <div className="grid-r2" style={{ marginTop: 16, gap: 10 }}>
              {patient.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af" }}>
                  <Phone size={12} />{patient.phone}
                </div>
              )}
              {patient.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af" }}>
                  <Mail size={12} />{patient.email}
                </div>
              )}
            </div>

            {patient.allergies?.length > 0 && (
              <div style={{ marginTop: 14, background: "#ef444415", border: "1px solid #ef444430", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", marginBottom: 4 }}>⚠ KNOWN ALLERGIES</div>
                <div style={{ fontSize: 13, color: "#fca5a5" }}>{patient.allergies.join(", ")}</div>
              </div>
            )}

            {patient.chronicConds?.length > 0 && (
              <div style={{ marginTop: 10, background: "#f59e0b15", border: "1px solid #f59e0b30", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>CHRONIC CONDITIONS</div>
                <div style={{ fontSize: 13, color: "#fcd34d" }}>{patient.chronicConds.join(", ")}</div>
              </div>
            )}

            {patient.organization && (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#4b5563" }}>
                <Heart size={11} color="#ef4444" />
                <span>Registered at <strong style={{ color: "#9ca3af" }}>{patient.organization.name}</strong></span>
              </div>
            )}
          </div>

          {/* Appointments */}
          {patient.appointments?.length > 0 && (
            <CollapsibleSection title={`Appointments (${patient.appointments.length})`} icon={Calendar} color="#818cf8">
              {patient.appointments.map((a: any) => {
                const isUpcoming = ["SCHEDULED","CONFIRMED"].includes(a.status) && new Date(a.appointmentDate).getTime() > Date.now();
                return (
                  <div key={a.id} style={{ padding: "12px 0", borderBottom: "1px solid #2a2a4a", position: "relative" }}>
                    {isUpcoming && (
                      <div style={{ position: "absolute", top: 12, right: 0 }}>
                        <span style={{ ...S.pill("#10b981"), fontSize: 10 }}>
                          <Clock size={9} style={{ verticalAlign: "middle", marginRight: 3 }} />
                          {countdownLabel(a.appointmentDate, a.timeSlot)}
                        </span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 14 }}>Dr. {a.doctor?.name}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{a.doctor?.specialization}</div>
                      </div>
                      <span style={S.pill({ SCHEDULED:"#818cf8", CONFIRMED:"#10b981", COMPLETED:"#6b7280", CANCELLED:"#ef4444", NO_SHOW:"#f59e0b" }[a.status as string] || "#818cf8")}>{a.status}</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280" }}>
                      <span>📅 {fmt(a.appointmentDate)}</span>
                      <span>🕐 {a.timeSlot}</span>
                      <span style={S.pill("#818cf8")}>{a.type}</span>
                    </div>
                    {a.chiefComplaint && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>Complaint: {a.chiefComplaint}</div>}
                  </div>
                );
              })}
            </CollapsibleSection>
          )}

          {/* Prescriptions */}
          {patient.prescriptions?.length > 0 && (
            <CollapsibleSection title={`Prescriptions (${patient.prescriptions.length})`} icon={Clipboard} color="#10b981">
              {patient.prescriptions.map((p: any, i: number) => (
                <div key={p.id} style={{ padding: "14px 0", borderBottom: "1px solid #2a2a4a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>Prescription #{i + 1}</span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{fmt(p.createdAt)}</span>
                  </div>
                  {Array.isArray(p.medicines) && p.medicines.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", marginBottom: 6 }}>MEDICINES</div>
                      {p.medicines.map((m: any, j: number) => {
                        const dose = m.dosage ?? m.dose;
                        const note = m.note ?? m.instructions;
                        return (
                          <div key={j} style={{ background: "#10b98110", border: "1px solid #10b98120", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                            <div style={{ fontWeight: 700, color: "#d1fae5", fontSize: 13 }}>{m.name || m}</div>
                            {dose && <div style={{ fontSize: 12, color: "#6b7280" }}>
                              Dose: {dose}{m.frequency ? ` · ${m.frequency}` : ""}{m.duration ? ` · ${m.duration}` : ""}
                            </div>}
                            {note && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{note}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {p.instructions && <div style={S.row}><span style={S.label}>Instructions</span><span style={S.val}>{p.instructions}</span></div>}
                  {p.diet && <div style={S.row}><span style={S.label}>Diet</span><span style={S.val}>{p.diet}</span></div>}
                  {p.followUpDays && <div style={S.row}><span style={S.label}>Follow-up in</span><span style={S.val}>{p.followUpDays} days</span></div>}
                  {p.validUntil && <div style={{ ...S.row, borderBottom: "none" }}><span style={S.label}>Valid Until</span><span style={S.val}>{fmt(p.validUntil)}</span></div>}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* Visits */}
          {patient.visits?.length > 0 && (
            <CollapsibleSection title={`Visit History (${patient.visits.length})`} icon={Activity} color="#f59e0b" defaultOpen={false}>
              {patient.visits.map((v: any) => (
                <div key={v.id} style={{ padding: "12px 0", borderBottom: "1px solid #2a2a4a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>{fmt(v.visitDate)}</span>
                    <span style={S.pill("#f59e0b")}>{v.visitType}</span>
                  </div>
                  {v.chiefComplaint && <div style={S.row}><span style={S.label}>Complaint</span><span style={S.val}>{v.chiefComplaint}</span></div>}
                  {v.diagnosis && <div style={S.row}><span style={S.label}>Diagnosis</span><span style={S.val}>{v.diagnosis}</span></div>}
                  {(v.vitalsBP || v.vitalsTemp || v.vitalsPulse || v.vitalsWeight) && (
                    <div style={S.row}>
                      <span style={S.label}>Vitals</span>
                      <span style={S.val}>
                        {[v.vitalsBP && `BP: ${v.vitalsBP}`, v.vitalsTemp && `Temp: ${v.vitalsTemp}°C`, v.vitalsPulse && `Pulse: ${v.vitalsPulse}`, v.vitalsWeight && `Wt: ${v.vitalsWeight}kg`].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}
                  {v.followUpDate && <div style={{ ...S.row, borderBottom: "none" }}><span style={S.label}>Follow-up</span><span style={S.val}>{fmt(v.followUpDate)}</span></div>}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* Lab Reports */}
          {patient.labReports?.length > 0 && (
            <CollapsibleSection title={`Lab Reports (${patient.labReports.length})`} icon={TestTube} color="#c084fc" defaultOpen={false}>
              {patient.labReports.map((r: any) => (
                <div key={r.id} style={{ padding: "12px 0", borderBottom: "1px solid #2a2a4a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>{r.testName}</span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{fmt(r.conductedAt)}</span>
                  </div>
                  {r.testCategory && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{r.testCategory}</div>}
                  {r.normalRange && <div style={S.row}><span style={S.label}>Normal Range</span><span style={S.val}>{r.normalRange}</span></div>}
                  {r.interpretation && <div style={{ ...S.row, borderBottom: "none" }}><span style={S.label}>Interpretation</span><span style={S.val}>{r.interpretation}</span></div>}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* Empty state */}
          {!patient.appointments?.length && !patient.prescriptions?.length && !patient.visits?.length && !patient.labReports?.length && (
            <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
              <Heart size={40} color="#ef444440" style={{ margin: "0 auto 12px", display: "block" }} />
              <p style={{ color: "#6b7280", margin: 0 }}>No medical records found yet for this patient.</p>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 40, fontSize: 12, color: "#374151", textAlign: "center" }}>
        &copy; {new Date().getFullYear()} BusinessOS Health · Your data is secure and private.
      </div>
    </div>
  );
}
