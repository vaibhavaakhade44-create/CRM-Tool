import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 20, padding: 40, background: "var(--bg-main)", textAlign: "center" }}>
      <div style={{ fontSize: 80, fontWeight: 900, color: "var(--border)", lineHeight: 1 }}>404</div>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>Page not found</h2>
        <p style={{ fontSize: 14, color: "var(--text-ghost)", margin: 0, maxWidth: 380, lineHeight: 1.6 }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-sec)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}
        >
          <ArrowLeft size={15} /> Go Back
        </button>
        <button
          onClick={() => navigate(isAuthenticated ? "/dashboard" : "/")}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          <Home size={15} /> {isAuthenticated ? "Go to Dashboard" : "Go Home"}
        </button>
      </div>
    </div>
  );
}
