import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Shield, Mail, Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/api";
import type { AuthResponse } from "@/types";

// All styles are hardcoded (no CSS vars) — this page is outside the app theme context
const C = {
  bg:          "#080812",
  card:        "#0e0e1f",
  border:      "#1e1e35",
  inputBg:     "#13132a",
  inputBorder: "#252540",
  text:        "#e8e8f8",
  textSub:     "#8888aa",
  textFaint:   "#44445a",
  red:         "#ef4444",
  redDim:      "#dc262620",
};

export default function SuperAdminLoginPage() {
  const navigate   = useNavigate();
  const { setAuth, isAuthenticated, user } = useAuthStore();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  if (isAuthenticated && user?.isSuperAdmin) {
    return <Navigate to="/super-admin/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email and password are required."); return; }
    setLoading(true); setError("");
    try {
      const res = await api.post<{ data: AuthResponse }>("/auth/login", { email, password });
      const authData = res.data.data;
      if (!authData.user.isSuperAdmin) {
        await api.post("/auth/logout").catch(() => {});
        setError("Access denied. This portal is for platform administrators only.");
        setLoading(false);
        return;
      }
      setAuth(authData);
      navigate("/super-admin/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Invalid credentials.");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient glows */}
      <div style={{ position: "fixed", top: "10%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(239,68,68,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-15%", right: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>

        {/* Brand header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, #dc2626, #7f1d1d)",
            marginBottom: 14,
            boxShadow: "0 0 40px rgba(220,38,38,0.3), 0 8px 24px rgba(0,0,0,0.5)",
          }}>
            <Shield size={24} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 4px", letterSpacing: "-0.4px" }}>
            Platform Administration
          </h1>
          <p style={{ fontSize: 12, color: C.textSub, margin: 0, letterSpacing: "0.04em" }}>
            BusinessOS · Super Admin Portal
          </p>
        </div>

        {/* Restricted access notice */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          background: "rgba(239,68,68,0.07)",
          border: "1px solid rgba(239,68,68,0.18)",
          borderRadius: 10, padding: "11px 14px", marginBottom: 20,
        }}>
          <AlertTriangle size={13} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#f87171", margin: 0, lineHeight: 1.55, opacity: 0.85 }}>
            <strong style={{ opacity: 1 }}>Restricted Access.</strong> Exclusively for authorized platform administrators. All access attempts are logged.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: "28px 28px 24px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        }}>
          {error && (
            <div style={{
              marginBottom: 18, padding: "10px 14px",
              background: "rgba(239,68,68,0.09)", border: "1px solid rgba(239,68,68,0.22)",
              borderRadius: 8, fontSize: 13, color: "#f87171",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Email */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                  Admin Email
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textFaint, pointerEvents: "none" }} />
                  <input
                    type="email"
                    autoComplete="username"
                    placeholder="admin@platform.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{
                      width: "100%",
                      background: C.inputBg,
                      border: `1px solid ${C.inputBorder}`,
                      borderRadius: 9,
                      padding: "11px 12px 11px 38px",
                      color: C.text,
                      fontSize: 14,
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border-color 0.15s",
                      fontFamily: "inherit",
                    }}
                    onFocus={e => (e.target.style.borderColor = "#dc2626")}
                    onBlur={e => (e.target.style.borderColor = C.inputBorder)}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <Lock size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textFaint, pointerEvents: "none" }} />
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{
                      width: "100%",
                      background: C.inputBg,
                      border: `1px solid ${C.inputBorder}`,
                      borderRadius: 9,
                      padding: "11px 42px 11px 38px",
                      color: C.text,
                      fontSize: 14,
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border-color 0.15s",
                      fontFamily: "inherit",
                    }}
                    onFocus={e => (e.target.style.borderColor = "#dc2626")}
                    onBlur={e => (e.target.style.borderColor = C.inputBorder)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.textSub, cursor: "pointer", padding: 2, display: "flex", lineHeight: 0 }}
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 10,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  background: loading
                    ? "rgba(220,38,38,0.25)"
                    : "linear-gradient(135deg, #dc2626, #991b1b)",
                  color: loading ? "rgba(255,255,255,0.5)" : "white",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  boxShadow: loading ? "none" : "0 4px 20px rgba(220,38,38,0.3)",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "inherit",
                }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                    Verifying…
                  </>
                ) : (
                  <>
                    <Shield size={14} />
                    Sign in to Admin Portal
                  </>
                )}
              </button>

            </div>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: C.textFaint, marginTop: 18, lineHeight: 1.6 }}>
          Organization login?{" "}
          <a href="/login" style={{ color: C.textSub, textDecoration: "none", fontWeight: 500 }}>Click here</a>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
