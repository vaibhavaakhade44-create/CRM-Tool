import { useState, useEffect } from "react";
import type React from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Building2, Save } from "lucide-react";
import { kDigits, kAlphaNum, kPhone, kName, kAlpha, kGSTIN, kPAN, kIFSC } from "@/lib/fieldRules";
import { useTranslation } from 'react-i18next';

const S = {
  page: { padding: "28px 32px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  sub: { fontSize: 13, color: "var(--text-ghost)", marginTop: 4, marginBottom: 28 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 20, maxWidth: 640 } as React.CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 6 },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 7 } as React.CSSProperties,
};

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];
const BUSINESS_TYPES = ["IMPORT_EXPORT","IMPORT","EXPORT","TRADING","MANUFACTURING","RETAIL","ECOMMERCE","IT_SOFTWARE","IT_SERVICES","LOGISTICS","CONSULTING","OTHER"];

export default function AdminSettingsPage() {
  const { t } = useTranslation();
  const { activeOrg } = useAuthStore();
  const [form, setForm] = useState({
    name: "", email: "", phone: "", website: "",
    address: "", city: "", state: "", country: "IN", pincode: "",
    currency: "INR", businessType: "IMPORT_EXPORT",
    taxId: "", panNumber: "", iecCode: "",
    bankName: "", bankAccount: "", bankIfsc: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/organizations/current").then((r) => {
      const o = r.data.data;
      setForm({
        name: o.name || "", email: o.email || "", phone: o.phone || "", website: o.website || "",
        address: o.address || "", city: o.city || "", state: o.state || "",
        country: o.country || "IN", pincode: o.pincode || "",
        currency: o.currency || "INR", businessType: o.businessType || "IMPORT_EXPORT",
        taxId: o.taxId || "", panNumber: o.panNumber || "", iecCode: o.iecCode || "",
        bankName: o.bankName || "", bankAccount: o.bankAccount || "", bankIfsc: o.bankIfsc || "",
      });
    }).catch(() => {});
  }, [activeOrg?.id]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await api.patch("/organizations/current", form);
      setMsg("✓ Settings saved successfully");
    } catch (e: any) {
      setMsg("✗ " + (e?.response?.data?.message || "Save failed"));
    }
    setSaving(false);
  };

  const F = ({
    k, label, type = "text", placeholder = "",
    onKeyDown, maxLength, autoUpper,
  }: {
    k: keyof typeof form; label: string; type?: string; placeholder?: string;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    maxLength?: number;
    autoUpper?: boolean;
  }) => (
    <div>
      <label style={S.label}>{label}</label>
      <input
        style={S.input}
        type={type}
        value={form[k]}
        onChange={(e) => set(k, autoUpper ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        maxLength={maxLength}
      />
    </div>
  );

  return (
    <div className="page-pad">
      <h1 style={S.title}>{ t('page_settings') }</h1>
      <p style={S.sub}>Update your company profile, tax details, and banking information</p>

      {/* Basic Info */}
      <div style={S.card}>
        <div style={S.cardTitle}><Building2 size={15} color="#6366f1" /> Basic Information</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <F k="name" label="Organisation Name *" maxLength={200} onKeyDown={kName} />
          <div className="grid-r2">
            <F k="email" label="Email" type="email" />
            <F k="phone" label="Phone" maxLength={15} onKeyDown={kPhone} />
          </div>
          <F k="website" label="Website" placeholder="https://yourcompany.com" />
          <div className="grid-r2">
            <div>
              <label style={S.label}>Currency</label>
              <select style={S.select} value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Business Type</label>
              <select style={S.select} value={form.businessType} onChange={(e) => set("businessType", e.target.value)}>
                {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Address */}
      <div style={S.card}>
        <div style={S.cardTitle}><Building2 size={15} color="#f59e0b" /> Address</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <F k="address" label="Street Address" />
          <div className="grid-r2">
            <F k="city" label="City" maxLength={100} onKeyDown={kAlpha} />
            <F k="state" label="State" maxLength={100} onKeyDown={kAlpha} />
          </div>
          <div className="grid-r2">
            <F k="pincode" label="PIN Code" maxLength={6} onKeyDown={kDigits} />
            <F k="country" label="Country Code" placeholder="IN" />
          </div>
        </div>
      </div>

      {/* Tax / Legal */}
      <div style={S.card}>
        <div style={S.cardTitle}><Building2 size={15} color="#10b981" /> Tax & Legal</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="grid-r2">
            <F k="taxId" label="GSTIN" placeholder="22AAAAA0000A1Z5" maxLength={15} onKeyDown={kGSTIN} autoUpper />
            <F k="panNumber" label="PAN Number" placeholder="ABCDE1234F" maxLength={10} onKeyDown={kPAN} autoUpper />
          </div>
          <F k="iecCode" label="IEC Code (Import-Export)" placeholder="AABCD1234E" maxLength={10} onKeyDown={kAlphaNum} autoUpper />
        </div>
      </div>

      {/* Banking */}
      <div style={S.card}>
        <div style={S.cardTitle}><Building2 size={15} color="#818cf8" /> Banking Details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <F k="bankName" label="Bank Name" maxLength={100} onKeyDown={kName} />
          <div className="grid-r2">
            <F k="bankAccount" label="Account Number" maxLength={18} onKeyDown={kDigits} />
            <F k="bankIfsc" label="IFSC Code" maxLength={11} onKeyDown={kIFSC} autoUpper />
          </div>
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 16px", borderRadius: 8, background: msg.startsWith("✓") ? "#10b98120" : "#ef444420", color: msg.startsWith("✓") ? "#10b981" : "#ef4444", fontSize: 13, fontWeight: 500, marginBottom: 16, maxWidth: 640 }}>
          {msg}
        </div>
      )}

      <button onClick={save} style={S.btn} disabled={saving}>
        <Save size={14} /> {saving ? "Saving..." : "Save All Settings"}
      </button>
    </div>
  );
}
