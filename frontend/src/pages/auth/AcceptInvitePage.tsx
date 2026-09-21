import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, CheckCircle, XCircle, Loader, User, Lock, Eye, EyeOff } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { getApiError } from "@/lib/utils";
import type { AuthResponse } from "@/types";

const S = {
  page: { minHeight: "100vh", background: "var(--bg-main)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "36px 40px", maxWidth: 440, width: "100%", textAlign: "center" as const, boxShadow: "0 24px 80px rgba(0,0,0,0.5)" },
  btn: { width: "100%", height: 44, borderRadius: 10, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 14, fontWeight: 600, marginTop: 20 } as React.CSSProperties,
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, textAlign: "left" as const } as React.CSSProperties,
  inputWrap: { position: "relative" as const, marginBottom: 14 },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 9, padding: "10px 36px 10px 38px", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" } as React.CSSProperties,
  icon: { position: "absolute" as const, left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)", display: "flex" },
  eyeBtn: { position: "absolute" as const, right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)", display: "flex", padding: 0 },
};

interface InviteInfo {
  orgName: string;
  inviterName: string;
  role: string;
  email: string;
}

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, addOrganization, setAuth } = useAuthStore();

  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "ready" | "accepting" | "success" | "error">("loading");
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // ── New-account creation (for invitees with no existing BusinessOS account) ──
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [fieldErr, setFieldErr] = useState<{ name?: string; password?: string; confirmPassword?: string }>({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("error"); setErrorMsg("Invalid invite link — no token found."); return; }
    // Fetch invite details
    api.get(`/organizations/invite/info?token=${token}`)
      .then(r => { setInvite(r.data.data); setStatus("ready"); })
      .catch(e => { setStatus("error"); setErrorMsg(e?.response?.data?.message || "This invite link is invalid or has expired."); });
  }, [token]);

  const accept = async () => {
    if (!isAuthenticated) {
      // Save token and redirect to login
      sessionStorage.setItem("pendingInviteToken", token!);
      navigate(`/login?redirect=/accept-invite?token=${token}`);
      return;
    }
    setStatus("accepting");
    try {
      const r = await api.post("/organizations/invite/accept", { token });
      const org = r.data.data;
      addOrganization({ ...org.organization, role: org.role, enabledModules: org.organization?.enabledModules || [] });
      setStatus("success");
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e?.response?.data?.message || "Failed to accept invite. It may have expired.");
    }
  };

  function validateNewAccount(): boolean {
    const errs: typeof fieldErr = {};
    if (!name.trim() || name.trim().length < 2) errs.name = "Name must be at least 2 characters";
    if (password.length < 8) errs.password = "Password must be at least 8 characters";
    else if (!/[A-Z]/.test(password)) errs.password = "Must contain an uppercase letter";
    else if (!/[0-9]/.test(password)) errs.password = "Must contain a number";
    else if (!/[^A-Za-z0-9]/.test(password)) errs.password = "Must contain a special character";
    if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  }

  const createAccount = async () => {
    if (!validateNewAccount()) return;
    setCreating(true);
    setErrorMsg("");
    try {
      const r = await api.post("/organizations/invite/register", { token, name: name.trim(), password });
      setAuth(r.data.data as AuthResponse);
      setStatus("success");
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (e: any) {
      setErrorMsg(getApiError(e));
    }
    setCreating(false);
  };

  const ROLE_LABELS: Record<string, string> = {
    OWNER: "Owner", ADMIN: "Admin", MANAGER: "Manager",
    ACCOUNTANT: "Accountant", STAFF: "Staff", VIEWER: "Viewer",
  };

  return (
    <div style={S.page}>
      {/* Glow */}
      <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={S.card}>
        {/* Logo */}
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", marginBottom: 20, boxShadow: "0 8px 28px rgba(99,102,241,0.4)" }}>
          <span style={{ color: "white", fontWeight: 800, fontSize: 14 }}>BO</span>
        </div>

        {status === "loading" && (
          <>
            <Loader size={32} color="#6366f1" style={{ margin: "0 auto 16px", display: "block", animation: "spin 1s linear infinite" }} />
            <p style={{ color: "var(--text-ghost)", fontSize: 14 }}>Loading invite details...</p>
          </>
        )}

        {status === "ready" && invite && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg,#6366f120,#8b5cf620)", border: "1px solid #6366f130", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Building2 size={24} color="#818cf8" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>You're Invited!</h2>
            <p style={{ fontSize: 14, color: "var(--text-ghost)", margin: "0 0 24px", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--text-sec)" }}>{invite.inviterName}</strong> invited you to join
            </p>
            <div style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{invite.orgName}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#6366f120", color: "#818cf8", fontWeight: 600 }}>
                  {ROLE_LABELS[invite.role] || invite.role}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-ghost)" }}>on BusinessOS</span>
              </div>
            </div>
            {isAuthenticated ? (
              <>
                <button onClick={accept} style={S.btn}>Accept & Join Organization</button>
                <button onClick={() => navigate("/dashboard")} style={{ background: "none", border: "none", color: "var(--text-ghost)", fontSize: 12, cursor: "pointer", marginTop: 12, width: "100%" }}>
                  Decline
                </button>
              </>
            ) : mode === "create" ? (
              <>
                <div style={{ ...S.inputWrap, marginBottom: 10 }}>
                  <label style={S.label}>Email</label>
                  <div style={{ position: "relative" }}>
                    <input value={invite.email} disabled style={{ ...S.input, opacity: 0.6, cursor: "not-allowed" }} />
                  </div>
                </div>
                <div style={S.inputWrap}>
                  <label style={S.label}>Your Name</label>
                  <div style={{ position: "relative" }}>
                    <span style={S.icon}><User size={15} /></span>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={S.input} />
                  </div>
                  {fieldErr.name && <p style={{ fontSize: 12, color: "#f87171", marginTop: 4, textAlign: "left" }}>{fieldErr.name}</p>}
                </div>
                <div style={S.inputWrap}>
                  <label style={S.label}>Set a Password</label>
                  <div style={{ position: "relative" }}>
                    <span style={S.icon}><Lock size={15} /></span>
                    <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Min 8 chars, uppercase, number, symbol" style={S.input} />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={S.eyeBtn}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>
                  {fieldErr.password && <p style={{ fontSize: 12, color: "#f87171", marginTop: 4, textAlign: "left" }}>{fieldErr.password}</p>}
                </div>
                <div style={S.inputWrap}>
                  <label style={S.label}>Confirm Password</label>
                  <div style={{ position: "relative" }}>
                    <span style={S.icon}><Lock size={15} /></span>
                    <input type={showPw ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password" style={S.input} />
                  </div>
                  {fieldErr.confirmPassword && <p style={{ fontSize: 12, color: "#f87171", marginTop: 4, textAlign: "left" }}>{fieldErr.confirmPassword}</p>}
                </div>
                {errorMsg && (
                  <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 8, fontSize: 13, color: "#f87171", marginBottom: 4, textAlign: "left" }}>
                    {errorMsg}
                  </div>
                )}
                <button onClick={createAccount} disabled={creating} style={{ ...S.btn, opacity: creating ? 0.7 : 1 }}>
                  {creating ? "Creating account…" : "Create Account & Join"}
                </button>
                <button onClick={() => { setMode("existing"); setErrorMsg(""); }} style={{ background: "none", border: "none", color: "#818cf8", fontSize: 12, cursor: "pointer", marginTop: 12, width: "100%", fontWeight: 600 }}>
                  Already have a BusinessOS account? Log in instead
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "var(--text-ghost)", marginBottom: 4 }}>You'll log in, then come back to accept this invite.</p>
                <button onClick={accept} style={S.btn}>Log in to Accept Invite</button>
                <button onClick={() => { setMode("create"); setErrorMsg(""); }} style={{ background: "none", border: "none", color: "#818cf8", fontSize: 12, cursor: "pointer", marginTop: 12, width: "100%", fontWeight: 600 }}>
                  ← New here? Create an account instead
                </button>
              </>
            )}
          </>
        )}

        {status === "accepting" && (
          <>
            <Loader size={32} color="#6366f1" style={{ margin: "0 auto 16px", display: "block" }} />
            <p style={{ color: "var(--text-ghost)", fontSize: 14 }}>Joining organization...</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle size={48} color="#10b981" style={{ margin: "0 auto 16px", display: "block" }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>Welcome aboard!</h2>
            <p style={{ fontSize: 14, color: "var(--text-ghost)" }}>You've successfully joined <strong style={{ color: "var(--text-sec)" }}>{invite?.orgName}</strong>. Redirecting...</p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle size={48} color="#ef4444" style={{ margin: "0 auto 16px", display: "block" }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>Invite Invalid</h2>
            <p style={{ fontSize: 14, color: "var(--text-ghost)", marginBottom: 20 }}>{errorMsg}</p>
            <button onClick={() => navigate("/login")} style={S.btn}>Go to Login</button>
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
