import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail, Lock, Eye, EyeOff, Stethoscope, ArrowLeft,
  User, Search, Heart, ArrowRight, AlertTriangle,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/api";
import { getApiError } from "@/lib/utils";
import type { AuthResponse } from "@/types";

const schema = z.object({
  email:    z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

type Tab = "doctor" | "patient";

export default function HealthPortalLoginPage() {
  const navigate         = useNavigate();
  const setAuth          = useAuthStore((s) => s.setAuth);
  const setActiveOrg     = useAuthStore((s) => s.setActiveOrg);
  const loadModuleAccess = useAuthStore((s) => s.loadModuleAccess);

  const [tab,      setTab]      = useState<Tab>("doctor");
  const [showPw,   setShowPw]   = useState(false);
  const [apiError, setApiError] = useState("");
  const [ptCode,   setPtCode]   = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // ── Doctor login ─────────────────────────────────────────
  async function onDoctorLogin(values: FormData) {
    setApiError("");
    try {
      const { data } = await api.post<{ data: AuthResponse }>("/auth/login", values);
      const auth = data.data;
      setAuth(auth);

      // Find health org
      const healthOrg = auth.organizations.find(o => o.enabledModules?.includes("HEALTH"))
        ?? auth.organizations[0];
      if (healthOrg) setActiveOrg(healthOrg);

      await loadModuleAccess();

      // Check if this user has a linked doctor profile
      try {
        await api.get("/health/my-doctor-profile");
        navigate("/health-portal/doctor", { replace: true });
      } catch {
        // Not a doctor → send to full health panel (admin/staff)
        navigate("/health", { replace: true });
      }
    } catch (e) {
      setApiError(getApiError(e));
    }
  }

  // ── Patient code lookup ──────────────────────────────────
  function goToPatientPortal() {
    const code = ptCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/patient-portal?code=${encodeURIComponent(code)}&orgSlug=city-care-clinic`);
  }

  // ── Styles ───────────────────────────────────────────────
  const C = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(160deg,#064e3b 0%,#065f46 40%,#0f766e 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px", fontFamily: "system-ui,-apple-system,sans-serif",
    } as React.CSSProperties,
    wrap: { width: "100%", maxWidth: 440 } as React.CSSProperties,
    logo: {
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 12, marginBottom: 28,
    } as React.CSSProperties,
    logoBox: {
      width: 52, height: 52, borderRadius: 14,
      background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
    } as React.CSSProperties,
    card: {
      background: "white", borderRadius: 20, overflow: "hidden",
      boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
    } as React.CSSProperties,
    tabRow: {
      display: "grid", gridTemplateColumns: "1fr 1fr",
      background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
    } as React.CSSProperties,
    tab: (active: boolean) => ({
      padding: "14px 0", textAlign: "center" as const,
      fontWeight: 700, fontSize: 13, cursor: "pointer",
      border: "none", background: active ? "white" : "transparent",
      color: active ? "#0f766e" : "#6b7280",
      borderBottom: active ? "2px solid #0f766e" : "2px solid transparent",
      transition: "all 0.15s",
    }),
    body: { padding: "28px 28px 24px" } as React.CSSProperties,
    label: { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 } as React.CSSProperties,
    inputWrap: { position: "relative" as const, marginBottom: 16 } as React.CSSProperties,
    input: {
      width: "100%", padding: "10px 40px 10px 38px",
      borderRadius: 9, border: "1.5px solid #e2e8f0",
      fontSize: 14, color: "#0f172a", background: "#f8fafc",
      outline: "none", boxSizing: "border-box" as const,
    } as React.CSSProperties,
    iconL: { position: "absolute" as const, left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" as const },
    iconR: { position: "absolute" as const, right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" },
    err: { fontSize: 11, color: "#ef4444", marginTop: -10, marginBottom: 10 } as React.CSSProperties,
    apiErr: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
    btn: { width: "100%", padding: "12px 0", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#0f766e,#10b981)", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px #0f766e30", transition: "opacity 0.15s" } as React.CSSProperties,
    divider: { display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" } as React.CSSProperties,
    demoBox: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px" } as React.CSSProperties,
  };

  return (
    <div style={C.page}>
      <div style={C.wrap}>
        {/* Logo */}
        <div style={C.logo}>
          <div style={C.logoBox}>
            <Stethoscope size={26} color="white" strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "white" }}>Health Portal</div>
            <div style={{ fontSize: 12, color: "#a7f3d0", marginTop: 2 }}>City Care Clinic</div>
          </div>
        </div>

        <div style={C.card}>
          {/* Tabs */}
          <div style={C.tabRow}>
            <button style={C.tab(tab === "doctor")} onClick={() => { setTab("doctor"); setApiError(""); }}>
              <Stethoscope size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Doctor / Staff
            </button>
            <button style={C.tab(tab === "patient")} onClick={() => { setTab("patient"); setApiError(""); }}>
              <User size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />
              Patient Portal
            </button>
          </div>

          <div style={C.body}>
            {/* ── Doctor Login ── */}
            {tab === "doctor" && (
              <>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>
                  Sign in with your clinic email to view your appointments and patient records.
                </p>

                <form onSubmit={handleSubmit(onDoctorLogin)} noValidate>
                  <div style={C.inputWrap}>
                    <label style={C.label}>Email address</label>
                    <div style={{ position: "relative" }}>
                      <span style={C.iconL}><Mail size={15} color="#94a3b8" /></span>
                      <input {...register("email")} type="email" placeholder="priya.sharma@citycare.demo" style={C.input} />
                    </div>
                    {errors.email && <div style={C.err}>{errors.email.message}</div>}
                  </div>

                  <div style={C.inputWrap}>
                    <label style={C.label}>Password</label>
                    <div style={{ position: "relative" }}>
                      <span style={C.iconL}><Lock size={15} color="#94a3b8" /></span>
                      <input {...register("password")} type={showPw ? "text" : "password"} placeholder="••••••••" style={C.input} />
                      <button type="button" style={C.iconR} onClick={() => setShowPw(p => !p)}>
                        {showPw ? <EyeOff size={15} color="#94a3b8" /> : <Eye size={15} color="#94a3b8" />}
                      </button>
                    </div>
                    {errors.password && <div style={C.err}>{errors.password.message}</div>}
                  </div>

                  {apiError && (
                    <div style={C.apiErr}>
                      <AlertTriangle size={14} />{apiError}
                    </div>
                  )}

                  <button type="submit" disabled={isSubmitting} style={{ ...C.btn, opacity: isSubmitting ? 0.7 : 1 }}>
                    {isSubmitting ? "Signing in…" : "Sign In →"}
                  </button>
                </form>

                <div style={C.divider}>
                  <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>DEMO DOCTORS</span>
                  <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                </div>

                <div style={C.demoBox}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                    10 Doctors — all use password: Doctor@123
                  </div>
                  <div className="grid-r2" style={{ gap: "3px 8px" }}>
                    {[
                      ["priya.sharma","General Medicine"],
                      ["rajesh.patel","Cardiology"],
                      ["anita.singh","Gynecology"],
                      ["suresh.mehta","Orthopedics"],
                      ["kavita.rao","Dermatology"],
                      ["arun.nair","Neurology"],
                      ["deepa.joshi","Pediatrics"],
                      ["vinod.sharma","Ophthalmology"],
                      ["neha.gupta","ENT"],
                      ["sanjay.patel","Psychiatry"],
                    ].map(([slug, spec]) => (
                      <div key={slug} style={{ fontSize: 11, color: "#374151", padding: "2px 0" }}>
                        <span style={{ color: "#0f766e", fontWeight: 600 }}>{slug}</span>
                        <span style={{ color: "#6b7280" }}>@citycare.demo</span>
                        <div style={{ fontSize: 10, color: "#9ca3af" }}>{spec}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280", borderTop: "1px solid #bbf7d0", paddingTop: 8 }}>
                    Admin: <b style={{ color: "#0f766e" }}>admin@citycare.demo</b> / Clinic@123
                  </div>
                </div>
              </>
            )}

            {/* ── Patient Portal ── */}
            {tab === "patient" && (
              <>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>
                  Enter your Patient Code to view your appointments, prescriptions and medical records — no login needed.
                </p>

                <div style={{ marginBottom: 16 }}>
                  <label style={C.label}>Your Patient Code</label>
                  <div style={{ position: "relative" }}>
                    <span style={C.iconL}><User size={15} color="#94a3b8" /></span>
                    <input
                      type="text"
                      value={ptCode}
                      onChange={e => setPtCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && goToPatientPortal()}
                      placeholder="PT-00001"
                      style={{ ...C.input, textTransform: "uppercase" as const, letterSpacing: "0.1em", fontWeight: 700 }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                    Your Patient Code was given to you during registration (format: PT-XXXXX).
                  </div>
                </div>

                <button
                  onClick={goToPatientPortal}
                  disabled={!ptCode.trim()}
                  style={{ ...C.btn, opacity: ptCode.trim() ? 1 : 0.5, cursor: ptCode.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <Search size={16} /> View My Records
                </button>

                <div style={C.divider}>
                  <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>DEMO PATIENTS</span>
                  <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                </div>

                <div style={C.demoBox}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                    Try these patient codes
                  </div>
                  <div className="grid-r2" style={{ gap: "4px 12px" }}>
                    {[
                      ["PT-00001","Amit Gupta"],["PT-00002","Sunita Devi"],
                      ["PT-00003","Raju Kumar"],["PT-00004","Meena Shah"],
                      ["PT-00005","Vikram Joshi"],["PT-00006","Geeta Krishnan"],
                      ["PT-00007","Arjun Shah"],["PT-00008","Rekha Pandey"],
                      ["PT-00009","Mohan Lal"],["PT-00010","Baby Rohan"],
                    ].map(([code, name]) => (
                      <button
                        key={code}
                        onClick={() => { setPtCode(code); }}
                        style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left" as const, padding: "3px 0" }}
                      >
                        <span style={{ fontSize: 11, color: "#0f766e", fontWeight: 700 }}>{code}</span>
                        <span style={{ fontSize: 10, color: "#6b7280", display: "block" }}>{name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
                  <Heart size={13} color="#f59e0b" />
                  <span style={{ fontSize: 12, color: "#92400e" }}>Your medical data is private and secure. Only you can access it with your code.</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#a7f3d0", textDecoration: "none" }}>
            <ArrowLeft size={13} /> Back to main site
          </Link>
          <span style={{ color: "#5b8f7a", margin: "0 10px" }}>·</span>
          <Link to="/health" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#a7f3d0", textDecoration: "none" }}>
            Admin Panel <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
