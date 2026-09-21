import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Save, Palette, Building2, Image, FileText } from "lucide-react";
import { useTranslation } from 'react-i18next';

const PRESET_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f59e0b","#10b981","#06b6d4","#3b82f6","#1d4ed8","#000000",
];

const S = {
  page:    { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  title:   { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  sub:     { fontSize: 13, color: "var(--text-ghost)", marginTop: 2, marginBottom: 24 } as React.CSSProperties,
  card:    { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 20 } as React.CSSProperties,
  section: { fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  input:   { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" },
  label:   { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 } as React.CSSProperties,
  btn:     { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" } as React.CSSProperties,
  g2:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } as React.CSSProperties,
};

interface BrandingForm {
  logo: string; brandingColor: string; invoiceHeader: string; invoiceFooter: string; invoiceNotes: string;
}

export default function BrandingPage() {
  const { t } = useTranslation();
  const [form, setForm]   = useState<BrandingForm>({ logo: "", brandingColor: "#6366f1", invoiceHeader: "", invoiceFooter: "", invoiceNotes: "" });
  const [orgName, setOrgName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/branding"),
      api.get("/compliance/config"),
    ]).then(([br, co]) => {
      const b = br.data.data;
      const c = co.data.data;
      setOrgName(b?.name || "");
      setForm({
        logo:           b?.logo || "",
        brandingColor:  b?.brandingColor || "#6366f1",
        invoiceHeader:  c?.invoiceHeader || "",
        invoiceFooter:  c?.invoiceFooter || "",
        invoiceNotes:   c?.invoiceNotes  || "",
      });
    }).catch(() => { /* ignore */ });
  }, []);

  const save = async () => {
    setSaving(true); setSaved("");
    try {
      await api.patch("/branding", { logo: form.logo, brandingColor: form.brandingColor, invoiceHeader: form.invoiceHeader, invoiceFooter: form.invoiceFooter, invoiceNotes: form.invoiceNotes });
      setSaved("Branding saved successfully!");
      setTimeout(() => setSaved(""), 2500);
    } catch { setSaved("Save failed. Please try again."); }
    setSaving(false);
  };

  const f = (key: keyof BrandingForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div style={S.page}>
      <h1 style={S.title}>{ t('page_branding') }</h1>
      <p style={S.sub}>Customise how your platform looks to your team and appears on invoices, documents and emails.</p>

      {/* Logo & Color */}
      <div style={S.card}>
        <div style={S.section}><Palette size={15} color="#818cf8" /> Brand Identity</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label style={S.label}>Logo URL</label>
            <input style={S.input} placeholder="https://yourdomain.com/logo.png" value={form.logo} onChange={f("logo")} />
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-ghost)" }}>Paste a publicly accessible image URL. Appears in the sidebar, invoices and emails.</p>
          </div>
          <div>
            <label style={S.label}>Primary / Brand Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, brandingColor: c }))} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: form.brandingColor === c ? "3px solid white" : "2px solid transparent", outline: form.brandingColor === c ? `2px solid ${c}` : "none", cursor: "pointer", flexShrink: 0, transition: "all 0.1s" }} title={c} />
              ))}
              <input type="color" value={form.brandingColor} onChange={e => setForm(p => ({ ...p, brandingColor: e.target.value }))} style={{ width: 34, height: 34, borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", background: "none", padding: 2 }} title="Custom color" />
              <input style={{ ...S.input, width: 110, fontFamily: "monospace" }} value={form.brandingColor} onChange={f("brandingColor")} placeholder="#6366f1" maxLength={7} />
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div style={{ marginTop: 20, padding: 16, background: "var(--bg-hover)", borderRadius: 10, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Preview</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {form.logo
              ? <img src={form.logo} alt="logo" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)" }} onError={e => (e.currentTarget.style.display = "none")} />
              : <div style={{ width: 48, height: 48, borderRadius: 8, background: form.brandingColor + "30", border: `2px solid ${form.brandingColor}`, display: "flex", alignItems: "center", justifyContent: "center", color: form.brandingColor, fontWeight: 800, fontSize: 18 }}>{orgName.charAt(0) || "B"}</div>}
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: form.brandingColor }}>{orgName || "Your Business Name"}</div>
              <div style={{ fontSize: 12, color: "var(--text-ghost)" }}>Brand color: <span style={{ color: form.brandingColor, fontWeight: 600 }}>{form.brandingColor}</span></div>
            </div>
            <button style={{ marginLeft: "auto", background: form.brandingColor, border: "none", color: "white", padding: "8px 16px", borderRadius: 7, fontWeight: 600, fontSize: 12, cursor: "default" }}>Sample Button</button>
          </div>
        </div>
      </div>

      {/* Invoice Customisation */}
      <div style={S.card}>
        <div style={S.section}><FileText size={15} color="#818cf8" /> Invoice / Document Template</div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text-ghost)" }}>These fields appear on every invoice, quotation and purchase order your organisation generates.</p>

        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>Invoice Header Text</label>
          <input style={S.input} placeholder="e.g. Tax Invoice — GST Registered" value={form.invoiceHeader} onChange={f("invoiceHeader")} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label style={S.label}>Invoice Footer</label>
            <textarea style={{ ...S.input, minHeight: 72, resize: "vertical" as const }} placeholder="e.g. Thank you for your business. Payment due within 30 days." value={form.invoiceFooter} onChange={f("invoiceFooter")} />
          </div>
          <div>
            <label style={S.label}>Invoice Notes / Terms</label>
            <textarea style={{ ...S.input, minHeight: 72, resize: "vertical" as const }} placeholder="e.g. Subject to Mumbai jurisdiction. Late payment attracts 2% monthly interest." value={form.invoiceNotes} onChange={f("invoiceNotes")} />
          </div>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={save} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.7 : 1 }}>
          <Save size={14} /> {saving ? "Saving…" : "Save Branding"}
        </button>
        {saved && <span style={{ fontSize: 13, color: saved.includes("fail") ? "#ef4444" : "#10b981", fontWeight: 500 }}>{saved}</span>}
      </div>
    </div>
  );
}
