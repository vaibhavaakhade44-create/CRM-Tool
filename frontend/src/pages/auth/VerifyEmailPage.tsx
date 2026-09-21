import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import api from "@/lib/api";

const S = {
  page: { minHeight: "100vh", background: "var(--bg-main)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "40px 48px", maxWidth: 440, width: "100%", textAlign: "center" as const, boxShadow: "0 24px 80px rgba(0,0,0,0.5)" },
  btn: { width: "100%", height: 44, borderRadius: 10, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: 14, fontWeight: 600, marginTop: 20 } as React.CSSProperties,
};

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading"|"success"|"error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("No verification token found in link."); return; }
    api.get(`/auth/verify-email?token=${token}`)
      .then(r => { setStatus("success"); setMessage(r.data.message || "Email verified successfully!"); })
      .catch(e => { setStatus("error"); setMessage(e?.response?.data?.message || "Invalid or expired verification link."); });
  }, [token]);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", marginBottom:24, boxShadow:"0 8px 28px rgba(99,102,241,0.4)" }}>
          <span style={{ color:"white", fontWeight:800, fontSize:14 }}>BO</span>
        </div>

        {status === "loading" && (
          <>
            <Loader size={36} color="#6366f1" style={{ margin:"0 auto 16px", display:"block", animation:"spin 1s linear infinite" }}/>
            <p style={{ color:"var(--text-ghost)", fontSize:14 }}>Verifying your email…</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle size={48} color="#10b981" style={{ margin:"0 auto 16px", display:"block" }}/>
            <h2 style={{ fontSize:20, fontWeight:700, color:"var(--text-primary)", margin:"0 0 8px" }}>Email Verified!</h2>
            <p style={{ fontSize:14, color:"var(--text-ghost)", marginBottom:4 }}>{message}</p>
            <button onClick={() => navigate("/login")} style={S.btn}>Continue to Login</button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle size={48} color="#ef4444" style={{ margin:"0 auto 16px", display:"block" }}/>
            <h2 style={{ fontSize:20, fontWeight:700, color:"var(--text-primary)", margin:"0 0 8px" }}>Verification Failed</h2>
            <p style={{ fontSize:14, color:"var(--text-ghost)", marginBottom:4 }}>{message}</p>
            <button onClick={() => navigate("/login")} style={S.btn}>Go to Login</button>
          </>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
