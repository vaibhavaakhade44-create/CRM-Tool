import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, CheckCircle } from "lucide-react";
import api from "@/lib/api";

const S = {
  page: { minHeight:"100vh", background:"var(--bg-main)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 } as React.CSSProperties,
  card: { background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:16, padding:"40px 48px", maxWidth:440, width:"100%", boxShadow:"0 24px 80px rgba(0,0,0,0.5)" } as React.CSSProperties,
  label: { display:"block", fontSize:11, fontWeight:700, color:"var(--text-ghost)", textTransform:"uppercase" as const, letterSpacing:"0.05em", marginBottom:6 },
  inputWrap: { position:"relative" as const, marginBottom:20 },
  input: { width:"100%", background:"var(--bg-hover)", border:"1px solid var(--border-input)", borderRadius:8, padding:"10px 12px 10px 38px", color:"var(--text-primary)", fontSize:14, outline:"none", boxSizing:"border-box" as const },
  icon: { position:"absolute" as const, left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-ghost)" },
  btn: { width:"100%", height:46, borderRadius:10, border:"none", cursor:"pointer", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"white", fontSize:15, fontWeight:700 } as React.CSSProperties,
  err: { background:"#ef444420", border:"1px solid #ef444440", borderRadius:8, padding:"10px 14px", color:"#ef4444", fontSize:13, marginBottom:16 },
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email) { setError("Please enter your email address."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (e: any) { setError(e?.response?.data?.message || "Something went wrong."); }
    setLoading(false);
  };

  if (sent) return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign:"center" as const }}>
        <CheckCircle size={48} color="#10b981" style={{ margin:"0 auto 16px", display:"block" }}/>
        <h2 style={{ fontSize:20, fontWeight:700, color:"var(--text-primary)", margin:"0 0 8px" }}>Check your inbox</h2>
        <p style={{ fontSize:14, color:"var(--text-ghost)", lineHeight:1.6 }}>
          If <strong style={{ color:"var(--text-sec)" }}>{email}</strong> is registered, you'll receive a password reset link shortly.
        </p>
        <Link to="/login" style={{ display:"block", marginTop:24, fontSize:13, color:"#818cf8", textDecoration:"none" }}>← Back to Login</Link>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", marginBottom:24, boxShadow:"0 8px 28px rgba(99,102,241,0.4)" }}>
          <span style={{ color:"white", fontWeight:800, fontSize:14 }}>BO</span>
        </div>
        <h2 style={{ fontSize:22, fontWeight:700, color:"var(--text-primary)", margin:"0 0 6px" }}>Forgot Password?</h2>
        <p style={{ fontSize:14, color:"var(--text-ghost)", marginBottom:28 }}>Enter your email and we'll send you a reset link.</p>

        {error && <div style={S.err}>{error}</div>}

        <label style={S.label}>Email Address</label>
        <div style={S.inputWrap}>
          <Mail size={15} style={S.icon}/>
          <input type="email" style={S.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" onKeyDown={e => e.key === "Enter" && submit()}/>
        </div>

        <button onClick={submit} style={S.btn} disabled={loading}>
          {loading ? "Sending…" : "Send Reset Link"}
        </button>
        <div style={{ textAlign:"center", marginTop:16 }}>
          <Link to="/login" style={{ fontSize:13, color:"var(--text-ghost)", textDecoration:"none" }}>← Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
