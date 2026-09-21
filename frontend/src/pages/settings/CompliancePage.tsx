import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Save, ShieldCheck, Phone, TrendingUp, Heart, Download, Trash2, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  page:    { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  title:   { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  sub:     { fontSize: 13, color: "var(--text-ghost)", marginTop: 2, marginBottom: 24 } as React.CSSProperties,
  card:    { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 20 } as React.CSSProperties,
  section: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  sectionSub: { fontSize: 12, color: "var(--text-ghost)", marginBottom: 20 } as React.CSSProperties,
  input:   { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" },
  label:   { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 } as React.CSSProperties,
  row:     { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" } as React.CSSProperties,
  rowLabel:{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 } as React.CSSProperties,
  rowSub:  { fontSize: 11, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  toggle:  (on: boolean): React.CSSProperties => ({ width: 44, height: 24, borderRadius: 12, background: on ? "#10b981" : "#374151", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }),
  thumb:   (on: boolean): React.CSSProperties => ({ position: "absolute", width: 18, height: 18, borderRadius: "50%", background: "white", top: 3, left: on ? 23 : 3, transition: "left 0.2s" }),
  btn:     { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "10px 22px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" } as React.CSSProperties,
  dangerBtn: { background: "#ef444418", border: "1px solid #ef444430", color: "#ef4444", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" } as React.CSSProperties,
  badge:   (c: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: c + "20", color: c }),
  alert:   (c: string): React.CSSProperties => ({ background: c + "12", border: `1px solid ${c}30`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: c, marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }),
  g2:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as React.CSSProperties,
};

interface Config {
  dpdpConsentRequired: boolean; dataRetentionDays: number; privacyPolicyUrl: string;
  termsUrl: string; cookieConsentEnabled: boolean;
  traiCallingHoursOnly: boolean; traiDndCheckEnabled: boolean;
  sebiRegistered: boolean; sebiRegNumber: string; sebiDisclaimer: string;
  hipaaMode: boolean; patientConsentRequired: boolean;
  dataExportEnabled: boolean; rightToErasureEnabled: boolean;
}

const defaults: Config = {
  dpdpConsentRequired: true, dataRetentionDays: 365, privacyPolicyUrl: "", termsUrl: "", cookieConsentEnabled: true,
  traiCallingHoursOnly: true, traiDndCheckEnabled: true,
  sebiRegistered: false, sebiRegNumber: "", sebiDisclaimer: "Calls/Research provided are for informational purposes only and do not constitute SEBI-registered investment advice.",
  hipaaMode: false, patientConsentRequired: true,
  dataExportEnabled: true, rightToErasureEnabled: true,
};

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={S.toggle(on)}>
      <span style={S.thumb(on)} />
    </button>
  );
}

export default function CompliancePage() {
  const { t } = useTranslation();
  const [cfg, setCfg]     = useState<Config>(defaults);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");

  useEffect(() => {
    api.get("/compliance/config").then(r => setCfg({ ...defaults, ...r.data.data })).catch(() => { /* ignore */ });
  }, []);

  const set = (key: keyof Config) => (val: any) => setCfg(p => ({ ...p, [key]: val }));
  const toggle = (key: keyof Config) => () => setCfg(p => ({ ...p, [key]: !(p[key] as boolean) }));

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await api.patch("/compliance/config", cfg);
      setMsg("Compliance settings saved.");
      setTimeout(() => setMsg(""), 2500);
    } catch { setMsg("Save failed."); }
    setSaving(false);
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const r = await api.get("/compliance/export");
      const blob = new Blob([JSON.stringify(r.data.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `data-export-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Export failed"); }
    setExporting(false);
  };

  return (
    <div style={S.page}>
      <h1 style={S.title}>{ t('page_compliance') }</h1>
      <p style={S.sub}>Configure data privacy, TRAI telemarketing rules, SEBI disclaimers and health data handling to stay legally compliant in India.</p>

      {/* ── DPDP Act 2023 ── */}
      <div style={S.card}>
        <div style={S.section}><ShieldCheck size={15} color="#10b981" /> DPDP Act 2023 — Digital Personal Data Protection</div>
        <div style={S.sectionSub}>India's primary data privacy law. Applicable to all businesses collecting personal data of Indian citizens.</div>

        <div style={{ ...S.alert("#10b981") }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>The DPDP Act 2023 requires explicit consent before collecting personal data, a clear privacy policy, and honouring deletion/export requests within 72 hours.</span>
        </div>

        {([
          ["dpdpConsentRequired", "Require explicit consent before collecting personal data", "Shows a consent checkbox on all lead capture forms and public-facing contact forms"],
          ["cookieConsentEnabled", "Show cookie consent banner to website visitors", "DPDP requires informing users about cookies and tracking scripts"],
          ["dataExportEnabled",    "Allow users to export their personal data (Right to Access)", "Provide a data export option in the customer portal"],
          ["rightToErasureEnabled","Enable Right to Erasure (Right to be Forgotten)", "Allow deletion/anonymisation of personal data on request"],
        ] as [keyof Config, string, string][]).map(([key, label, sub]) => (
          <div key={key} style={S.row}>
            <div>
              <div style={S.rowLabel}>{label}</div>
              <div style={S.rowSub}>{sub}</div>
            </div>
            <Toggle on={Boolean(cfg[key])} onChange={toggle(key)} />
          </div>
        ))}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
          <div>
            <label style={S.label}>Data Retention (days)</label>
            <input type="number" style={S.input} value={cfg.dataRetentionDays} min={30} max={3650} onChange={e => set("dataRetentionDays")(Number(e.target.value))} />
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-ghost)" }}>Data older than this (inactive records) will be flagged for deletion. 0 = no limit.</p>
          </div>
          <div />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
          <div>
            <label style={S.label}>Privacy Policy URL</label>
            <input type="url" style={S.input} placeholder="https://yourdomain.com/privacy" value={cfg.privacyPolicyUrl} onChange={e => set("privacyPolicyUrl")(e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Terms & Conditions URL</label>
            <input type="url" style={S.input} placeholder="https://yourdomain.com/terms" value={cfg.termsUrl} onChange={e => set("termsUrl")(e.target.value)} />
          </div>
        </div>

        {/* Data Actions */}
        <div style={{ marginTop: 20, padding: 16, background: "var(--bg-hover)", borderRadius: 10, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Data Subject Rights — Actions</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={exportData} disabled={exporting} style={{ ...S.btn, background: "linear-gradient(135deg,#10b981,#059669)", opacity: exporting ? 0.7 : 1 }}>
              <Download size={13} /> {exporting ? "Exporting…" : "Export All Org Data (JSON)"}
            </button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--text-ghost)" }}>
            To erase a specific party's data (Right to Erasure), use <strong>CRM → Party Detail → ⋮ menu → Erase Personal Data</strong>.
          </p>
        </div>
      </div>

      {/* ── TRAI ── */}
      <div style={S.card}>
        <div style={S.section}><Phone size={15} color="#6366f1" /> TRAI — Telecom Regulatory Authority of India</div>
        <div style={S.sectionSub}>Mandatory for any business using auto-dialers, bulk SMS or outbound tele-calling in India.</div>

        <div style={{ ...S.alert("#f59e0b") }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>TRAI mandates: calling only between <strong>9 AM – 9 PM</strong>, scrubbing numbers against NDNC (National Do Not Call) registry, and registering commercial SMS on TRAI's DLT platform. Violations attract ₹25,000+ fines per complaint.</span>
        </div>

        {([
          ["traiCallingHoursOnly", "Enforce calling hours restriction (9 AM – 9 PM IST)", "The Tele-calling module will warn agents if they attempt calls outside permitted hours"],
          ["traiDndCheckEnabled",  "Show DNC/NDNC warning before calling leads", "Reminds agents to check the Do Not Call registry before dialling. TRAI requires this for commercial calls"],
        ] as [keyof Config, string, string][]).map(([key, label, sub]) => (
          <div key={key} style={S.row}>
            <div>
              <div style={S.rowLabel}>{label}</div>
              <div style={S.rowSub}>{sub}</div>
            </div>
            <Toggle on={Boolean(cfg[key])} onChange={toggle(key)} />
          </div>
        ))}

        <div style={{ marginTop: 14, padding: 12, background: "#6366f110", borderRadius: 8, border: "1px solid #6366f125", fontSize: 12, color: "var(--text-sec)" }}>
          <strong>DLT Registration required for SMS:</strong> Register your SMS headers on any TRAI-approved DLT platform (Jio, Vodafone, BSNL, etc.) before sending bulk promotional messages. Failure to do so results in SMS delivery failure from 2023 onwards.
        </div>
      </div>

      {/* ── SEBI ── */}
      <div style={S.card}>
        <div style={S.section}><TrendingUp size={15} color="#f59e0b" /> SEBI — Stock Market Advisory Compliance</div>
        <div style={S.sectionSub}>Required only if your organisation publishes trade calls, research reports or advisory services.</div>

        <div style={{ ...S.alert("#ef4444") }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Providing investment advice without SEBI registration (IA Regulations 2013) is a criminal offence. If you are not SEBI-registered, ensure all trade calls carry a clear disclaimer. Registered advisors must also comply with fee capping, risk profiling and KYC mandates.</span>
        </div>

        <div style={S.row}>
          <div>
            <div style={S.rowLabel}>SEBI Registered Investment Advisor</div>
            <div style={S.rowSub}>Toggle ON only if you hold a valid SEBI IA registration. This enables removing the "not registered" disclaimer.</div>
          </div>
          <Toggle on={Boolean(cfg.sebiRegistered)} onChange={toggle("sebiRegistered")} />
        </div>

        {cfg.sebiRegistered && (
          <div style={{ marginTop: 12 }}>
            <label style={S.label}>SEBI Registration Number</label>
            <input style={S.input} placeholder="INH000XXXXXX" value={cfg.sebiRegNumber} onChange={e => set("sebiRegNumber")(e.target.value)} />
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <label style={S.label}>Risk Disclaimer (shown on all trade calls & research)</label>
          <textarea
            style={{ ...S.input, minHeight: 80, resize: "vertical" as const }}
            value={cfg.sebiDisclaimer}
            onChange={e => set("sebiDisclaimer")(e.target.value)}
          />
        </div>
      </div>

      {/* ── Health Data ── */}
      <div style={S.card}>
        <div style={S.section}><Heart size={15} color="#ef4444" /> Health Data — DPDP Sensitive Personal Data</div>
        <div style={S.sectionSub}>Health data is classified as "Sensitive Personal Data" under DPDP Act 2023 — requires higher-level consent and access controls.</div>

        <div style={{ ...S.alert("#ef4444") }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Under DPDP 2023, health/medical data requires <strong>explicit, specific written consent</strong> before collection. Do not share patient data with third-party marketing tools. Patients have the right to access and erase their data within 72 hours of request.</span>
        </div>

        {([
          ["patientConsentRequired", "Require explicit patient consent before recording health data", "Adds a consent checkbox on the patient registration form"],
          ["hipaaMode",             "Enable HIPAA-style access controls (audit log on every record view)", "For organisations also serving international / US-based clients. Adds access logs to all patient record views."],
        ] as [keyof Config, string, string][]).map(([key, label, sub]) => (
          <div key={key} style={S.row}>
            <div>
              <div style={S.rowLabel}>{label}</div>
              <div style={S.rowSub}>{sub}</div>
            </div>
            <Toggle on={Boolean(cfg[key])} onChange={toggle(key)} />
          </div>
        ))}
      </div>

      {/* ── Indian Law Summary ── */}
      <div style={{ ...S.card, border: "1px solid #6366f140" }}>
        <div style={S.section}><CheckCircle size={15} color="#10b981" /> Indian Compliance Checklist</div>
        {[
          [true,  "GST & E-Invoicing",     "IRN generation via IRP, E-way bills — already integrated"],
          [true,  "IT Act 2000",           "Data stored securely, audit logs maintained, no unauthorised access"],
          [true,  "DPDP Act 2023",         "Consent management, data export, right to erasure — enabled above"],
          [true,  "TRAI DND",              "DNC list in Tele-calling module, calling hours enforcement"],
          [false, "SEBI IA Regulations",   "Add SEBI disclaimer to all trade calls if not registered"],
          [false, "RBI KYC Guidelines",    "For financial advisory: ensure KYC documents are verified before advising"],
          [false, "UIDAI — Aadhaar",       "Do NOT store full Aadhaar numbers. Store only last 4 digits per UIDAI circular"],
          [true,  "FSSAI",                 "Not applicable unless you are in food business — module not present"],
          [true,  "Companies Act 2013",    "Audit trail, document storage, and data retention covered"],
          [false, "WhatsApp Business API", "Comply with Meta's Commerce Policy — no unsolicited bulk messages"],
        ].map(([ok, law, note]) => (
          <div key={String(law)} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ flexShrink: 0, marginTop: 1 }}>
              {ok ? <CheckCircle size={15} color="#10b981" /> : <AlertTriangle size={15} color="#f59e0b" />}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{String(law)}</div>
              <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2 }}>{String(note)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Save */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={save} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.7 : 1 }}>
          <Save size={14} /> {saving ? "Saving…" : "Save Compliance Settings"}
        </button>
        {msg && <span style={{ fontSize: 13, color: msg.includes("fail") ? "#ef4444" : "#10b981", fontWeight: 500 }}>{msg}</span>}
      </div>
    </div>
  );
}
