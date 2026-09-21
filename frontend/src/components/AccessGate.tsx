import { useState } from "react";
import { Lock, Send, CheckCircle } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { ALL_MODULES } from "@/lib/modules";

interface Props {
  moduleKey: string;
  children: React.ReactNode;
}

export default function AccessGate({ moduleKey, children }: Props) {
  const { moduleAccess } = useAuthStore();
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const mod = ALL_MODULES.find((m) => m.key === moduleKey);

  // moduleAccess already equals the org's enabledModules for OWNER/ADMIN (see
  // authStore.setAuth / syncModulesFromOrg) — so this one check is correct for
  // every role. It must NOT also bypass for isAdmin: that would let an
  // OWNER/ADMIN reach a module the org never enabled, just by knowing the URL.
  if (moduleAccess.includes(moduleKey)) {
    return <>{children}</>;
  }

  const sendRequest = async () => {
    setSending(true);
    try {
      await api.post("/access/request", { moduleKey, message });
      setSubmitted(true);
    } catch { /* already requested — treat as submitted */ setSubmitted(true); }
    setSending(false);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: 32 }}>
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        {/* Lock icon */}
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Lock size={28} color="#6366f1" />
        </div>

        {submitted ? (
          <>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#10b98120", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle size={24} color="#10b981" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>Request Sent!</h2>
            <p style={{ fontSize: 14, color: "var(--text-ghost)" }}>
              Your request to access <strong style={{ color: "#818cf8" }}>{mod?.label || moduleKey}</strong> has been sent to your organization admin.
              You'll get access once they approve it.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>Access Required</h2>
            <p style={{ fontSize: 14, color: "var(--text-ghost)", marginBottom: 24 }}>
              You don't have access to <strong style={{ color: "#818cf8" }}>{mod?.label || moduleKey}</strong>.
              Send a request to your organization admin to get access.
            </p>
            {mod?.description && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Module</div>
                <div style={{ fontSize: 13, color: "var(--text-sec)" }}>{mod.description}</div>
              </div>
            )}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Why do you need access? (optional)"
              style={{ width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", resize: "vertical", minHeight: 80, boxSizing: "border-box", marginBottom: 16 }}
            />
            <button
              onClick={sendRequest}
              disabled={sending}
              style={{ width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "11px 20px", borderRadius: 8, cursor: sending ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Send size={15} />
              {sending ? "Sending..." : "Request Access"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
