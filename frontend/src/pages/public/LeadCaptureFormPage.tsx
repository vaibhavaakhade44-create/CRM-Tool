import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea" | "select" | "checkbox";
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface PublicForm {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  successMessage: string;
  organization: { name: string; logo?: string | null };
}

function FieldInput({ field, value, onChange, error }: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const base = "w-full px-4 py-3 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-indigo-500/40";
  const style = { background: "#fff", border: error ? "1px solid #ef4444" : "1px solid #e5e7eb", color: "#111" };

  if (field.type === "textarea") return (
    <div>
      <textarea rows={3} placeholder={field.placeholder} value={value} onChange={e => onChange(e.target.value)}
        className={`${base} resize-none`} style={style} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );

  if (field.type === "select") return (
    <div>
      <select value={value} onChange={e => onChange(e.target.value)} className={base} style={style}>
        <option value="">Select an option…</option>
        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );

  if (field.type === "checkbox") return (
    <div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={value === "true"} onChange={e => onChange(e.target.checked ? "true" : "")}
          className="w-4 h-4 rounded accent-indigo-600" />
        <span className="text-sm" style={{ color: "#374151" }}>{field.placeholder || field.label}</span>
      </label>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );

  return (
    <div>
      <input
        type={field.type === "phone" ? "tel" : field.type === "email" ? "email" : "text"}
        placeholder={field.placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={base}
        style={style}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function LeadCaptureFormPage() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    axios.get(`${API}/lead-forms/public/${id}`)
      .then(r => { setForm(r.data.form); setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  function validate() {
    const errs: Record<string, string> = {};
    form?.fields.forEach(f => {
      if (f.required && !values[f.id]) errs[f.id] = `${f.label} is required`;
      if (f.type === "email" && values[f.id] && !/\S+@\S+\.\S+/.test(values[f.id])) errs[f.id] = "Enter a valid email";
      if (f.type === "phone" && values[f.id] && !/^[0-9+\s\-()]{7,15}$/.test(values[f.id])) errs[f.id] = "Enter a valid phone number";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/lead-forms/public/${id}`, values);
      setSuccessMessage(r.data.message || "Thank you! We'll be in touch soon.");
      setSubmitted(true);
    } catch (err: any) {
      setErrors({ _global: err.response?.data?.message || "Submission failed. Please try again." });
    } finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f0f4ff,#faf5ff)" }}>
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f0f4ff,#faf5ff)" }}>
      <div className="text-center p-8 max-w-sm">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#fef2f2" }}>
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "#111" }}>Form Not Found</h2>
        <p className="text-sm" style={{ color: "#6b7280" }}>This form doesn't exist or has been deactivated.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f0f4ff,#faf5ff)" }}>
      <div className="text-center p-8 max-w-sm">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          <span className="text-4xl">✓</span>
        </div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: "#111" }}>Submitted!</h2>
        <p className="text-base" style={{ color: "#374151" }}>{successMessage}</p>
        <p className="text-sm mt-4" style={{ color: "#9ca3af" }}>Powered by BusinessOS</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "linear-gradient(135deg,#f0f4ff,#faf5ff)" }}>
      <div className="max-w-lg mx-auto">
        {/* Card */}
        <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: "#fff" }}>
          {/* Header bar */}
          <div className="h-1.5" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)" }} />

          <div className="p-8">
            {/* Org branding */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                {form!.organization.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: "#6b7280" }}>{form!.organization.name}</p>
                <h1 className="text-xl font-bold" style={{ color: "#111" }}>{form!.name}</h1>
              </div>
            </div>

            {form!.description && (
              <p className="text-sm mb-6" style={{ color: "#6b7280" }}>{form!.description}</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {form!.fields.map(field => (
                <div key={field.id}>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <FieldInput
                    field={field}
                    value={values[field.id] || ""}
                    onChange={v => setValues(prev => ({ ...prev, [field.id]: v }))}
                    error={errors[field.id]}
                  />
                </div>
              ))}

              {errors._global && (
                <p className="text-sm text-red-500 text-center">{errors._global}</p>
              )}

              <button type="submit" disabled={submitting}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: submitting ? "#818cf8" : "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 15px rgba(99,102,241,0.4)" }}>
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </form>
          </div>

          <div className="px-8 py-4 text-center" style={{ borderTop: "1px solid #f3f4f6" }}>
            <p className="text-xs" style={{ color: "#d1d5db" }}>Powered by BusinessOS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
