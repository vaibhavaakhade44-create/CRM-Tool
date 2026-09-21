import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import CustomFieldRenderer from "@/components/CustomFieldRenderer";
import { useTranslation } from 'react-i18next';
import { kPhone, kAlpha } from "@/lib/fieldRules";
import { useAuthStore } from "@/stores/authStore";
import { isWBAOrg } from "@/lib/org";

const LEAD_FIELD_FILTER: Record<string, React.KeyboardEventHandler<HTMLInputElement>> = { phone: kPhone, phone2: kPhone, city: kAlpha };
const LEAD_FIELD_MAXLEN: Record<string, number> = { phone: 15, phone2: 15, city: 100 };
import {
  Phone, Mail, Plus, Search, X, Upload,
  User, Clock, CheckCircle, PhoneCall,
  MessageSquare, Calendar, RefreshCw, ArrowRight,
} from "lucide-react";

const S = {
  inp: { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 12, outline: "none" } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  ghost: { background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 } as React.CSSProperties,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  NEW:         { label: "New",         color: "#818cf8", bg: "#1e1b4b" },
  CONTACTED:   { label: "Contacted",   color: "#fbbf24", bg: "#451a03" },
  QUALIFIED:   { label: "Qualified",   color: "#34d399", bg: "#064e3b" },
  PROPOSAL:    { label: "Proposal",    color: "#60a5fa", bg: "#1e3a5f" },
  NEGOTIATION: { label: "Negotiation", color: "#f97316", bg: "#431407" },
  WON:         { label: "Won",         color: "#4ade80", bg: "#14532d" },
  LOST:        { label: "Lost",        color: "#f87171", bg: "#450a0a" },
};

const SOURCES = ["WEBSITE","REFERRAL","SOCIAL_MEDIA","EMAIL","PHONE","EXHIBITION","JUSTDIAL","INDIAMART","FACEBOOK","INSTAGRAM","WHATSAPP","OTHER"];
const CALL_OUTCOMES = ["ANSWERED","NO_ANSWER","BUSY","CALLBACK_REQUESTED","WRONG_NUMBER","VOICEMAIL"];
const GRADES = ["A","B","C","D"];
const GRADE_COLOR: Record<string,string> = { A:"#4ade80", B:"#60a5fa", C:"#fbbf24", D:"#f87171" };

interface Lead {
  id: string; name: string; company?: string; email?: string; phone?: string; phone2?: string;
  city?: string; industry?: string; source: string; status: string; value?: number;
  score: number; leadGrade?: string; isDoNotCall: boolean; tags: string[]; notes?: string;
  nextFollowUpDate?: string; noFollowUp?: boolean; lastContactedAt?: string; assignedToId?: string;
  assignedTo?: { name: string } | null;
  createdAt: string; campaign?: { name: string } | null;
  _count?: { activities: number; appointments: number };
}

interface Employee { id: string; name: string; designation?: string; }

// ── Activity Log Modal ────────────────────────────────────────
function LogActivityModal({ lead, wbaOrg, onClose, onSaved }: { lead: Lead; wbaOrg: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: "CALL", subject: "", description: "", outcome: "", callOutcome: "", duration: "", followUpDate: "", noFollowUp: false });
  const [saving, setSaving] = useState(false);
  const f = (k: string) => (v: string | boolean) => setForm(p => ({
...p, [k]: v }));

  // WBA: for an Answered call or a Wrong Number, offer "no follow-up needed"
  const canSkipFollowUp = wbaOrg && form.type === "CALL" && (form.callOutcome === "ANSWERED" || form.callOutcome === "WRONG_NUMBER");
  const skipFollowUp = canSkipFollowUp && form.noFollowUp;

  async function save() {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      await api.post(`/leads/${lead.id}/activities`, {
        type: form.type, subject: form.subject || undefined,
        description: form.description,
        outcome: form.outcome || undefined,
        callOutcome: form.callOutcome || undefined,
        duration: form.duration ? parseInt(form.duration) : undefined,
        followUpDate: skipFollowUp ? undefined : (form.followUpDate || undefined),
        noFollowUp: skipFollowUp || undefined,
      });
      onSaved(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-md mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Log Activity — {lead.name}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Type</label>
              <select style={{ ...S.inp, width: "100%" }} value={form.type} onChange={e => f("type")(e.target.value)}>
                {["CALL","EMAIL","WHATSAPP","MEETING","NOTE"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            {form.type === "CALL" && (
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Call Result</label>
                <select style={{ ...S.inp, width: "100%" }} value={form.callOutcome} onChange={e => f("callOutcome")(e.target.value)}>
                  <option value="">Select…</option>
                  {CALL_OUTCOMES.map(o => <option key={o} value={o}>{o.replace(/_/g," ")}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Subject</label>
            <input style={{ ...S.inp, width: "100%" }} value={form.subject} onChange={e => f("subject")(e.target.value)} placeholder="Brief summary" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Notes *</label>
            <textarea style={{ ...S.inp, width: "100%", resize: "vertical", minHeight: 80 } as React.CSSProperties} value={form.description} onChange={e => f("description")(e.target.value)} placeholder="What was discussed? Next steps?" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {form.type === "CALL" && (
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Duration (min)</label>
                <input style={{ ...S.inp, width: "100%" }} type="number" value={form.duration} onChange={e => f("duration")(e.target.value)} placeholder="5" />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Schedule Follow-up</label>
              {skipFollowUp
                ? <div className="text-xs" style={{ color: "var(--text-ghost)", padding: "9px 0" }}>No follow-up scheduled</div>
                : <input style={{ ...S.inp, width: "100%" }} type="datetime-local" value={form.followUpDate} onChange={e => f("followUpDate")(e.target.value)} />}
            </div>
          </div>
          {canSkipFollowUp && (
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={form.noFollowUp} onChange={e => f("noFollowUp")(e.target.checked)} />
              No follow-up needed for this lead
            </label>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={save} disabled={saving || !form.description.trim()} style={S.btn}>{saving ? "Saving…" : "Log Activity"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Book Appointment Modal ────────────────────────────────────
function BookAppointmentModal({ lead, onClose, onSaved }: { lead: Lead; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: `Meeting with ${lead.name}`, scheduledAt: "", duration: "30", location: "", meetingLink: "" });
  const [saving, setSaving] = useState(false);
  const f = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    if (!form.scheduledAt) return;
    setSaving(true);
    try {
      await api.post("/appointments", { leadId: lead.id, title: form.title, scheduledAt: form.scheduledAt, duration: parseInt(form.duration), location: form.location || undefined, meetingLink: form.meetingLink || undefined });
      onSaved(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-sm mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Book Appointment</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Title</label>
            <input style={{ ...S.inp, width: "100%" }} value={form.title} onChange={e => f("title")(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Date & Time</label>
              <input style={{ ...S.inp, width: "100%" }} type="datetime-local" value={form.scheduledAt} onChange={e => f("scheduledAt")(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Duration</label>
              <select style={{ ...S.inp, width: "100%" }} value={form.duration} onChange={e => f("duration")(e.target.value)}>
                {["15","30","45","60","90","120"].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Location</label>
            <input style={{ ...S.inp, width: "100%" }} value={form.location} onChange={e => f("location")(e.target.value)} placeholder="Office / Zoom / Phone call" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Meeting Link</label>
            <input style={{ ...S.inp, width: "100%" }} value={form.meetingLink} onChange={e => f("meetingLink")(e.target.value)} placeholder="https://meet.google.com/..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={save} disabled={saving || !form.scheduledAt} style={S.btn}><Calendar style={{ width: 12, height: 12 }} />{saving ? "Booking…" : "Book"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Lead Form Modal ───────────────────────────────────────────
export function LeadFormModal({ lead, employees, campaigns, onClose, onSaved }: { lead?: Lead | null; employees: Employee[]; campaigns?: any[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: lead?.name ?? "", company: lead?.company ?? "", email: lead?.email ?? "",
    phone: lead?.phone ?? "", phone2: lead?.phone2 ?? "", city: lead?.city ?? "",
    industry: lead?.industry ?? "", source: lead?.source ?? "OTHER", status: lead?.status ?? "NEW",
    value: lead?.value?.toString() ?? "", assignedToId: lead?.assignedToId ?? "",
    notes: lead?.notes ?? "", leadGrade: lead?.leadGrade ?? "", isDoNotCall: lead?.isDoNotCall ?? false,
    nextFollowUpDate: lead?.nextFollowUpDate ? lead.nextFollowUpDate.substring(0, 16) : "",
    tags: lead?.tags?.join(", ") ?? "",
  });
  const [saving, setSaving] = useState(false);
  const f = (k: string) => (v: any) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name, company: form.company || undefined, email: form.email || undefined,
        phone: form.phone || undefined, phone2: form.phone2 || undefined, city: form.city || undefined,
        industry: form.industry || undefined, source: form.source, status: form.status,
        value: form.value ? parseFloat(form.value) : undefined,
        assignedToId: form.assignedToId || undefined, notes: form.notes || undefined,
        leadGrade: form.leadGrade || undefined, isDoNotCall: form.isDoNotCall,
        nextFollowUpDate: form.nextFollowUpDate || undefined,
        tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      };
      if (lead) await api.patch(`/leads/${lead.id}`, payload);
      else await api.post("/leads", payload);
      onSaved(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center py-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-5 w-full max-w-xl mx-4 max-h-[88vh] overflow-y-auto" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{lead ? "Edit Lead" : "Add Lead"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[["Name *","name","text","Full name"],["Company","company","text","Company"],["Phone","phone","text","+91 98765"],["Alt Phone","phone2","text","Alternate"],["Email","email","email","email@..."],["City","city","text","Mumbai"]].map(([l,k,t,ph]) => (
              <div key={String(k)}>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>{l}</label>
                <input
                  style={{ ...S.inp, width: "100%" }} type={String(t)} value={(form as any)[k as string]} onChange={e => f(k as string)(e.target.value)} placeholder={String(ph)}
                  onKeyDown={LEAD_FIELD_FILTER[k as string]} maxLength={LEAD_FIELD_MAXLEN[k as string]}
                />
              </div>
            ))}
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Source</label>
              <select style={{ ...S.inp, width: "100%" }} value={form.source} onChange={e => f("source")(e.target.value)}>
                {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Status</label>
              <select style={{ ...S.inp, width: "100%" }} value={form.status} onChange={e => f("status")(e.target.value)}>
                {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Grade</label>
              <select style={{ ...S.inp, width: "100%" }} value={form.leadGrade} onChange={e => f("leadGrade")(e.target.value)}>
                <option value="">Not rated</option>
                {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Deal Value (₹)</label>
              <input style={{ ...S.inp, width: "100%" }} type="number" value={form.value} onChange={e => f("value")(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Assign To</label>
              <select style={{ ...S.inp, width: "100%" }} value={form.assignedToId} onChange={e => f("assignedToId")(e.target.value)}>
                <option value="">Unassigned</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Next Follow-up</label>
              <input style={{ ...S.inp, width: "100%" }} type="datetime-local" value={form.nextFollowUpDate} onChange={e => f("nextFollowUpDate")(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Industry</label>
            <input style={{ ...S.inp, width: "100%" }} value={form.industry} onChange={e => f("industry")(e.target.value)} placeholder="Real Estate, IT, Manufacturing..." />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Tags</label>
            <input style={{ ...S.inp, width: "100%" }} value={form.tags} onChange={e => f("tags")(e.target.value)} placeholder="hot, vip, enterprise" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Notes</label>
            <textarea style={{ ...S.inp, width: "100%", resize: "vertical", minHeight: 60 } as React.CSSProperties} value={form.notes} onChange={e => f("notes")(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isDoNotCall} onChange={e => f("isDoNotCall")(e.target.checked)} />
            <span className="text-xs" style={{ color: "#f87171" }}>Do Not Call (DNC)</span>
          </label>
        </div>
        {lead?.id && <CustomFieldRenderer entity="LEAD" entityId={lead.id} />}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} style={S.ghost}>Cancel</button>
          <button onClick={save} disabled={saving || !form.name.trim()} style={S.btn}>{saving ? "Saving…" : lead ? "Update" : "Add Lead"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Import Modal ─────────────────────────────────────────
function ImportModal({ campaigns, onClose, onImported }: { campaigns: any[]; onClose: () => void; onImported: () => void }) {
  const [csvText, setCsvText] = useState("");
  const [source, setSource] = useState("OTHER");
  const [campaignId, setCampaignId] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);

  const sample = `name,phone,email,company,city\nRaj Patel,9876543210,raj@abc.com,ABC Corp,Mumbai\nPriya Singh,9123456789,,XYZ Ltd,Delhi`;

  async function doImport() {
    if (!csvText.trim()) return;
    setImporting(true);
    try {
      const lines = csvText.trim().split("\n");
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/^"(.*)"$/, "$1"));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
        return obj;
      });
      const r = await api.post("/leads/bulk-import", { leads: rows, source, campaignId: campaignId || undefined });
      setResult(r.data.data);
      if (r.data.data.created > 0) onImported();
    } catch (e: any) {
      setResult({ created: 0, skipped: 0, errors: [e.response?.data?.message ?? "Import failed"] });
    }
    setImporting(false);
  }

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
            <div className="rounded-lg p-3 font-mono text-[10px]" style={{ background: "#0f172a", color: "#4ade80" }}>{sample}</div>
            <p className="text-[11px]" style={{ color: "var(--text-ghost)" }}>Supports JustDial, Facebook Leads, IndiaMart CSV exports. Columns: name, phone, email, company, city</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Source</label>
                <select style={{ ...S.inp, width: "100%" }} value={source} onChange={e => setSource(e.target.value)}>
                  {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Campaign</label>
                <select style={{ ...S.inp, width: "100%" }} value={campaignId} onChange={e => setCampaignId(e.target.value)}>
                  <option value="">None</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--text-ghost)" }}>Paste CSV Data</label>
              <textarea style={{ ...S.inp, width: "100%", resize: "vertical", minHeight: 140, fontFamily: "monospace", fontSize: 11 } as React.CSSProperties} value={csvText} onChange={e => setCsvText(e.target.value)} placeholder={sample} />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={onClose} style={S.ghost}>Cancel</button>
              <button onClick={doImport} disabled={importing || !csvText.trim()} style={S.btn}><Upload style={{ width: 12, height: 12 }} />{importing ? "Importing…" : "Import"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lead Card ─────────────────────────────────────────────────
function LeadCard({ lead, employees, wbaOrg, onLog, onBook, onEdit, onRefresh }: {
  lead: Lead; employees: Employee[]; wbaOrg: boolean; onLog: () => void; onBook: () => void; onEdit: () => void; onRefresh: () => void;
}) {
  const now = new Date();
  const closed = lead.status === "WON" || lead.status === "LOST";
  const explicitFollowUp = lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate) : null;
  // WBA: with no follow-up date set, a lead is due 48h after last contact (or creation),
  // unless it's been explicitly marked "no follow-up needed".
  const implicitDue = (wbaOrg && !explicitFollowUp && !lead.noFollowUp && !closed)
    ? new Date(new Date(lead.lastContactedAt ?? lead.createdAt).getTime() + 48 * 3600 * 1000)
    : null;
  const followUpDate = explicitFollowUp ?? implicitDue;
  const isImplied = !explicitFollowUp && !!implicitDue;
  const isOverdue = !!followUpDate && followUpDate < now && !closed;
  const isDueToday = !!followUpDate && !isOverdue && followUpDate.toDateString() === now.toDateString();
  const assignee = employees.find(e => e.id === lead.assignedToId);

  async function convertToDeal() {
    if (!window.confirm(`Convert "${lead.name}" to a Deal?`)) return;
    await api.post(`/leads/${lead.id}/convert`);
    onRefresh();
  }

  return (
    <div className="rounded-xl p-4 transition-colors"
      style={{ background: "var(--bg-card)", border: `1px solid ${lead.isDoNotCall ? "#7f1d1d" : "var(--border)"}` }}>
      <div className="flex items-start gap-3 mb-2.5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          {lead.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{lead.name}</span>
            {lead.leadGrade && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 99, fontWeight: 700, background: "#0f172a", color: GRADE_COLOR[lead.leadGrade] }}>G{lead.leadGrade}</span>}
            {lead.isDoNotCall && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 99, background: "#450a0a", color: "#f87171", fontWeight: 700 }}>DNC</span>}
          </div>
          {lead.company && <p className="text-xs" style={{ color: "var(--text-ghost)" }}>{lead.company}{lead.city ? ` · ${lead.city}` : ""}</p>}
        </div>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, fontWeight: 700, background: STATUS_CONFIG[lead.status]?.bg, color: STATUS_CONFIG[lead.status]?.color, flexShrink: 0 }}>
          {STATUS_CONFIG[lead.status]?.label}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-2.5 flex-wrap">
        {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs" style={{ color: "#60a5fa", textDecoration: "none" }}><Phone style={{ width: 10, height: 10 }} />{lead.phone}</a>}
        {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-xs" style={{ color: "#818cf8", textDecoration: "none" }}><Mail style={{ width: 10, height: 10 }} />{lead.email}</a>}
        {lead.value ? <span className="text-xs font-semibold ml-auto" style={{ color: "#4ade80" }}>₹{lead.value.toLocaleString("en-IN")}</span> : null}
      </div>

      {followUpDate && (
        <div className="flex items-center gap-1.5 mb-2.5 text-xs px-2 py-1.5 rounded-lg" style={{ background: isOverdue ? "#450a0a" : isDueToday ? "#451a03" : "#1e1b4b", color: isOverdue ? "#f87171" : isDueToday ? "#fbbf24" : "#818cf8" }}>
          <Clock style={{ width: 10, height: 10 }} />
          {isOverdue ? "⚠ Overdue: " : isDueToday ? "Today: " : isImplied ? "Follow-up by: " : "Follow-up: "}
          {followUpDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} {followUpDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          {isImplied && <span style={{ opacity: 0.7, marginLeft: 4 }}>(auto)</span>}
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "var(--bg-hover)", color: "var(--text-ghost)" }}>{lead.source.replace(/_/g," ")}</span>
        {lead.tags.slice(0,2).map(t => <span key={t} style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "#1e1b4b", color: "#a5b4fc" }}>{t}</span>)}
        {assignee && <span className="ml-auto flex items-center gap-1 text-[10px]" style={{ color: "var(--text-ghost)" }}><User style={{ width: 9, height: 9 }} />{assignee.name}</span>}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {!lead.isDoNotCall && lead.phone && (
          <a href={`tel:${lead.phone}`} style={{ ...S.ghost, padding: "5px 9px", fontSize: 11, textDecoration: "none" }}><PhoneCall style={{ width: 10, height: 10 }} /> Call</a>
        )}
        {!lead.isDoNotCall && lead.phone && (
          <a href={`https://wa.me/${lead.phone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer"
            style={{ ...S.ghost, padding: "5px 9px", fontSize: 11, color: "#4ade80", textDecoration: "none" }}>
            <MessageSquare style={{ width: 10, height: 10 }} /> WA
          </a>
        )}
        <button onClick={onLog} style={{ ...S.ghost, padding: "5px 9px", fontSize: 11 }}><CheckCircle style={{ width: 10, height: 10 }} /> Log</button>
        <button onClick={onBook} style={{ ...S.ghost, padding: "5px 9px", fontSize: 11 }}><Calendar style={{ width: 10, height: 10 }} /> Book</button>
        <button onClick={onEdit} style={{ ...S.ghost, padding: "5px 9px", fontSize: 11 }}>Edit</button>
        {(lead.status === "QUALIFIED" || lead.status === "PROPOSAL") && (
          <button onClick={convertToDeal} style={{ ...S.btn, padding: "5px 9px", fontSize: 11, marginLeft: "auto" }}>
            <ArrowRight style={{ width: 10, height: 10 }} /> Deal
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function LeadsPage() {
  const { t } = useTranslation();
  const { activeOrg } = useAuthStore();
  const wbaOrg = isWBAOrg(activeOrg);
  const [tab, setTab] = useState<"queue"|"all"|"kanban">("queue");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAdd, setShowAdd] = useState(searchParams.get("quickAdd") === "lead");
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [logLead, setLogLead] = useState<Lead | null>(null);
  const [bookLead, setBookLead] = useState<Lead | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (tab === "queue") params.set("myQueue", "true");
      else {
        if (search) params.set("search", search);
        if (filterStatus) params.set("status", filterStatus);
        if (filterSource) params.set("source", filterSource);
        if (filterGrade) params.set("grade", filterGrade);
      }
      const [lr, sr] = await Promise.all([api.get(`/leads?${params}`), api.get("/leads/stats")]);
      setLeads(lr.data.data.leads ?? []);
      setTotal(lr.data.data.total ?? 0);
      setStats(sr.data.data);
    } catch {}
    setLoading(false);
  }, [tab, search, filterStatus, filterSource, filterGrade, page]);

  useEffect(() => {
    load();
    // Directory (not /hr) — assignable to everyone regardless of HR module access,
    // so "Assign To" shows the same people list no matter who's opening this form.
    api.get("/organizations/current/directory").then(r => setEmployees(r.data.data ?? [])).catch(() => {});
    api.get("/leads/campaigns").then(r => setCampaigns(r.data.data ?? [])).catch(() => {});
  }, [load]);

  // Deep link from the dashboard's "Today's Follow-ups" panel: ?open=<leadId>
  // opens that lead's Log Activity modal directly instead of making them hunt for it.
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    api.get(`/leads/${openId}`).then(r => setLogLead(r.data.data)).catch(() => {});
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next, { replace: true });
  }, [searchParams]);

  const kanbanCols = Object.entries(STATUS_CONFIG).map(([s, cfg]) => ({ status: s, ...cfg, leads: leads.filter(l => l.status === s) }));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Lead Management</h1>
          <p className="text-xs" style={{ color: "var(--text-ghost)" }}>Cold calling · Follow-ups · Appointments · Automation</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} style={S.ghost}><Upload style={{ width: 13, height: 13 }} /> Import CSV</button>
          <button onClick={() => setShowAdd(true)} style={S.btn}><Plus style={{ width: 13, height: 13 }} /> Add Lead</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
          {[
            { label: "Total", value: stats.total, color: "#818cf8" },
            { label: "My Queue", value: stats.myQueue, color: "#60a5fa" },
            { label: "Follow-ups Today", value: stats.todayFollowUps, color: "#fbbf24" },
            { label: "Overdue", value: stats.overdue, color: "#f87171" },
            { label: "Won", value: stats.won, color: "#4ade80" },
            { label: "Lost", value: stats.lost, color: "#94a3b8" },
            { label: "Conv %", value: `${stats.convRate}%`, color: stats.convRate > 20 ? "#4ade80" : "#fbbf24" },
          ].map(k => (
            <div key={k.label} style={{ ...S.card, padding: "12px 14px" }}>
              <div className="text-xl font-bold" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[11px] leading-tight" style={{ color: "var(--text-ghost)" }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        {(["queue","all","kanban"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className="px-4 py-2 text-xs font-semibold"
            style={{ background: "none", border: "none", cursor: "pointer", color: tab === t ? "#6366f1" : "var(--text-ghost)", borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent" }}>
            {t === "queue" ? "My Call Queue" : t === "all" ? "All Leads" : "Pipeline"}
          </button>
        ))}
      </div>

      {/* Filters for All tab */}
      {tab !== "kanban" && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {tab === "all" && (
            <div className="relative">
              <Search style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--text-ghost)" }} />
              <input style={{ ...S.inp, paddingLeft: 30, width: 180 }} placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
          )}
          {tab === "all" && <>
            <select style={S.inp} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
              <option value="">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select style={S.inp} value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1); }}>
              <option value="">All Sources</option>
              {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
            </select>
            <select style={S.inp} value={filterGrade} onChange={e => { setFilterGrade(e.target.value); setPage(1); }}>
              <option value="">All Grades</option>
              {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </>}
          <button onClick={load} style={S.ghost}><RefreshCw style={{ width: 13, height: 13 }} /></button>
          <span className="text-xs ml-auto" style={{ color: "var(--text-ghost)" }}>{total} leads</span>
        </div>
      )}

      {/* Content */}
      {tab === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {kanbanCols.map(col => (
            <div key={col.status} className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 230, background: "var(--bg-hover)", border: "1px solid var(--border)" }}>
              <div className="px-3 py-2.5 flex items-center justify-between" style={{ background: col.bg }}>
                <span className="text-xs font-bold" style={{ color: col.color }}>{col.label}</span>
                <span style={{ fontSize: 10, background: "rgba(0,0,0,0.3)", color: col.color, padding: "1px 6px", borderRadius: 99, fontWeight: 700 }}>{col.leads.length}</span>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
                {col.leads.map(lead => (
                  <div key={lead.id} onClick={() => setEditLead(lead)} className="rounded-lg p-2.5 cursor-pointer"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>{lead.name}</p>
                    {lead.company && <p className="text-[10px] mb-1" style={{ color: "var(--text-ghost)" }}>{lead.company}</p>}
                    {lead.phone && <p className="text-[10px] flex items-center gap-1" style={{ color: "#60a5fa" }}><Phone style={{ width: 9, height: 9 }} />{lead.phone}</p>}
                    <div className="flex items-center gap-1 mt-1.5">
                      {lead.leadGrade && <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "#0f172a", color: GRADE_COLOR[lead.leadGrade], fontWeight: 700 }}>G{lead.leadGrade}</span>}
                      {lead.isDoNotCall && <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "#450a0a", color: "#f87171", fontWeight: 700 }}>DNC</span>}
                      {lead.value ? <span className="ml-auto text-[10px] font-semibold" style={{ color: "#4ade80" }}>₹{lead.value.toLocaleString("en-IN")}</span> : null}
                    </div>
                  </div>
                ))}
                {col.leads.length === 0 && <p className="text-center text-xs py-6" style={{ color: "var(--text-ghost)" }}>No leads</p>}
              </div>
            </div>
          ))}
        </div>
      ) : loading ? (
        <div className="text-center py-12" style={{ color: "var(--text-ghost)" }}>Loading leads…</div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <User style={{ width: 36, height: 36, color: "var(--text-ghost)", opacity: 0.3 }} />
          <p className="text-sm" style={{ color: "var(--text-ghost)" }}>
            {tab === "queue" ? "No leads assigned to you" : "No leads found"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {leads.map(lead => (
              <LeadCard key={lead.id} lead={lead} employees={employees} wbaOrg={wbaOrg}
                onLog={() => setLogLead(lead)} onBook={() => setBookLead(lead)}
                onEdit={() => setEditLead(lead)} onRefresh={load} />
            ))}
          </div>
          {total > 30 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={S.ghost}>← Prev</button>
              <span className="text-xs" style={{ color: "var(--text-ghost)" }}>Page {page} of {Math.ceil(total/30)}</span>
              <button disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)} style={S.ghost}>Next →</button>
            </div>
          )}
        </>
      )}

      {showAdd && <LeadFormModal employees={employees} campaigns={campaigns} onClose={() => { setShowAdd(false); if (searchParams.get("quickAdd")) { searchParams.delete("quickAdd"); setSearchParams(searchParams, { replace: true }); } }} onSaved={load} />}
      {editLead && <LeadFormModal lead={editLead} employees={employees} campaigns={campaigns} onClose={() => setEditLead(null)} onSaved={load} />}
      {logLead && <LogActivityModal lead={logLead} wbaOrg={wbaOrg} onClose={() => setLogLead(null)} onSaved={load} />}
      {bookLead && <BookAppointmentModal lead={bookLead} onClose={() => setBookLead(null)} onSaved={load} />}
      {showImport && <ImportModal campaigns={campaigns} onClose={() => setShowImport(false)} onImported={load} />}
    </div>
  );
}
