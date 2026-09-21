import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import api from "@/lib/api";

const S = {
  page: { minHeight:"100vh", background:"var(--bg-main)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 } as React.CSSProperties,
  card: { background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:16, padding:"40px 48px", maxWidth:440, width:"100%", boxShadow:"0 24px 80px rgba(0,0,0,0.5)" } as React.CSSProperties,
  label: { display:"block", fontSize:11, fontWeight:700, color:"var(--text-ghost)", textTransform:"uppercase" as const, letterSpacing:"0.05em", marginBottom:6 },
  inputWrap: { position:"relative" as const, marginBottom:16 },
  input: { width:"100%", background:"var(--bg-hover)", border:"1px solid var(--border-input)", borderRadius:8, padding:"10px 40px 10px 38px", color:"var(--text-primary)", fontSize:14, outline:"none", boxSizing:"border-box" as const },
  icon: { position:"absolute" as const, left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-ghost)" },
  btn: { width:"100%", height:46, borderRadius:10, border:"none", cursor:"pointer", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"white", fontSize:15, fontWeight:700, marginTop:4 } as React.CSSProperties,
  err: { background:"#ef444420", border:"1px solid #ef444440", borderRadius:8, padding:"10px 14px", color:"#ef4444", fontSize:13, marginBottom:16 },
};

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!token) { setError("Invalid reset link."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (e: any) { setError(e?.response?.data?.message || "Failed to reset password."); }
    setLoading(false);
  };

  if (!token) return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign:"center" as const }}>
        <h2 style={{ color:"#ef4444", fontSize:18, fontWeight:700 }}>Invalid Link</h2>
        <p style={{ color:"var(--text-ghost)", fontSize:14, marginTop:8 }}>This password reset link is invalid or has expired.</p>
        <button onClick={() => navigate("/login")} style={{ ...S.btn, marginTop:20 }}>Back to Login</button>
      </div>
    </div>
  );

  if (done) return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign:"center" as const }}>
        <CheckCircle size={48} color="#10b981" style={{ margin:"0 auto 16px", display:"block" }}/>
        <h2 style={{ fontSize:20, fontWeight:700, color:"var(--text-primary)", margin:"0 0 8px" }}>Password Reset!</h2>
        <p style={{ color:"var(--text-ghost)", fontSize:14, marginBottom:4 }}>Your password has been updated. Please log in with your new password.</p>
        <button onClick={() => navigate("/login")} style={S.btn}>Continue to Login</button>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", marginBottom:24, boxShadow:"0 8px 28px rgba(99,102,241,0.4)" }}>
          <span style={{ color:"white", fontWeight:800, fontSize:14 }}>BO</span>
        </div>
        <h2 style={{ fontSize:22, fontWeight:700, color:"var(--text-primary)", margin:"0 0 6px" }}>Set New Password</h2>
        <p style={{ fontSize:14, color:"var(--text-ghost)", marginBottom:28 }}>Choose a strong password for your account.</p>

        {error && <div style={S.err}>{error}</div>}

        <label style={S.label}>New Password</label>
        <div style={S.inputWrap}>
          <Lock size={15} style={S.icon}/>
          <input type={show ? "text" : "password"} style={S.input} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters"/>
          <button type="button" onClick={() => setShow(p => !p)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"var(--text-ghost)", cursor:"pointer" }}>
            {show ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        </div>

        <label style={S.label}>Confirm Password</label>
        <div style={S.inputWrap}>
          <Lock size={15} style={S.icon}/>
          <input type={show ? "text" : "password"} style={S.input} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password"/>
        </div>

        <button onClick={submit} style={S.btn} disabled={loading}>
          {loading ? "Resetting…" : "Reset Password"}
        </button>
        <button onClick={() => navigate("/login")} style={{ width:"100%", background:"none", border:"none", color:"var(--text-ghost)", fontSize:13, cursor:"pointer", marginTop:12 }}>
          Back to Login
        </button>
      </div>
    </div>
  );
}
