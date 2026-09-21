import { useState } from "react";
import { X, User, Mail, Phone, Building2, Users, MessageSquare, CheckCircle, Send } from "lucide-react";
import api from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { kPhone } from "@/lib/fieldRules";

interface Props {
  onClose: () => void;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  organization: string;
  teamSize: string;
  message: string;
}

const TEAM_SIZES = ["Just me", "2–5", "6–15", "16–50", "50+"];

const FIELD: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-hover)",
  border: "1px solid var(--border-input)",
  borderRadius: 8,
  padding: "10px 12px 10px 38px",
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-ghost)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  marginBottom: 5,
};

function Field({
  label, icon, error, children,
}: { label: string; icon: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)", display: "flex", pointerEvents: "none" }}>
          {icon}
        </span>
        {children}
      </div>
      {error && <p style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>{error}</p>}
    </div>
  );
}

export default function ContactModal({ onClose }: Props) {
  const [form, setForm] = useState<FormState>({
    name: "", email: "", phone: "", organization: "", teamSize: "", message: "",
  });
  const [errors, setErrors]   = useState<Partial<FormState>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [apiError, setApiError] = useState("");

  function set(key: keyof FormState, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: "" }));
  }

  function validate(): boolean {
    const e: Partial<FormState> = {};
    if (!form.name.trim() || form.name.length < 2)   e.name = "Enter your full name";
    if (!/\S+@\S+\.\S+/.test(form.email))            e.email = "Enter a valid email address";
    if (!form.phone.trim() || form.phone.length < 7) e.phone = "Enter a valid phone number";
    if (!form.organization.trim())                   e.organization = "Enter your organisation name";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError("");
    try {
      await api.post("/contact", form);
      setDone(true);
    } catch (err) {
      setApiError(getApiError(err));
    }
    setLoading(false);
  }

  // ── Success screen ──────────────────────────────────────────
  if (done) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ textAlign: "center", padding: "48px 32px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <CheckCircle size={32} color="#10b981" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" }}>
            Request Received!
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-faint)", lineHeight: 1.7, maxWidth: 340, marginInline: "auto", marginBottom: 28 }}>
            Thanks! Our team will review your request and reach out within <strong style={{ color: "var(--text-sec)" }}>1–2 business days</strong> to set up your account.
          </p>
          <p style={{ fontSize: 13, color: "var(--text-ghost)", marginBottom: 28 }}>
            Check your inbox — we've sent a confirmation to <strong style={{ color: "var(--text-sec)" }}>{form.email}</strong>.
          </p>
          <button
            onClick={onClose}
            style={{ padding: "11px 32px", borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </Overlay>
    );
  }

  // ── Form ────────────────────────────────────────────────────
  return (
    <Overlay onClose={onClose}>
      {/* Header */}
      <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>
            Request an Account
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-faint)", margin: 0, lineHeight: 1.5 }}>
            Fill in the details below and our team will contact you to set up your organisation on BusinessOS.
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-hover)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <X size={16} color="var(--text-ghost)" />
        </button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} style={{ padding: "24px 28px 28px" }}>
        {apiError && (
          <div style={{ marginBottom: 18, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 13, color: "#f87171" }}>
            {apiError}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Name */}
          <Field label="Full Name *" icon={<User size={15} />} error={errors.name}>
            <input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="Rahul Sharma"
              style={FIELD}
            />
          </Field>

          {/* Email + Phone — side by side on wider screens */}
          <div className="grid-r2" style={{ gap: 12 }}>
            <Field label="Email Address *" icon={<Mail size={15} />} error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="you@company.com"
                style={FIELD}
              />
            </Field>
            <Field label="Phone Number *" icon={<Phone size={15} />} error={errors.phone}>
              <input
                type="tel"
                value={form.phone}
                onChange={e => set("phone", e.target.value)}
                onKeyDown={kPhone}
                maxLength={15}
                placeholder="+91 98765 43210"
                style={FIELD}
              />
            </Field>
          </div>

          {/* Organisation */}
          <Field label="Organisation Name *" icon={<Building2 size={15} />} error={errors.organization}>
            <input
              value={form.organization}
              onChange={e => set("organization", e.target.value)}
              placeholder="Your Company Pvt. Ltd."
              style={FIELD}
            />
          </Field>

          {/* Team size */}
          <div>
            <label style={LABEL}>
              <Users size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              Team Size (optional)
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TEAM_SIZES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("teamSize", s)}
                  style={{
                    padding: "7px 16px", borderRadius: 6, border: "1px solid",
                    borderColor: form.teamSize === s ? "#6366f1" : "var(--border-input)",
                    background: form.teamSize === s ? "#6366f115" : "transparent",
                    color: form.teamSize === s ? "#6366f1" : "var(--text-ghost)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label style={LABEL}>
              <MessageSquare size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              Message (optional)
            </label>
            <textarea
              value={form.message}
              onChange={e => set("message", e.target.value)}
              placeholder="Tell us about your business or anything specific you need…"
              rows={3}
              style={{ ...FIELD, paddingLeft: 12, resize: "vertical", lineHeight: 1.5 }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", height: 46, borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              color: "white", fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading ? "Submitting…" : <><Send size={16} /> Send Request</>}
          </button>

          <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-ghost)", margin: 0 }}>
            We'll get back to you within 1–2 business days. No spam, ever.
          </p>
        </div>
      </form>
    </Overlay>
  );
}

// ── Modal overlay wrapper ────────────────────────────────────
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px 16px",
        overflowY: "auto",
      }}
    >
      <div style={{
        width: "100%", maxWidth: 520,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        boxShadow: "0 32px 96px rgba(0,0,0,0.6)",
        animation: "slideUp 0.2s ease",
      }}>
        {children}
      </div>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
