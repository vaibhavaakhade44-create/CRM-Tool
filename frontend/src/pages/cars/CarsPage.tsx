import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus, Search, X, Upload, Phone, Mail, Car, ShieldAlert,
  AlertTriangle, CheckCircle, ArrowRight, Pencil,
} from "lucide-react";
import api from "@/lib/api";
import { getApiError } from "@/lib/utils";

const S = {
  inp: { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 12, outline: "none" } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#0ea5e9,#38bdf8)", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  ghost: { background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 } as React.CSSProperties,
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
};

const LEAD_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  NEW:            { label: "New",            color: "#818cf8", bg: "#1e1b4b" },
  HOT:            { label: "Hot",            color: "#f87171", bg: "#450a0a" },
  WARM:           { label: "Warm",           color: "#fbbf24", bg: "#451a03" },
  URGENT:         { label: "Urgent",         color: "#fb923c", bg: "#431407" },
  COLD:           { label: "Cold",           color: "#60a5fa", bg: "#1e3a5f" },
  CONTACTED:      { label: "Contacted",      color: "#a78bfa", bg: "#2e1065" },
  NOT_INTERESTED: { label: "Not Interested", color: "#9ca3af", bg: "#374151" },
  CONVERTED:      { label: "Converted",      color: "#4ade80", bg: "#14532d" },
  LOST:           { label: "Lost",           color: "#6b7280", bg: "#1f2937" },
};
const LEAD_STATUSES = Object.keys(LEAD_STATUS);
// Matches the client's own tracking sheet — RS, DS and CTE are their exact
// shorthand (not spelled out further since even they use them as-is).
const SOURCES: Record<string, string> = {
  WALK_IN: "Walk-in", PHONE: "Phone", WEBSITE: "Website",
  INSTAGRAM: "Instagram", META_ADS: "Meta Ads", SEO: "SEO (Organic)",
  REFERRAL: "Referral", RS: "RS", DS: "DS", CTE: "CTE (CarTrade)", OTHER: "Other",
};

const VEHICLE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  IN_STOCK: { label: "In Stock", color: "#818cf8", bg: "#1e1b4b" },
  RESERVED: { label: "Reserved", color: "#fbbf24", bg: "#451a03" },
  SOLD:     { label: "Sold",     color: "#4ade80", bg: "#14532d" },
};
const INSURANCE_TYPES = ["THIRD_PARTY", "COMPREHENSIVE", "ZERO_DEP"];

interface CarLead {
  id: string; leadType?: string; name: string; phone?: string; email?: string;
  interestedMake?: string; interestedModel?: string; budgetMin?: number; budgetMax?: number;
  tradeInVehicle?: string; source: string; status: string; notes?: string;
  isDoNotCall?: boolean; testDriveDone?: boolean; lastContactedAt?: string;
  assignedToId?: string; assignedTo?: { name: string } | null;
  nextFollowUpDate?: string; convertedVehicleId?: string; createdAt: string;
}
interface Insurance {
  id: string; provider: string; policyNumber?: string; type: string;
  startDate: string; endDate: string; premium?: number;
  idv?: number; odAmount?: number; ncb?: number; paymentMode?: string; sharing?: string;
  notes?: string;
}
interface Vehicle {
  id: string; make: string; model: string; variant?: string; year?: number;
  registrationNo?: string; chassisNo?: string; engineNo?: string; color?: string; odometer?: number;
  fuelType?: string; transmission?: string; purchasePrice?: number; salePrice?: number; status: string;
  sellerName?: string; sellerPhone?: string; sellerEmail?: string; purchasedAt?: string;
  registrationDate?: string;
  ownerName?: string; ownerPhone?: string; ownerEmail?: string; ownerAddress?: string; soldAt?: string;
  warrantyMonths?: number; warrantyEndDate?: string;
  assignedToId?: string; notes?: string;
  insurances: Insurance[];
}
interface Employee { id: string; name: string; }

// ── Insurance due-date helper (red within 30 days or already expired) ──
function insuranceBadge(insurance?: Insurance): { text: string; color: string; bg: string } | null {
  if (!insurance) return { text: "No policy on file", color: "var(--text-ghost)", bg: "var(--bg-hover)" };
  const end = new Date(insurance.endDate);
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: `Expired ${Math.abs(days)}d ago`, color: "#f87171", bg: "#450a0a" };
  if (days <= 30) return { text: `Expires in ${days}d`, color: "#f87171", bg: "#450a0a" };
  if (days <= 60) return { text: `Expires in ${days}d`, color: "#fbbf24", bg: "#451a03" };
  return { text: `Valid till ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, color: "#4ade80", bg: "#14532d" };
}

// ── Warranty due-date helper (same red/amber/green convention as insurance) ──
function warrantyBadge(vehicle: Vehicle): { text: string; color: string } | null {
  if (!vehicle.warrantyEndDate) return null;
  const end = new Date(vehicle.warrantyEndDate);
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: `Expired ${Math.abs(days)}d ago`, color: "#f87171" };
  if (days <= 30) return { text: `Expires in ${days}d`, color: "#f87171" };
  if (days <= 60) return { text: `Expires in ${days}d`, color: "#fbbf24" };
  return { text: `Valid till ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, color: "#4ade80" };
}

// ── Follow-up due-date helper (mirrors TodaysFollowUps.tsx's dueLabel) ──
function dueLabel(dateStr?: string): { text: string; color: string; group: "overdue" | "today" | "upcoming" } {
  if (!dateStr) return { text: "", color: "var(--text-ghost)", group: "upcoming" };
  const due = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((startOfToday.getTime() - new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()) / 86400000);
  if (days > 0) return { text: `${days}d overdue`, color: "#f87171", group: "overdue" };
  if (days === 0) return { text: "Due today", color: "#fbbf24", group: "today" };
  return { text: due.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), color: "var(--text-ghost)", group: "upcoming" };
}

// ═══════════════════════════════════════════════════════════════
// Add / Edit Lead modal
// ═══════════════════════════════════════════════════════════════
export function LeadModal({ lead, defaultLeadType, onClose, onSaved }: { lead: CarLead | null; defaultLeadType?: "BUYER" | "SELLER"; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    leadType: lead?.leadType ?? defaultLeadType ?? "BUYER",
    name: lead?.name ?? "", phone: lead?.phone ?? "", email: lead?.email ?? "",
    interestedMake: lead?.interestedMake ?? "", interestedModel: lead?.interestedModel ?? "",
    budgetMin: lead?.budgetMin?.toString() ?? "", budgetMax: lead?.budgetMax?.toString() ?? "",
    tradeInVehicle: lead?.tradeInVehicle ?? "", source: lead?.source ?? "WALK_IN",
    status: lead?.status ?? "NEW", notes: lead?.notes ?? "",
    isDoNotCall: lead?.isDoNotCall ?? false,
    testDriveDone: lead?.testDriveDone ?? false,
    assignedToId: lead?.assignedToId ?? "",
    nextFollowUpDate: lead?.nextFollowUpDate ? lead.nextFollowUpDate.slice(0, 10) : "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    api.get("/organizations/current/directory").then(r => setEmployees(r.data.data ?? [])).catch(() => {});
  }, []);

  async function save() {
    if (!form.name.trim()) { setErr("Name is required"); return; }
    setSaving(true); setErr("");
    try {
      const payload: any = {
        ...form,
        budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
        budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
        nextFollowUpDate: form.nextFollowUpDate || undefined,
      };
      if (lead) await api.patch(`/cars/leads/${lead.id}`, payload);
      else await api.post("/cars/leads", payload);
      onSaved(); onClose();
    } catch (e) { setErr(getApiError(e)); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-lg mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{lead ? "Edit Lead" : form.leadType === "SELLER" ? "Add Car Seller Lead" : "Add Car Buyer Lead"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <div className="flex gap-2 mb-4">
          {(["BUYER", "SELLER"] as const).map(t => (
            <button key={t} type="button" onClick={() => setForm({ ...form, leadType: t })}
              style={{ flex: 1, padding: "8px", borderRadius: 8, border: form.leadType === t ? "1px solid #38bdf8" : "1px solid var(--border)", background: form.leadType === t ? "rgba(56,189,248,0.12)" : "var(--bg-hover)", color: form.leadType === t ? "#38bdf8" : "var(--text-secondary)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              {t === "BUYER" ? "Wants to Buy" : "Wants to Sell"}
            </button>
          ))}
        </div>
        {err && <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 12, color: "#f87171" }}>{err}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label style={S.label}>Name *</label>
            <input style={{ ...S.inp, width: "100%" }} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div><label style={S.label}>Phone</label><input style={{ ...S.inp, width: "100%" }} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label style={S.label}>Email</label><input style={{ ...S.inp, width: "100%" }} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><label style={S.label}>{form.leadType === "SELLER" ? "Car to Sell — Make" : "Interested Make"}</label><input style={{ ...S.inp, width: "100%" }} placeholder="e.g. Maruti Suzuki" value={form.interestedMake} onChange={e => setForm({ ...form, interestedMake: e.target.value })} /></div>
          <div><label style={S.label}>{form.leadType === "SELLER" ? "Car to Sell — Model" : "Interested Model"}</label><input style={{ ...S.inp, width: "100%" }} placeholder="e.g. Swift" value={form.interestedModel} onChange={e => setForm({ ...form, interestedModel: e.target.value })} /></div>
          <div><label style={S.label}>{form.leadType === "SELLER" ? "Asking Price Min (₹)" : "Budget Min (₹)"}</label><input type="number" style={{ ...S.inp, width: "100%" }} value={form.budgetMin} onChange={e => setForm({ ...form, budgetMin: e.target.value })} /></div>
          <div><label style={S.label}>{form.leadType === "SELLER" ? "Asking Price Max (₹)" : "Budget Max (₹)"}</label><input type="number" style={{ ...S.inp, width: "100%" }} value={form.budgetMax} onChange={e => setForm({ ...form, budgetMax: e.target.value })} /></div>
          <div className="sm:col-span-2">
            <label style={S.label}>Trade-in Vehicle (if any)</label>
            <input style={{ ...S.inp, width: "100%" }} placeholder="e.g. 2018 Honda City to exchange" value={form.tradeInVehicle} onChange={e => setForm({ ...form, tradeInVehicle: e.target.value })} />
          </div>
          <div>
            <label style={S.label}>Source</label>
            <select style={{ ...S.inp, width: "100%" }} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
              {Object.entries(SOURCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Status</label>
            <select style={{ ...S.inp, width: "100%" }} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {LEAD_STATUSES.filter(s => s !== "CONVERTED").map(s => <option key={s} value={s}>{LEAD_STATUS[s].label}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Assign To</label>
            <select style={{ ...S.inp, width: "100%" }} value={form.assignedToId} onChange={e => setForm({ ...form, assignedToId: e.target.value })}>
              <option value="">Unassigned</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Next Follow-up Date</label>
            <input type="date" style={{ ...S.inp, width: "100%" }} value={form.nextFollowUpDate} onChange={e => setForm({ ...form, nextFollowUpDate: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label style={S.label}>Notes</label>
            <textarea style={{ ...S.inp, width: "100%", minHeight: 70, resize: "vertical" } as React.CSSProperties} placeholder='e.g. "Called twice, not answered"' value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <label className="flex items-center gap-2" style={{ fontSize: 12, color: "#f87171", cursor: "pointer" }}>
            <input type="checkbox" checked={form.isDoNotCall} onChange={e => setForm({ ...form, isDoNotCall: e.target.checked })} />
            Do Not Call (DND)
          </label>
          <label className="flex items-center gap-2" style={{ fontSize: 12, color: "#4ade80", cursor: "pointer" }}>
            <input type="checkbox" checked={form.testDriveDone} onChange={e => setForm({ ...form, testDriveDone: e.target.checked })} />
            Test Drive Done
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={save} disabled={saving} style={S.btn}>{saving ? "Saving…" : lead ? "Save Changes" : "Add Lead"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Import CSV modal
// ═══════════════════════════════════════════════════════════════
function parseCsvText(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"(.*)"$/, "$1"));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  });
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileRows, setFileRows] = useState<Record<string, any>[] | null>(null);
  const [fileError, setFileError] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const sample = `name,phone,email,make,model\nRaj Patel,9876543210,raj@abc.com,Maruti Suzuki,Swift\nPriya Singh,9123456789,,Hyundai,Creta`;

  async function handleFile(file: File) {
    setFileError(""); setFileName(file.name); setFileRows(null);
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        setFileRows(parseCsvText(text));
      } else {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];
        // Normalise header casing (e.g. "Name" / "Make") to lowercase keys
        setFileRows(rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), v]))));
      }
    } catch {
      setFileError("Could not read this file. Make sure it's a valid .csv or .xlsx file.");
    }
  }

  async function doImport() {
    const rows = fileRows ?? (csvText.trim() ? parseCsvText(csvText) : null);
    if (!rows || rows.length === 0) return;
    setImporting(true);
    try {
      const r = await api.post("/cars/leads/bulk-import", { leads: rows });
      setResult(r.data.data);
      if (r.data.data.created > 0) onImported();
    } catch (e: any) {
      setResult({ created: 0, skipped: 0, errors: [getApiError(e)] });
    }
    setImporting(false);
  }

  const canImport = !!fileRows?.length || !!csvText.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-lg mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Import Leads (CSV)</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        {result ? (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl p-4 text-center" style={{ background: "#064e3b", border: "1px solid #065f46" }}>
                <div className="text-3xl font-bold" style={{ color: "#4ade80" }}>{result.created}</div>
                <div className="text-xs" style={{ color: "#6ee7b7" }}>Leads Created</div>
              </div>
              <div className="flex-1 rounded-xl p-4 text-center" style={{ background: "#1e1b4b", border: "1px solid #312e81" }}>
                <div className="text-3xl font-bold" style={{ color: "#818cf8" }}>{result.skipped}</div>
                <div className="text-xs" style={{ color: "#a5b4fc" }}>Skipped (duplicates)</div>
              </div>
            </div>
            {result.errors.length > 0 && <p className="text-xs text-red-400">{result.errors.join(", ")}</p>}
            <button onClick={onClose} style={{ ...S.btn, width: "100%", justifyContent: "center" }}>Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px]" style={{ color: "var(--text-ghost)" }}>
              Works with your own sheet's column names, not just these — Name/Contact/Requirement/Budget/Hot are recognized under many common aliases (e.g. "Contact" or "Mobile" both work as phone). Budget ranges like "5-6lac" are parsed automatically. Any column that isn't recognized is still kept — added to that lead's notes instead of being dropped.
            </p>

            <div>
              <label style={S.label}>Upload a File (.csv or .xlsx)</label>
              <label style={{ ...S.ghost, width: "100%", justifyContent: "center", cursor: "pointer", padding: "14px" }}>
                <Upload style={{ width: 14, height: 14 }} />
                {fileName || "Choose a CSV or Excel file…"}
                <input type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
              {fileError && <p style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{fileError}</p>}
              {fileRows && <p style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>{fileRows.length} row{fileRows.length !== 1 ? "s" : ""} ready to import</p>}
            </div>

            <div className="flex items-center gap-3">
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 11, color: "var(--text-ghost)" }}>or paste CSV text</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <div className="rounded-lg p-3 font-mono text-[10px]" style={{ background: "#0f172a", color: "#4ade80" }}>{sample}</div>
            <textarea style={{ ...S.inp, width: "100%", resize: "vertical", minHeight: 100, fontFamily: "monospace", fontSize: 11 } as React.CSSProperties} value={csvText} onChange={e => { setCsvText(e.target.value); setFileRows(null); setFileName(""); }} placeholder={sample} />

            <div className="flex justify-end gap-3">
              <button onClick={onClose} style={S.ghost}>Cancel</button>
              <button onClick={doImport} disabled={importing || !canImport} style={S.btn}><Upload style={{ width: 12, height: 12 }} />{importing ? "Importing…" : "Import"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Import Vehicles & Insurance (CSV) — mirrors ImportModal above, matches the
// client's own sheet: NAME, MOB NUMBER, REG NO, DATE OF REG, ADDRESS, ENG NO,
// CHASSIS NO, MAKE, MODEL/VAR, FUEL, INS TYPE, INS CO NAME, IDV, OD, NCB,
// PREM, EXPIRY/RENEWAL, PAYMENT MODE, SHARING.
// ═══════════════════════════════════════════════════════════════
function VehicleImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileRows, setFileRows] = useState<Record<string, any>[] | null>(null);
  const [fileError, setFileError] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const sample = `name,mob number,reg no,date of reg,address,eng no,chassis no,make,model/var,fuel,ins type,ins co name,idv,od,ncb,prem,expiry/reni,payment mode,sharing\nRaj Patel,9876543210,MH12AB1234,2019-03-14,Pune,EN123,CH456,Maruti Suzuki,Swift,Petrol,Comprehensive,ICICI Lombard,450000,8000,20,9500,2026-03-14,Online,NA`;

  async function handleFile(file: File) {
    setFileError(""); setFileName(file.name); setFileRows(null);
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        setFileRows(parseCsvText(text));
      } else {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];
        setFileRows(rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), v]))));
      }
    } catch {
      setFileError("Could not read this file. Make sure it's a valid .csv or .xlsx file.");
    }
  }

  async function doImport() {
    const rows = fileRows ?? (csvText.trim() ? parseCsvText(csvText) : null);
    if (!rows || rows.length === 0) return;
    setImporting(true);
    try {
      const r = await api.post("/cars/vehicles/bulk-import", { vehicles: rows });
      setResult(r.data.data);
      if (r.data.data.created > 0) onImported();
    } catch (e: any) {
      setResult({ created: 0, skipped: 0, errors: [getApiError(e)] });
    }
    setImporting(false);
  }

  const canImport = !!fileRows?.length || !!csvText.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-lg mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Import Vehicles & Insurance (CSV)</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        {result ? (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl p-4 text-center" style={{ background: "#064e3b", border: "1px solid #065f46" }}>
                <div className="text-3xl font-bold" style={{ color: "#4ade80" }}>{result.created}</div>
                <div className="text-xs" style={{ color: "#6ee7b7" }}>Vehicles Created</div>
              </div>
              <div className="flex-1 rounded-xl p-4 text-center" style={{ background: "#1e1b4b", border: "1px solid #312e81" }}>
                <div className="text-3xl font-bold" style={{ color: "#818cf8" }}>{result.skipped}</div>
                <div className="text-xs" style={{ color: "#a5b4fc" }}>Skipped (duplicates)</div>
              </div>
            </div>
            {result.errors.length > 0 && <p className="text-xs text-red-400">{result.errors.join(", ")}</p>}
            <button onClick={onClose} style={{ ...S.btn, width: "100%", justifyContent: "center" }}>Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px]" style={{ color: "var(--text-ghost)" }}>
              Works with your own sheet's column names — NAME, MOB NUMBER, REG NO, DATE OF REG, ADDRESS, ENG NO, CHASSIS NO, MAKE, MODEL/VAR, FUEL, INS TYPE, INS CO NAME, IDV, OD, NCB, PREM, EXPIRY/RENEWAL, PAYMENT MODE, SHARING are all recognized. Each row becomes a Sold vehicle (with its owner) plus its insurance policy, if a provider and expiry date are present. Any unrecognized column is kept in Notes instead of being dropped. Cells that say "NA" are treated as blank.
            </p>

            <div>
              <label style={S.label}>Upload a File (.csv or .xlsx)</label>
              <label style={{ ...S.ghost, width: "100%", justifyContent: "center", cursor: "pointer", padding: "14px" }}>
                <Upload style={{ width: 14, height: 14 }} />
                {fileName || "Choose a CSV or Excel file…"}
                <input type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
              {fileError && <p style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{fileError}</p>}
              {fileRows && <p style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>{fileRows.length} row{fileRows.length !== 1 ? "s" : ""} ready to import</p>}
            </div>

            <div className="flex items-center gap-3">
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 11, color: "var(--text-ghost)" }}>or paste CSV text</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <div className="rounded-lg p-3 font-mono text-[10px]" style={{ background: "#0f172a", color: "#4ade80", overflowX: "auto", whiteSpace: "pre" }}>{sample}</div>
            <textarea style={{ ...S.inp, width: "100%", resize: "vertical", minHeight: 100, fontFamily: "monospace", fontSize: 11 } as React.CSSProperties} value={csvText} onChange={e => { setCsvText(e.target.value); setFileRows(null); setFileName(""); }} placeholder={sample} />

            <div className="flex justify-end gap-3">
              <button onClick={onClose} style={S.ghost}>Cancel</button>
              <button onClick={doImport} disabled={importing || !canImport} style={S.btn}><Upload style={{ width: 12, height: 12 }} />{importing ? "Importing…" : "Import"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Convert Lead → Sale (creates Vehicle + first Insurance policy)
// ═══════════════════════════════════════════════════════════════
function ConvertModal({ lead, onClose, onConverted }: { lead: CarLead; onClose: () => void; onConverted: () => void }) {
  const [v, setV] = useState({
    make: lead.interestedMake ?? "", model: lead.interestedModel ?? "", variant: "", year: "",
    registrationNo: "", chassisNo: "", color: "", odometer: "", fuelType: "", transmission: "",
    salePrice: "", ownerName: lead.name, ownerPhone: lead.phone ?? "", ownerEmail: lead.email ?? "",
  });
  const [addInsurance, setAddInsurance] = useState(true);
  const [ins, setIns] = useState({ provider: "", policyNumber: "", type: "THIRD_PARTY", startDate: new Date().toISOString().slice(0, 10), endDate: "", premium: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!v.make.trim() || !v.model.trim()) { setErr("Make and model are required"); return; }
    if (addInsurance && (!ins.provider.trim() || !ins.endDate)) { setErr("Insurance provider and end date are required (or uncheck 'add insurance now')"); return; }
    setSaving(true); setErr("");
    try {
      await api.post(`/cars/leads/${lead.id}/convert`, {
        vehicle: {
          ...v,
          year: v.year ? Number(v.year) : undefined,
          odometer: v.odometer ? Number(v.odometer) : undefined,
          salePrice: v.salePrice ? Number(v.salePrice) : undefined,
        },
        insurance: addInsurance ? { ...ins, premium: ins.premium ? Number(ins.premium) : undefined } : undefined,
      });
      onConverted(); onClose();
    } catch (e) { setErr(getApiError(e)); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-xl mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Convert to Sale — {lead.name}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        {err && <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 12, color: "#f87171" }}>{err}</div>}

        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Vehicle Sold</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div><label style={S.label}>Make *</label><input style={{ ...S.inp, width: "100%" }} value={v.make} onChange={e => setV({ ...v, make: e.target.value })} /></div>
          <div><label style={S.label}>Model *</label><input style={{ ...S.inp, width: "100%" }} value={v.model} onChange={e => setV({ ...v, model: e.target.value })} /></div>
          <div><label style={S.label}>Variant</label><input style={{ ...S.inp, width: "100%" }} value={v.variant} onChange={e => setV({ ...v, variant: e.target.value })} /></div>
          <div><label style={S.label}>Year</label><input type="number" style={{ ...S.inp, width: "100%" }} value={v.year} onChange={e => setV({ ...v, year: e.target.value })} /></div>
          <div><label style={S.label}>Registration No.</label><input style={{ ...S.inp, width: "100%" }} value={v.registrationNo} onChange={e => setV({ ...v, registrationNo: e.target.value })} /></div>
          <div><label style={S.label}>Chassis No.</label><input style={{ ...S.inp, width: "100%" }} value={v.chassisNo} onChange={e => setV({ ...v, chassisNo: e.target.value })} /></div>
          <div><label style={S.label}>Color</label><input style={{ ...S.inp, width: "100%" }} value={v.color} onChange={e => setV({ ...v, color: e.target.value })} /></div>
          <div><label style={S.label}>Odometer (km)</label><input type="number" style={{ ...S.inp, width: "100%" }} value={v.odometer} onChange={e => setV({ ...v, odometer: e.target.value })} /></div>
          <div><label style={S.label}>Sale Price (₹)</label><input type="number" style={{ ...S.inp, width: "100%" }} value={v.salePrice} onChange={e => setV({ ...v, salePrice: e.target.value })} /></div>
          <div><label style={S.label}>Owner Name</label><input style={{ ...S.inp, width: "100%" }} value={v.ownerName} onChange={e => setV({ ...v, ownerName: e.target.value })} /></div>
          <div><label style={S.label}>Owner Phone</label><input style={{ ...S.inp, width: "100%" }} value={v.ownerPhone} onChange={e => setV({ ...v, ownerPhone: e.target.value })} /></div>
          <div><label style={S.label}>Owner Email</label><input style={{ ...S.inp, width: "100%" }} value={v.ownerEmail} onChange={e => setV({ ...v, ownerEmail: e.target.value })} /></div>
        </div>

        <label className="flex items-center gap-2 mb-3" style={{ fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={addInsurance} onChange={e => setAddInsurance(e.target.checked)} />
          Record their (third-party) insurance now
        </label>
        {addInsurance && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label style={S.label}>Provider *</label><input style={{ ...S.inp, width: "100%" }} value={ins.provider} onChange={e => setIns({ ...ins, provider: e.target.value })} /></div>
            <div><label style={S.label}>Policy No.</label><input style={{ ...S.inp, width: "100%" }} value={ins.policyNumber} onChange={e => setIns({ ...ins, policyNumber: e.target.value })} /></div>
            <div>
              <label style={S.label}>Type</label>
              <select style={{ ...S.inp, width: "100%" }} value={ins.type} onChange={e => setIns({ ...ins, type: e.target.value })}>
                {INSURANCE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Start Date</label><input type="date" style={{ ...S.inp, width: "100%" }} value={ins.startDate} onChange={e => setIns({ ...ins, startDate: e.target.value })} /></div>
            <div><label style={S.label}>End Date *</label><input type="date" style={{ ...S.inp, width: "100%" }} value={ins.endDate} onChange={e => setIns({ ...ins, endDate: e.target.value })} /></div>
            <div><label style={S.label}>Premium (₹)</label><input type="number" style={{ ...S.inp, width: "100%" }} value={ins.premium} onChange={e => setIns({ ...ins, premium: e.target.value })} /></div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={save} disabled={saving} style={S.btn}>{saving ? "Saving…" : "Confirm Sale"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Add Insurance Renewal modal
// ═══════════════════════════════════════════════════════════════
function InsuranceModal({ vehicle, onClose, onSaved }: { vehicle: Vehicle; onClose: () => void; onSaved: () => void }) {
  const [ins, setIns] = useState({ provider: "", policyNumber: "", type: "THIRD_PARTY", startDate: new Date().toISOString().slice(0, 10), endDate: "", premium: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!ins.provider.trim() || !ins.endDate) { setErr("Provider and end date are required"); return; }
    setSaving(true); setErr("");
    try {
      await api.post(`/cars/vehicles/${vehicle.id}/insurance`, { ...ins, premium: ins.premium ? Number(ins.premium) : undefined });
      onSaved(); onClose();
    } catch (e) { setErr(getApiError(e)); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-md mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Add Insurance — {vehicle.make} {vehicle.model}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        {err && <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 12, color: "#f87171" }}>{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label style={S.label}>Provider *</label><input style={{ ...S.inp, width: "100%" }} value={ins.provider} onChange={e => setIns({ ...ins, provider: e.target.value })} /></div>
          <div><label style={S.label}>Policy No.</label><input style={{ ...S.inp, width: "100%" }} value={ins.policyNumber} onChange={e => setIns({ ...ins, policyNumber: e.target.value })} /></div>
          <div>
            <label style={S.label}>Type</label>
            <select style={{ ...S.inp, width: "100%" }} value={ins.type} onChange={e => setIns({ ...ins, type: e.target.value })}>
              {INSURANCE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div><label style={S.label}>Start Date</label><input type="date" style={{ ...S.inp, width: "100%" }} value={ins.startDate} onChange={e => setIns({ ...ins, startDate: e.target.value })} /></div>
          <div><label style={S.label}>End Date *</label><input type="date" style={{ ...S.inp, width: "100%" }} value={ins.endDate} onChange={e => setIns({ ...ins, endDate: e.target.value })} /></div>
          <div className="col-span-2"><label style={S.label}>Premium (₹)</label><input type="number" style={{ ...S.inp, width: "100%" }} value={ins.premium} onChange={e => setIns({ ...ins, premium: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={save} disabled={saving} style={S.btn}>{saving ? "Saving…" : "Save Policy"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Add Vehicle (acquisition — independent of any buyer lead)
// ═══════════════════════════════════════════════════════════════
function AddVehicleModal({ employees, lead, onClose, onSaved }: { employees: Employee[]; lead?: CarLead | null; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({
    make: lead?.interestedMake ?? "", model: lead?.interestedModel ?? "", variant: "", year: "", registrationNo: "", chassisNo: "", engineNo: "",
    color: "", odometer: "", fuelType: "", transmission: "",
    purchasePrice: lead?.budgetMin ? String(lead.budgetMin) : "", sellerName: lead?.name ?? "", sellerPhone: lead?.phone ?? "", sellerEmail: lead?.email ?? "",
    purchasedAt: new Date().toISOString().slice(0, 10), assignedToId: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!v.make.trim() || !v.model.trim()) { setErr("Make and model are required"); return; }
    setSaving(true); setErr("");
    try {
      const res = await api.post("/cars/vehicles", {
        ...v,
        year: v.year ? Number(v.year) : undefined,
        odometer: v.odometer ? Number(v.odometer) : undefined,
        purchasePrice: v.purchasePrice ? Number(v.purchasePrice) : undefined,
        assignedToId: v.assignedToId || undefined,
        status: "IN_STOCK",
      });
      if (lead) {
        // carLeadSchema's zod .default()s re-apply for any field omitted from
        // a PATCH body (partial() only skips re-wrapping fields that already
        // report as optional, which a defaulted field does) — so leadType and
        // source must be sent explicitly here or they'd silently reset to
        // BUYER/OTHER, same convention LeadModal's save() already follows.
        await api.patch(`/cars/leads/${lead.id}`, { status: "CONVERTED", convertedVehicleId: res.data.data.id, leadType: lead.leadType, source: lead.source });
      }
      onSaved(); onClose();
    } catch (e) { setErr(getApiError(e)); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-xl mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{lead ? `Buy Car — from ${lead.name}` : "Add Vehicle — Bought a Car"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        {err && <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 12, color: "#f87171" }}>{err}</div>}

        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Vehicle Details</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div><label style={S.label}>Make *</label><input style={{ ...S.inp, width: "100%" }} value={v.make} onChange={e => setV({ ...v, make: e.target.value })} /></div>
          <div><label style={S.label}>Model *</label><input style={{ ...S.inp, width: "100%" }} value={v.model} onChange={e => setV({ ...v, model: e.target.value })} /></div>
          <div><label style={S.label}>Variant</label><input style={{ ...S.inp, width: "100%" }} value={v.variant} onChange={e => setV({ ...v, variant: e.target.value })} /></div>
          <div><label style={S.label}>Year</label><input type="number" style={{ ...S.inp, width: "100%" }} value={v.year} onChange={e => setV({ ...v, year: e.target.value })} /></div>
          <div><label style={S.label}>Registration No.</label><input style={{ ...S.inp, width: "100%" }} value={v.registrationNo} onChange={e => setV({ ...v, registrationNo: e.target.value })} /></div>
          <div><label style={S.label}>Chassis No.</label><input style={{ ...S.inp, width: "100%" }} value={v.chassisNo} onChange={e => setV({ ...v, chassisNo: e.target.value })} /></div>
          <div><label style={S.label}>Engine No.</label><input style={{ ...S.inp, width: "100%" }} value={v.engineNo} onChange={e => setV({ ...v, engineNo: e.target.value })} /></div>
          <div><label style={S.label}>Color</label><input style={{ ...S.inp, width: "100%" }} value={v.color} onChange={e => setV({ ...v, color: e.target.value })} /></div>
          <div><label style={S.label}>Odometer (km)</label><input type="number" style={{ ...S.inp, width: "100%" }} value={v.odometer} onChange={e => setV({ ...v, odometer: e.target.value })} /></div>
          <div><label style={S.label}>Fuel Type</label><input style={{ ...S.inp, width: "100%" }} placeholder="Petrol / Diesel / EV" value={v.fuelType} onChange={e => setV({ ...v, fuelType: e.target.value })} /></div>
          <div><label style={S.label}>Transmission</label><input style={{ ...S.inp, width: "100%" }} placeholder="Manual / Automatic" value={v.transmission} onChange={e => setV({ ...v, transmission: e.target.value })} /></div>
        </div>

        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Purchase (who you bought it from)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div><label style={S.label}>Purchase Price (₹)</label><input type="number" style={{ ...S.inp, width: "100%" }} value={v.purchasePrice} onChange={e => setV({ ...v, purchasePrice: e.target.value })} /></div>
          <div><label style={S.label}>Purchase Date</label><input type="date" style={{ ...S.inp, width: "100%" }} value={v.purchasedAt} onChange={e => setV({ ...v, purchasedAt: e.target.value })} /></div>
          <div>
            <label style={S.label}>Handled By</label>
            <select style={{ ...S.inp, width: "100%" }} value={v.assignedToId} onChange={e => setV({ ...v, assignedToId: e.target.value })}>
              <option value="">Unassigned</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div><label style={S.label}>Seller Name</label><input style={{ ...S.inp, width: "100%" }} value={v.sellerName} onChange={e => setV({ ...v, sellerName: e.target.value })} /></div>
          <div><label style={S.label}>Seller Phone</label><input style={{ ...S.inp, width: "100%" }} value={v.sellerPhone} onChange={e => setV({ ...v, sellerPhone: e.target.value })} /></div>
          <div><label style={S.label}>Seller Email</label><input style={{ ...S.inp, width: "100%" }} value={v.sellerEmail} onChange={e => setV({ ...v, sellerEmail: e.target.value })} /></div>
        </div>

        <label style={S.label}>Notes</label>
        <textarea style={{ ...S.inp, width: "100%", minHeight: 60, resize: "vertical" } as React.CSSProperties} value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} />

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={save} disabled={saving} style={S.btn}>{saving ? "Saving…" : "Add to Inventory"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Mark an in-stock vehicle as Sold (independent of the lead-convert flow)
// ═══════════════════════════════════════════════════════════════
function MarkSoldModal({ vehicle, onClose, onSold }: { vehicle: Vehicle; onClose: () => void; onSold: () => void }) {
  const [form, setForm] = useState({
    ownerName: "", ownerPhone: "", ownerEmail: "", salePrice: "", soldAt: new Date().toISOString().slice(0, 10), warrantyMonths: "",
  });
  const [addInsurance, setAddInsurance] = useState(true);
  const [ins, setIns] = useState({ provider: "", policyNumber: "", type: "THIRD_PARTY", startDate: new Date().toISOString().slice(0, 10), endDate: "", premium: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!form.ownerName.trim()) { setErr("Buyer name is required"); return; }
    if (addInsurance && (!ins.provider.trim() || !ins.endDate)) { setErr("Insurance provider and end date are required (or uncheck 'add insurance now')"); return; }
    setSaving(true); setErr("");
    try {
      await api.patch(`/cars/vehicles/${vehicle.id}`, {
        status: "SOLD",
        ownerName: form.ownerName, ownerPhone: form.ownerPhone, ownerEmail: form.ownerEmail || undefined,
        salePrice: form.salePrice ? Number(form.salePrice) : undefined,
        soldAt: form.soldAt,
        warrantyMonths: form.warrantyMonths ? Number(form.warrantyMonths) : undefined,
      });
      if (addInsurance) {
        await api.post(`/cars/vehicles/${vehicle.id}/insurance`, { ...ins, premium: ins.premium ? Number(ins.premium) : undefined });
      }
      onSold(); onClose();
    } catch (e) { setErr(getApiError(e)); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-lg mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Mark as Sold — {vehicle.make} {vehicle.model}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        {err && <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 12, color: "#f87171" }}>{err}</div>}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="col-span-2"><label style={S.label}>Buyer Name *</label><input style={{ ...S.inp, width: "100%" }} value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })} /></div>
          <div><label style={S.label}>Buyer Phone</label><input style={{ ...S.inp, width: "100%" }} value={form.ownerPhone} onChange={e => setForm({ ...form, ownerPhone: e.target.value })} /></div>
          <div><label style={S.label}>Buyer Email</label><input style={{ ...S.inp, width: "100%" }} value={form.ownerEmail} onChange={e => setForm({ ...form, ownerEmail: e.target.value })} /></div>
          <div><label style={S.label}>Sale Price (₹)</label><input type="number" style={{ ...S.inp, width: "100%" }} value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} /></div>
          <div><label style={S.label}>Sale Date</label><input type="date" style={{ ...S.inp, width: "100%" }} value={form.soldAt} onChange={e => setForm({ ...form, soldAt: e.target.value })} /></div>
          <div><label style={S.label}>Warranty (months)</label><input type="number" style={{ ...S.inp, width: "100%" }} placeholder="e.g. 6" value={form.warrantyMonths} onChange={e => setForm({ ...form, warrantyMonths: e.target.value })} /></div>
        </div>

        <label className="flex items-center gap-2 mb-3" style={{ fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={addInsurance} onChange={e => setAddInsurance(e.target.checked)} />
          Record their (third-party) insurance now
        </label>
        {addInsurance && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label style={S.label}>Provider *</label><input style={{ ...S.inp, width: "100%" }} value={ins.provider} onChange={e => setIns({ ...ins, provider: e.target.value })} /></div>
            <div><label style={S.label}>Policy No.</label><input style={{ ...S.inp, width: "100%" }} value={ins.policyNumber} onChange={e => setIns({ ...ins, policyNumber: e.target.value })} /></div>
            <div>
              <label style={S.label}>Type</label>
              <select style={{ ...S.inp, width: "100%" }} value={ins.type} onChange={e => setIns({ ...ins, type: e.target.value })}>
                {INSURANCE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Start Date</label><input type="date" style={{ ...S.inp, width: "100%" }} value={ins.startDate} onChange={e => setIns({ ...ins, startDate: e.target.value })} /></div>
            <div><label style={S.label}>End Date *</label><input type="date" style={{ ...S.inp, width: "100%" }} value={ins.endDate} onChange={e => setIns({ ...ins, endDate: e.target.value })} /></div>
            <div><label style={S.label}>Premium (₹)</label><input type="number" style={{ ...S.inp, width: "100%" }} value={ins.premium} onChange={e => setIns({ ...ins, premium: e.target.value })} /></div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={save} disabled={saving} style={S.btn}>{saving ? "Saving…" : "Confirm Sale"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Historical Stats import — paste a whole tracking-sheet table at once,
// matching the client's own column order exactly. Pre-software monthly
// totals, kept separate from real leads.
// ═══════════════════════════════════════════════════════════════
const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseMonthLabel(label: string): string | null {
  const m = label.trim().toLowerCase().match(/^([a-z]{3,})\s*-?\s*(\d{2,4})$/);
  if (!m) return null;
  const monthNum = MONTH_NAMES[m[1].slice(0, 3)];
  if (!monthNum) return null;
  let year = parseInt(m[2], 10);
  if (year < 100) year += 2000;
  return `${year}-${String(monthNum).padStart(2, "0")}`;
}

interface ParsedHistRow {
  raw: string; month: string | null;
  bySource: Record<string, number>; salesBySource: Record<string, number>;
  hot: number; warm: number; cold: number; notInterested: number;
  testDrivesDone: number; totalEnquiries: number; lost: number;
}

function parseHistoricalTsv(text: string): ParsedHistRow[] {
  const lines = text.split("\n").map(l => l.replace(/\r$/, "")).filter(l => l.trim());
  const rows: ParsedHistRow[] = [];
  for (const line of lines) {
    const cols = line.split("\t").map(c => c.trim());
    if (cols.length < 2) continue;
    const month = parseMonthLabel(cols[0]);
    const n = (i: number) => { const v = parseFloat(cols[i]); return isNaN(v) ? 0 : v; };
    // Some rows only repeat column headers as data (a pasted sub-header, no real numbers) — skip those.
    const isAllNumericOrBlank = cols.slice(1).every(c => c === "" || !isNaN(parseFloat(c)));
    // A row whose data cells aren't numeric is a pasted sub-header, not real
    // data (e.g. "March-25  Insta  Rajesh  Dhruv...") — treat as unparseable
    // (month: null) so it's excluded from import, not saved as an empty month.
    if (!month || !isAllNumericOrBlank) { rows.push({ raw: line, month: isAllNumericOrBlank ? month : null, bySource: {}, salesBySource: {}, hot: 0, warm: 0, cold: 0, notInterested: 0, testDrivesDone: 0, totalEnquiries: 0, lost: 0 }); continue; }
    const bySource = { INSTAGRAM: n(1), RS: n(2), DS: n(3), CTE: n(4), META_ADS: n(5), SEO: n(6), REFERRAL: n(7) };
    // Fall back to summing the source columns when the sheet's own "Total
    // Enquiries" cell is blank — better than silently showing 0.
    const ttlEnq = n(16) || Object.values(bySource).reduce((s, v) => s + v, 0);
    rows.push({
      raw: line, month,
      bySource,
      hot: n(8) + n(13), warm: n(9) + n(14), cold: n(10) + n(15),
      notInterested: n(11), testDrivesDone: n(12), totalEnquiries: ttlEnq,
      salesBySource: { INSTAGRAM: n(17), RS: n(18), DS: n(19), CTE: n(20), META_ADS: n(21), SEO: n(22), REFERRAL: n(23) },
      lost: n(24),
    });
  }
  return rows;
}

function rowHasData(r: ParsedHistRow): boolean {
  return r.totalEnquiries > 0 || r.hot > 0 || r.warm > 0 || r.cold > 0 || r.notInterested > 0
    || r.testDrivesDone > 0 || r.lost > 0
    || Object.values(r.bySource).some(v => v > 0) || Object.values(r.salesBySource).some(v => v > 0);
}

function HistoricalStatsModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedHistRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [err, setErr] = useState("");

  function preview() {
    const rows = parseHistoricalTsv(text);
    if (rows.length === 0) { setErr("Couldn't find any rows — paste including the header row is fine, it'll be skipped if unparseable."); return; }
    setErr("");
    setParsed(rows);
  }

  async function doImport() {
    if (!parsed) return;
    const valid = parsed.filter(r => r.month && rowHasData(r));
    if (valid.length === 0) { setErr("No rows had both a parseable month and non-zero data — nothing to import."); return; }
    setImporting(true);
    try {
      const r = await api.post("/cars/historical-stats/bulk-import", { rows: valid });
      setResult(r.data.data);
      if (r.data.data.created > 0) onImported();
    } catch (e) { setErr(getApiError(e)); }
    setImporting(false);
  }

  const sample = `MONTH\tInsta\tRS\tDS\tCTE\tMETA\tSEO\tREF\tH\tW\tC\tNOT INT\tTD DONE\tHOT\tWARM\tCOLD\tTTL/ENQ\tINSTA\tRS\tDS\tCTE\tMETA\tSEO\tREF\tLOST\t%-SALES\nMay-25\t146\t4\t0\t207`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-3xl mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Import Historical Monthly Data</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        {err && <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 12, color: "#f87171" }}>{err}</div>}

        {result ? (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl p-4 text-center" style={{ background: "#064e3b", border: "1px solid #065f46" }}>
                <div className="text-3xl font-bold" style={{ color: "#4ade80" }}>{result.created}</div>
                <div className="text-xs" style={{ color: "#6ee7b7" }}>Months Saved</div>
              </div>
              <div className="flex-1 rounded-xl p-4 text-center" style={{ background: "#1e1b4b", border: "1px solid #312e81" }}>
                <div className="text-3xl font-bold" style={{ color: "#818cf8" }}>{result.skipped}</div>
                <div className="text-xs" style={{ color: "#a5b4fc" }}>Skipped</div>
              </div>
            </div>
            {result.errors.length > 0 && <p className="text-xs text-red-400">{result.errors.join(" · ")}</p>}
            <button onClick={onClose} style={{ ...S.btn, width: "100%", justifyContent: "center" }}>Done</button>
          </div>
        ) : parsed ? (
          <div className="space-y-3">
            <p style={{ fontSize: 11, color: "var(--text-ghost)" }}>
              Review before importing — check each month parsed correctly. "H/W/C" and "HOT/WARM/COLD" columns were added together (assumed to be duplicate sections from the sheet). Rows with no month or that look like a repeated header row are skipped.
            </p>
            <div className="table-wrap" style={{ maxHeight: 300, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    {["Month", "Total Enq.", "Hot", "Warm", "Cold", "Not Int.", "Lost", "TD Done", "Sales (sum)"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-ghost)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((r, i) => {
                    const willImport = !!r.month && rowHasData(r);
                    return (
                    <tr key={i} style={{ opacity: willImport ? 1 : 0.4 }}>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bg-hover)", color: r.month ? "var(--text-primary)" : "#f87171", fontWeight: 600 }}>
                        {r.month || `unparsed: "${r.raw.split("\t")[0]}"`}
                        {r.month && !rowHasData(r) && <span style={{ marginLeft: 6, fontSize: 9, color: "var(--text-ghost)", fontWeight: 400 }}>(empty — skipped)</span>}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bg-hover)" }}>{r.totalEnquiries}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bg-hover)" }}>{r.hot}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bg-hover)" }}>{r.warm}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bg-hover)" }}>{r.cold}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bg-hover)" }}>{r.notInterested}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bg-hover)" }}>{r.lost}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bg-hover)" }}>{r.testDrivesDone}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bg-hover)" }}>{Object.values(r.salesBySource).reduce((s, n) => s + n, 0)}</td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setParsed(null)} style={S.ghost}>Back</button>
              <button onClick={doImport} disabled={importing} style={S.btn}>{importing ? "Saving…" : `Import ${parsed.filter(r => r.month && rowHasData(r)).length} Months`}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px]" style={{ color: "var(--text-ghost)" }}>
              Paste your tracking sheet rows (tab-separated, straight from Excel/Sheets). Column order must match: MONTH, Insta, RS, DS, CTE, META, SEO, REF, H, W, C, NOT INT, TD DONE, HOT, WARM, COLD, TTL/ENQ, then the same 7 sources again for sales, LOST, %-SALES.
            </p>
            <div className="rounded-lg p-3 font-mono text-[10px]" style={{ background: "#0f172a", color: "#4ade80", overflowX: "auto", whiteSpace: "pre" }}>{sample}</div>
            <textarea style={{ ...S.inp, width: "100%", resize: "vertical", minHeight: 180, fontFamily: "monospace", fontSize: 11 } as React.CSSProperties} value={text} onChange={e => setText(e.target.value)} placeholder="Paste rows here…" />
            <div className="flex justify-end gap-3">
              <button onClick={onClose} style={S.ghost}>Cancel</button>
              <button onClick={preview} disabled={!text.trim()} style={S.btn}>Preview</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════
export default function CarsPage() {
  const [tab, setTab] = useState<"leads" | "sellerleads" | "vehicles" | "warranty" | "followups" | "reports">("leads");
  const [monthlyReport, setMonthlyReport] = useState<any[]>([]);
  const [leads, setLeads] = useState<CarLead[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [followUps, setFollowUps] = useState<CarLead[]>([]);
  const [warrantyVehicles, setWarrantyVehicles] = useState<Vehicle[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const [showLeadModal, setShowLeadModal] = useState(false);
  const [editLead, setEditLead] = useState<CarLead | null>(null);
  const [convertLead, setConvertLead] = useState<CarLead | null>(null);
  const [acquireLead, setAcquireLead] = useState<CarLead | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [insuranceFor, setInsuranceFor] = useState<Vehicle | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showVehicleImport, setShowVehicleImport] = useState(false);
  const [showHistoricalImport, setShowHistoricalImport] = useState(false);
  const [markSoldFor, setMarkSoldFor] = useState<Vehicle | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const employeeName = (id?: string) => employees.find(e => e.id === id)?.name;

  useEffect(() => {
    api.get("/organizations/current/directory").then(r => setEmployees(r.data.data ?? [])).catch(() => {});
  }, []);

  // Deep link from the dashboard's "Today's Follow-ups" panel: ?open=<leadId>
  // opens that lead directly instead of making them hunt for it.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    setTab("leads");
    api.get(`/cars/leads/${openId}`).then(r => { setEditLead(r.data.data); setShowLeadModal(true); }).catch(() => {});
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next, { replace: true });
  }, [searchParams]);

  const [salesPeriod, setSalesPeriod] = useState<"this_month" | "last_month" | "this_year" | "all">("this_month");
  const [salesReport, setSalesReport] = useState<{ count: number; totalRevenue: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes] = await Promise.all([api.get("/cars/stats")]);
      setStats(statsRes.data.data);
      if (tab === "leads" || tab === "sellerleads") {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        params.set("leadType", tab === "sellerleads" ? "SELLER" : "BUYER");
        const r = await api.get(`/cars/leads?${params}`);
        setLeads(r.data.data.leads ?? []);
      } else if (tab === "vehicles") {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        const [vr, sr] = await Promise.all([
          api.get(`/cars/vehicles?${params}`),
          api.get(`/cars/sales-report?period=${salesPeriod}`),
        ]);
        setVehicles(vr.data.data.vehicles ?? []);
        setSalesReport(sr.data.data);
      } else if (tab === "followups") {
        const r = await api.get("/cars/leads?followUp=all&limit=200");
        setFollowUps(r.data.data.leads ?? []);
      } else if (tab === "warranty") {
        const r = await api.get("/cars/warranties");
        setWarrantyVehicles(r.data.data.vehicles ?? []);
      } else {
        const r = await api.get("/cars/leads/monthly-report?months=12");
        setMonthlyReport(r.data.data.months ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [tab, search, statusFilter, salesPeriod]);

  useEffect(() => { load(); }, [load]);

  const expiringVehicles = vehicles.filter(v => {
    const latest = v.insurances?.[0];
    if (!latest) return false;
    const days = Math.ceil((new Date(latest.endDate).getTime() - Date.now()) / 86400000);
    return days <= 30;
  });

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}><Car size={18} /> Car Resale</h1>
          <p className="text-xs" style={{ color: "var(--text-ghost)" }}>Buyer leads · Sold vehicles · Insurance renewals</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "leads" || tab === "sellerleads" ? (
            <>
              <button onClick={() => setShowImport(true)} style={S.ghost}><Upload style={{ width: 13, height: 13 }} /> Import CSV</button>
              <button onClick={() => { setEditLead(null); setShowLeadModal(true); }} style={S.btn}><Plus style={{ width: 13, height: 13 }} /> Add {tab === "sellerleads" ? "Seller " : ""}Lead</button>
            </>
          ) : tab === "vehicles" ? (
            <>
              <button onClick={() => setShowVehicleImport(true)} style={S.ghost}><Upload style={{ width: 13, height: 13 }} /> Import CSV</button>
              <button onClick={() => setShowAddVehicle(true)} style={S.btn}><Plus style={{ width: 13, height: 13 }} /> Add Vehicle</button>
            </>
          ) : tab === "reports" ? (
            <button onClick={() => setShowHistoricalImport(true)} style={S.ghost}><Upload style={{ width: 13, height: 13 }} /> Import Historical Data</button>
          ) : null}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
          {[
            { label: "Total Leads", value: stats.totalLeads, color: "#818cf8", onClick: () => { setTab("leads"); setStatusFilter(""); } },
            { label: "Hot", value: stats.byStatus?.find((s: any) => s.status === "HOT")?._count ?? 0, color: "#f87171", onClick: () => { setTab("leads"); setStatusFilter("HOT"); } },
            { label: "Urgent", value: stats.byStatus?.find((s: any) => s.status === "URGENT")?._count ?? 0, color: "#fb923c", onClick: () => { setTab("leads"); setStatusFilter("URGENT"); } },
            { label: "Total Vehicles", value: stats.totalVehicles, color: "#38bdf8", onClick: () => { setTab("vehicles"); setStatusFilter(""); } },
            { label: "In Stock", value: stats.inStock, color: "#818cf8", onClick: () => { setTab("vehicles"); setStatusFilter("IN_STOCK"); } },
            { label: "Sold", value: stats.sold, color: "#4ade80", onClick: () => { setTab("vehicles"); setStatusFilter("SOLD"); } },
            { label: "Insurance Due (30d)", value: stats.expiringSoon, color: stats.expiringSoon > 0 ? "#f87171" : "#4ade80", onClick: () => { setTab("vehicles"); setStatusFilter(""); } },
          ].map(k => (
            <button key={k.label} onClick={k.onClick} style={{ ...S.card, padding: "12px 14px", textAlign: "left", cursor: "pointer", border: "1px solid var(--border)" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = k.color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div className="text-xl font-bold" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[11px] leading-tight" style={{ color: "var(--text-ghost)" }}>{k.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
        {(["leads", "sellerleads", "vehicles", "warranty", "followups", "reports"] as const).map(tKey => (
          <button key={tKey} onClick={() => { setTab(tKey); setStatusFilter(""); setSearch(""); }}
            style={{ padding: "8px 16px", background: "none", border: "none", borderBottom: tab === tKey ? "2px solid #38bdf8" : "2px solid transparent", color: tab === tKey ? "#38bdf8" : "var(--text-ghost)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {tKey === "leads" ? "Buyer Leads" : tKey === "sellerleads" ? "Seller Leads" : tKey === "vehicles" ? "Vehicles & Insurance"
              : tKey === "warranty" ? "Warranty" : tKey === "followups" ? "Follow-ups" : "Monthly Report"}
          </button>
        ))}
      </div>

      {/* Search + filter */}
      {(tab === "leads" || tab === "sellerleads" || tab === "vehicles") && (
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative" style={{ maxWidth: 280, flex: 1 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
          <input style={{ ...S.inp, width: "100%", paddingLeft: 30 }} placeholder={tab === "vehicles" ? "Search make, model, reg. no, owner…" : "Search name, phone, model…"} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select style={S.inp} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {tab === "vehicles"
            ? Object.keys(VEHICLE_STATUS).map(s => <option key={s} value={s}>{VEHICLE_STATUS[s].label}</option>)
            : LEAD_STATUSES.map(s => <option key={s} value={s}>{LEAD_STATUS[s].label}</option>)}
        </select>
        {tab === "vehicles" && (
          <select style={S.inp} value={salesPeriod} onChange={e => setSalesPeriod(e.target.value as any)}>
            <option value="this_month">Sales: This Month</option>
            <option value="last_month">Sales: Last Month</option>
            <option value="this_year">Sales: This Year</option>
            <option value="all">Sales: All Time</option>
          </select>
        )}
      </div>
      )}

      {tab === "vehicles" && salesReport && (
        <div style={{ ...S.card, marginBottom: 16, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
              {{ this_month: "This Month", last_month: "Last Month", this_year: "This Year", all: "All Time" }[salesPeriod]} Sales
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#4ade80" }}>{salesReport.count} vehicle{salesReport.count !== 1 ? "s" : ""}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Revenue</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>₹{salesReport.totalRevenue.toLocaleString("en-IN")}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading…</div>
      ) : tab === "leads" || tab === "sellerleads" ? (
        leads.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: 40, color: "var(--text-ghost)" }}>No {tab === "sellerleads" ? "seller " : ""}leads yet — add one or import a CSV.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {leads.map(l => {
              const st = LEAD_STATUS[l.status] || LEAD_STATUS.NEW;
              return (
                <div key={l.id} style={S.card}>
                  <div className="flex items-start justify-between mb-2">
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{l.name}</div>
                    <div className="flex items-center gap-1">
                      {l.testDriveDone && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: "#14532d", color: "#4ade80", fontWeight: 700 }}>TD Done</span>}
                      {l.isDoNotCall && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: "#450a0a", color: "#f87171", fontWeight: 700 }}>DND</span>}
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: st.bg, color: st.color, fontWeight: 700 }}>{st.label}</span>
                    </div>
                  </div>
                  {(l.interestedMake || l.interestedModel) && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                      {l.leadType === "SELLER" ? "Selling: " : "Wants: "}{[l.interestedMake, l.interestedModel].filter(Boolean).join(" ")}
                    </div>
                  )}
                  {(l.budgetMin || l.budgetMax) && (
                    <div style={{ fontSize: 11, color: "var(--text-ghost)", marginBottom: 6 }}>
                      {l.leadType === "SELLER" ? "Asking" : "Budget"}: ₹{(l.budgetMin ?? 0).toLocaleString("en-IN")} – ₹{(l.budgetMax ?? 0).toLocaleString("en-IN")}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-2" style={{ fontSize: 12, color: "var(--text-ghost)" }}>
                    {l.phone && <span className="flex items-center gap-1"><Phone size={11} /> {l.phone}</span>}
                    {l.email && <span className="flex items-center gap-1"><Mail size={11} /> {l.email}</span>}
                  </div>
                  {l.notes && <div style={{ fontSize: 11, color: "var(--text-ghost)", marginBottom: 4, fontStyle: "italic" }}>"{l.notes}"</div>}
                  {employeeName(l.assignedToId) && <div style={{ fontSize: 11, color: "var(--text-ghost)", marginBottom: 8 }}>Assigned to: <strong style={{ color: "var(--text-secondary)" }}>{employeeName(l.assignedToId)}</strong></div>}
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => { setEditLead(l); setShowLeadModal(true); }} style={{ ...S.ghost, flex: 1, justifyContent: "center" }}><Pencil size={11} /> Edit</button>
                    {l.status !== "CONVERTED" && (
                      l.leadType === "SELLER" ? (
                        <button onClick={() => setAcquireLead(l)} style={{ ...S.btn, flex: 1, justifyContent: "center" }}>Buy Car <ArrowRight size={11} /></button>
                      ) : (
                        <button onClick={() => setConvertLead(l)} style={{ ...S.btn, flex: 1, justifyContent: "center" }}>Convert <ArrowRight size={11} /></button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === "vehicles" ? (
        <>
          {expiringVehicles.length > 0 && (
            <div style={{ ...S.card, borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.06)", marginBottom: 16 }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: "#f87171", fontWeight: 700, fontSize: 13 }}>
                <ShieldAlert size={15} /> Insurance Due Within 30 Days
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {expiringVehicles.map(v => {
                  const badge = insuranceBadge(v.insurances?.[0]);
                  return (
                    <div key={v.id} style={{ background: "var(--bg-hover)", borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{v.make} {v.model} {v.registrationNo ? `· ${v.registrationNo}` : ""}</div>
                        <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{v.ownerName}</div>
                      </div>
                      {badge && <span style={{ fontSize: 10, fontWeight: 700, color: badge.color }}>{badge.text}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {vehicles.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", padding: 40, color: "var(--text-ghost)" }}>No vehicles yet — convert a lead into a sale to get started.</div>
          ) : (
            <div className="table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Vehicle", "Registration", "Buyer / Seller", "Status", "Insurance", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map(v => {
                    const st = VEHICLE_STATUS[v.status] || VEHICLE_STATUS.IN_STOCK;
                    const badge = insuranceBadge(v.insurances?.[0]);
                    return (
                      <tr key={v.id}>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, borderBottom: "1px solid var(--bg-hover)" }}>
                          {v.make} {v.model} {v.variant ? <span style={{ color: "var(--text-ghost)", fontWeight: 400 }}>({v.variant})</span> : null}
                          {v.year ? <span style={{ color: "var(--text-ghost)", fontWeight: 400 }}> · {v.year}</span> : null}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)", borderBottom: "1px solid var(--bg-hover)" }}>{v.registrationNo || "—"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)", borderBottom: "1px solid var(--bg-hover)" }}>
                          {v.status === "SOLD" ? (
                            <>
                              <div>{v.ownerName || "—"} <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>(buyer)</span></div>
                              {v.ownerPhone && <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{v.ownerPhone}</div>}
                            </>
                          ) : v.sellerName ? (
                            <>
                              <div>{v.sellerName} <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>(seller)</span></div>
                              {v.sellerPhone && <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{v.sellerPhone}</div>}
                            </>
                          ) : "—"}
                          {employeeName(v.assignedToId) && <div style={{ fontSize: 10, color: "var(--text-ghost)" }}>Handled by {employeeName(v.assignedToId)}</div>}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--bg-hover)" }}>
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: st.bg, color: st.color, fontWeight: 700 }}>{st.label}</span>
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--bg-hover)" }}>
                          {badge && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, display: "flex", alignItems: "center", gap: 4 }}>
                              {badge.color === "#f87171" ? <AlertTriangle size={11} /> : <CheckCircle size={11} />} {badge.text}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--bg-hover)", whiteSpace: "nowrap" }}>
                          <div className="flex gap-2">
                            {v.status !== "SOLD" && (
                              <button onClick={() => setMarkSoldFor(v)} style={{ ...S.btn, fontSize: 11, padding: "5px 10px" }}>Mark Sold</button>
                            )}
                            <button onClick={() => setInsuranceFor(v)} style={{ ...S.ghost, fontSize: 11, padding: "5px 10px" }}>+ Insurance</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : tab === "warranty" ? (
        warrantyVehicles.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: 40, color: "var(--text-ghost)" }}>No warranty-tracked vehicles yet — set a warranty period when marking a vehicle sold.</div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Vehicle", "Registration", "Buyer", "Sold On", "Warranty"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {warrantyVehicles.map(v => {
                  const badge = warrantyBadge(v);
                  return (
                    <tr key={v.id}>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, borderBottom: "1px solid var(--bg-hover)" }}>
                        {v.make} {v.model} {v.variant ? <span style={{ color: "var(--text-ghost)", fontWeight: 400 }}>({v.variant})</span> : null}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)", borderBottom: "1px solid var(--bg-hover)" }}>{v.registrationNo || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)", borderBottom: "1px solid var(--bg-hover)" }}>
                        <div>{v.ownerName || "—"}</div>
                        {v.ownerPhone && <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{v.ownerPhone}</div>}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)", borderBottom: "1px solid var(--bg-hover)" }}>
                        {v.soldAt ? new Date(v.soldAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        {v.warrantyMonths ? <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{v.warrantyMonths} month{v.warrantyMonths !== 1 ? "s" : ""}</div> : null}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--bg-hover)" }}>
                        {badge && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, display: "flex", alignItems: "center", gap: 4 }}>
                            {badge.color === "#f87171" ? <AlertTriangle size={11} /> : <CheckCircle size={11} />} {badge.text}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : tab === "followups" ? (
        followUps.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: 40, color: "var(--text-ghost)" }}>No open leads have a follow-up date scheduled.</div>
        ) : (
          <div className="space-y-4">
            {(["overdue", "today", "upcoming"] as const).map(group => {
              const groupItems = followUps.filter(l => dueLabel(l.nextFollowUpDate).group === group);
              if (groupItems.length === 0) return null;
              const groupLabel = group === "overdue" ? "Overdue" : group === "today" ? "Due Today" : "Upcoming";
              const groupColor = group === "overdue" ? "#f87171" : group === "today" ? "#fbbf24" : "var(--text-ghost)";
              return (
                <div key={group}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: groupColor, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>{groupLabel} ({groupItems.length})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groupItems.map(l => {
                      const st = LEAD_STATUS[l.status] || LEAD_STATUS.NEW;
                      const due = dueLabel(l.nextFollowUpDate);
                      return (
                        <div key={l.id} style={S.card}>
                          <div className="flex items-start justify-between mb-2">
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{l.name}</div>
                            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, background: l.leadType === "SELLER" ? "#431407" : "#1e1b4b", color: l.leadType === "SELLER" ? "#fb923c" : "#818cf8", fontWeight: 700 }}>
                              {l.leadType === "SELLER" ? "Seller" : "Buyer"}
                            </span>
                          </div>
                          {(l.interestedMake || l.interestedModel) && (
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                              {[l.interestedMake, l.interestedModel].filter(Boolean).join(" ")}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mb-2" style={{ fontSize: 12, color: "var(--text-ghost)" }}>
                            {l.phone && <span className="flex items-center gap-1"><Phone size={11} /> {l.phone}</span>}
                          </div>
                          <div className="flex items-center justify-between">
                            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: st.bg, color: st.color, fontWeight: 700 }}>{st.label}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: due.color }}>{due.text}</span>
                          </div>
                          {l.assignedTo?.name && <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 6 }}>Assigned to: <strong style={{ color: "var(--text-secondary)" }}>{l.assignedTo.name}</strong></div>}
                          <button onClick={() => { setEditLead(l); setShowLeadModal(true); }} style={{ ...S.ghost, width: "100%", justifyContent: "center", marginTop: 8 }}><Pencil size={11} /> Edit</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Month", "Total Enq.", "Hot", "Warm", "Cold", "Not Int.", "Lost", "TD Done", "Converted", "Conv %"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyReport.map((m: any) => (
                <tr key={m.month}>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, borderBottom: "1px solid var(--bg-hover)", whiteSpace: "nowrap" }}>
                    {new Date(`${m.month}-01`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}
                    {m.isHistorical && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "var(--bg-hover)", color: "var(--text-ghost)", fontWeight: 700 }}>IMPORTED</span>}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 700, borderBottom: "1px solid var(--bg-hover)" }}>{m.totalEnquiries}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#f87171", borderBottom: "1px solid var(--bg-hover)" }}>{m.byStatus.HOT ?? 0}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#fbbf24", borderBottom: "1px solid var(--bg-hover)" }}>{m.byStatus.WARM ?? 0}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#60a5fa", borderBottom: "1px solid var(--bg-hover)" }}>{m.byStatus.COLD ?? 0}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-ghost)", borderBottom: "1px solid var(--bg-hover)" }}>{m.byStatus.NOT_INTERESTED ?? 0}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-ghost)", borderBottom: "1px solid var(--bg-hover)" }}>{m.byStatus.LOST ?? 0}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#4ade80", borderBottom: "1px solid var(--bg-hover)" }}>{m.testDrivesDone}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#4ade80", fontWeight: 700, borderBottom: "1px solid var(--bg-hover)" }}>{m.converted}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: m.conversionRate > 20 ? "#4ade80" : "var(--text-ghost)", fontWeight: 700, borderBottom: "1px solid var(--bg-hover)" }}>{m.conversionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {monthlyReport.length > 0 && (
            <div style={{ padding: "16px 12px 0" }}>
              <p style={{ fontSize: 11, color: "var(--text-ghost)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>By Source (all months shown)</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  monthlyReport.reduce((acc: Record<string, number>, m: any) => {
                    for (const [k, v] of Object.entries(m.bySource as Record<string, number>)) acc[k] = (acc[k] ?? 0) + v;
                    return acc;
                  }, {})
                ).map(([src, count]) => (
                  <span key={src} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                    {SOURCES[src] || src}: <strong style={{ color: "var(--text-primary)" }}>{count as number}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
          {monthlyReport.some((m: any) => m.salesBySource) && (
            <div style={{ padding: "12px 12px 16px" }}>
              <p style={{ fontSize: 11, color: "var(--text-ghost)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Sales by Source (imported months)</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  monthlyReport.reduce((acc: Record<string, number>, m: any) => {
                    for (const [k, v] of Object.entries((m.salesBySource ?? {}) as Record<string, number>)) acc[k] = (acc[k] ?? 0) + v;
                    return acc;
                  }, {})
                ).filter(([, count]) => (count as number) > 0).map(([src, count]) => (
                  <span key={src} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                    {SOURCES[src] || src}: <strong style={{ color: "#4ade80" }}>{count as number}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showLeadModal && <LeadModal lead={editLead} defaultLeadType={tab === "sellerleads" ? "SELLER" : "BUYER"} onClose={() => setShowLeadModal(false)} onSaved={load} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={load} />}
      {convertLead && <ConvertModal lead={convertLead} onClose={() => setConvertLead(null)} onConverted={() => { load(); setTab("vehicles"); }} />}
      {insuranceFor && <InsuranceModal vehicle={insuranceFor} onClose={() => setInsuranceFor(null)} onSaved={load} />}
      {(showAddVehicle || acquireLead) && (
        <AddVehicleModal employees={employees} lead={acquireLead} onClose={() => { setShowAddVehicle(false); setAcquireLead(null); }} onSaved={() => { load(); if (acquireLead) setTab("vehicles"); }} />
      )}
      {showVehicleImport && <VehicleImportModal onClose={() => setShowVehicleImport(false)} onImported={load} />}
      {showHistoricalImport && <HistoricalStatsModal onClose={() => setShowHistoricalImport(false)} onImported={load} />}
      {markSoldFor && <MarkSoldModal vehicle={markSoldFor} onClose={() => setMarkSoldFor(null)} onSold={load} />}
    </div>
  );
}
