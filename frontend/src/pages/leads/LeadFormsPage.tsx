import { useState, useEffect } from "react";
import { Plus, Link2, Copy, Check, Trash2, ToggleLeft, ToggleRight, Eye, Users, FileText, GripVertical, X } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from 'react-i18next';

interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea" | "select" | "checkbox";
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface LeadForm {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  isActive: boolean;
  defaultSource: string;
  submitCount: number;
  createdAt: string;
}

const FIELD_TYPES = [
  { value: "text", label: "Short Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "textarea", label: "Long Text" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

const SOURCE_OPTIONS = ["WEBSITE", "FACEBOOK", "INSTAGRAM", "GOOGLE", "JUSTDIAL", "INDIAMART", "WHATSAPP", "REFERRAL", "OTHER"];

const DEFAULT_FIELDS: FormField[] = [
  { id: "f_name", label: "Full Name", type: "text", placeholder: "Enter your name", required: true },
  { id: "f_phone", label: "Phone Number", type: "phone", placeholder: "Your mobile number", required: true },
  { id: "f_email", label: "Email Address", type: "email", placeholder: "your@email.com", required: false },
  { id: "f_company", label: "Company / Business", type: "text", placeholder: "Your company name", required: false },
];

function newFieldId() { return `f_${Math.random().toString(36).slice(2, 8)}`; }

// ── Field editor row ──────────────────────────────────────────
function FieldRow({ field, onUpdate, onDelete }: { field: FormField; onUpdate: (f: FormField) => void; onDelete: () => void }) {
  const [optionsText, setOptionsText] = useState(field.options?.join("\n") || "");

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-ghost)" }} />
        <input
          type="text"
          placeholder="Field label"
          value={field.label}
          onChange={e => onUpdate({ ...field, label: e.target.value })}
          className="flex-1 px-2 py-1.5 rounded-lg text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
        />
        <select
          value={field.type}
          onChange={e => onUpdate({ ...field, type: e.target.value as any })}
          className="px-2 py-1.5 rounded-lg text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
        >
          {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={field.required} onChange={e => onUpdate({ ...field, required: e.target.checked })} />
          Required
        </label>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/10 flex-shrink-0">
          <X className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
      <input
        type="text"
        placeholder="Placeholder text (optional)"
        value={field.placeholder || ""}
        onChange={e => onUpdate({ ...field, placeholder: e.target.value })}
        className="w-full px-2 py-1.5 rounded-lg text-xs"
        style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-secondary)" }}
      />
      {field.type === "select" && (
        <textarea
          rows={2}
          placeholder="Options (one per line)"
          value={optionsText}
          onChange={e => { setOptionsText(e.target.value); onUpdate({ ...field, options: e.target.value.split("\n").filter(Boolean) }); }}
          className="w-full px-2 py-1.5 rounded-lg text-xs resize-none"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-secondary)" }}
        />
      )}
    </div>
  );
}

// ── Form builder modal ────────────────────────────────────────
function FormBuilderModal({ form, onClose, onSaved }: { form?: LeadForm | null; onClose: () => void; onSaved: () => void }) {
  const { activeOrg } = useAuthStore();
  const [name, setName] = useState(form?.name ?? "");
  const [description, setDescription] = useState(form?.description ?? "");
  const [fields, setFields] = useState<FormField[]>(form?.fields ?? DEFAULT_FIELDS);
  const [source, setSource] = useState(form?.defaultSource ?? "WEBSITE");
  const [successMsg, setSuccessMsg] = useState("Thank you! We'll be in touch soon.");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addField() {
    setFields(f => [...f, { id: newFieldId(), label: "New Field", type: "text", required: false }]);
  }

  function updateField(idx: number, updated: FormField) {
    setFields(f => f.map((x, i) => i === idx ? updated : x));
  }

  function removeField(idx: number) {
    setFields(f => f.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!name.trim()) { setError("Form name is required"); return; }
    if (fields.length === 0) { setError("Add at least one field"); return; }
    setSaving(true); setError("");
    try {
      const payload = { name, description: description || undefined, fields, defaultSource: source, successMessage: successMsg };
      if (form) await api.patch(`/lead-forms/${form.id}`, payload, { headers: { "x-organization-id": activeOrg?.id } });
      else await api.post("/lead-forms", payload, { headers: { "x-organization-id": activeOrg?.id } });
      onSaved(); onClose();
    } catch (err: any) { setError(err.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between p-5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{form ? "Edit Form" : "New Lead Capture Form"}</h2>
          <button onClick={onClose} style={{ color: "var(--text-ghost)" }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Form Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Contact Us" className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Lead Source</label>
              <select value={source} onChange={e => setSource(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}>
                {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional subtitle shown on the form" className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Form Fields</label>
              <button onClick={addField} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                <Plus className="w-3 h-3" /> Add Field
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <FieldRow key={f.id} field={f} onUpdate={u => updateField(i, u)} onDelete={() => removeField(i)} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Success Message</label>
            <input value={successMsg} onChange={e => setSuccessMsg(e.target.value)} placeholder="Message shown after submission" className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }} />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex gap-2 p-5 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: saving ? "#4338ca99" : "#4f46e5" }}>
            {saving ? "Saving…" : form ? "Update Form" : "Create Form"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Form card ─────────────────────────────────────────────────
function FormCard({ form, onEdit, onDelete, onToggle }: {
  form: LeadForm;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const publicUrl = `${window.location.origin}/forms/${form.id}`;

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: `1px solid ${form.isActive ? "rgba(99,102,241,0.2)" : "var(--border)"}`, opacity: form.isActive ? 1 : 0.65 }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{form.name}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>
            {form.fields?.length || 0} fields · {form.submitCount} submissions · {form.defaultSource}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onToggle}>
            {form.isActive
              ? <ToggleRight className="w-6 h-6" style={{ color: "#818cf8" }} />
              : <ToggleLeft className="w-6 h-6" style={{ color: "var(--text-ghost)" }} />}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-indigo-500/10">
            <FileText className="w-3.5 h-3.5" style={{ color: "#818cf8" }} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>

      {/* Share link */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: "var(--bg-hover)" }}>
        <Link2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-ghost)" }} />
        <span className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{publicUrl}</span>
        <button onClick={copyLink} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg flex-shrink-0"
          style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
        <a href={publicUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg flex-shrink-0"
          style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}>
          <Eye className="w-3 h-3" /> Preview
        </a>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function LeadFormsPage() {
  const { t } = useTranslation();
  const { activeOrg } = useAuthStore();
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing, setEditing] = useState<LeadForm | null>(null);

  const orgHeader = { headers: { "x-organization-id": activeOrg?.id } };

  async function load() {
    try {
      const r = await api.get("/lead-forms", orgHeader);
      setForms(Array.isArray(r.data?.data) ? r.data.data : []);
    } catch { setForms([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (activeOrg) load(); }, [activeOrg]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this form? All submissions will be lost.")) return;
    await api.delete(`/lead-forms/${id}`, orgHeader);
    setForms(f => f.filter(x => x.id !== id));
  }

  async function handleToggle(form: LeadForm) {
    await api.patch(`/lead-forms/${form.id}`, { isActive: !form.isActive }, orgHeader);
    setForms(f => f.map(x => x.id === form.id ? { ...x, isActive: !x.isActive } : x));
  }

  const totalSubmissions = forms.reduce((s, f) => s + f.submitCount, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <FileText className="w-5 h-5" style={{ color: "#818cf8" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Lead Capture Forms</h1>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Create public forms, share the link — submissions become leads automatically.
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowBuilder(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 12px rgba(99,102,241,0.35)" }}>
          <Plus className="w-4 h-4" /> New Form
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Forms", value: forms.length, color: "#818cf8" },
          { label: "Active Forms", value: forms.filter(f => f.isActive).length, color: "#34d399" },
          { label: "Total Submissions", value: totalSubmissions, color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : forms.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(99,102,241,0.1)" }}>
            <FileText className="w-7 h-7" style={{ color: "#818cf8" }} />
          </div>
          <h3 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>No forms yet</h3>
          <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
            Create your first form and share the link on WhatsApp, social media, or your website.
          </p>
          <button onClick={() => setShowBuilder(true)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: "#4f46e5" }}>
            Create First Form
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {forms.map(form => (
            <FormCard
              key={form.id}
              form={form}
              onEdit={() => { setEditing(form); setShowBuilder(true); }}
              onDelete={() => handleDelete(form.id)}
              onToggle={() => handleToggle(form)}
            />
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="mt-8 rounded-2xl p-5" style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.12)" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "#818cf8" }}>How Lead Forms Work</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { step: "1", title: "Build Your Form", desc: "Add fields like name, phone, email, city, requirements." },
            { step: "2", title: "Share the Link", desc: "Copy the link and share on WhatsApp, Instagram bio, website, or Google Ads." },
            { step: "3", title: "Leads Auto-Created", desc: "Every submission instantly creates a lead in your CRM, ready for follow-up." },
          ].map(s => (
            <div key={s.step} className="p-3 rounded-xl text-center" style={{ background: "var(--bg-card)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center mx-auto mb-2 text-xs font-bold text-white" style={{ background: "#4f46e5" }}>{s.step}</div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{s.title}</p>
              <p className="text-[11px]" style={{ color: "var(--text-ghost)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {showBuilder && (
        <FormBuilderModal
          form={editing}
          onClose={() => { setShowBuilder(false); setEditing(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}
