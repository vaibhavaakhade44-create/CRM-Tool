import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Plus, Pencil, Trash2, GripVertical, X, Save, ToggleLeft, ToggleRight, ChevronDown } from "lucide-react";
import { useTranslation } from 'react-i18next';

const ENTITIES = [
  { key: "PARTY",          label: "Parties / Contacts" },
  { key: "LEAD",           label: "Leads" },
  { key: "INVOICE",        label: "Invoices" },
  { key: "PRODUCT",        label: "Products" },
  { key: "EMPLOYEE",       label: "Employees" },
  { key: "TICKET",         label: "Support Tickets" },
  { key: "PROJECT",        label: "Projects" },
  { key: "PATIENT",        label: "Patients" },
  { key: "PURCHASE_ORDER", label: "Purchase Orders" },
  { key: "SALES_ORDER",    label: "Sales Orders" },
];

const FIELD_TYPES = [
  { key: "TEXT",         label: "Text" },
  { key: "NUMBER",       label: "Number" },
  { key: "DATE",         label: "Date" },
  { key: "BOOLEAN",      label: "Yes / No" },
  { key: "SELECT",       label: "Single Select" },
  { key: "MULTI_SELECT", label: "Multi Select" },
  { key: "URL",          label: "URL / Link" },
  { key: "EMAIL",        label: "Email" },
];

const TYPE_BADGE: Record<string, string> = {
  TEXT: "#6366f1", NUMBER: "#f59e0b", DATE: "#10b981",
  BOOLEAN: "#06b6d4", SELECT: "#8b5cf6", MULTI_SELECT: "#ec4899", URL: "#3b82f6", EMAIL: "#ef4444",
};

const S = {
  page:   { padding: "24px 28px", background: "var(--bg-main)", minHeight: "100vh" } as React.CSSProperties,
  title:  { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  sub:    { fontSize: 13, color: "var(--text-ghost)", marginTop: 2, marginBottom: 24 } as React.CSSProperties,
  card:   { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" } as React.CSSProperties,
  toolbar:{ display: "flex", gap: 10, padding: "14px 16px", alignItems: "center", borderBottom: "1px solid var(--border)" } as React.CSSProperties,
  table:  { width: "100%", borderCollapse: "collapse" as const },
  th:     { textAlign: "left" as const, padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
  td:     { padding: "12px 14px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)", verticalAlign: "middle" as const },
  modal:  { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 },
  mbox:   { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" as const },
  input:  { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" },
  label:  { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 } as React.CSSProperties,
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const, fontFamily: "inherit" },
  btn:    { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" } as React.CSSProperties,
  eBtn:   { background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, color: "var(--text-sec)", fontFamily: "inherit" } as React.CSSProperties,
};

interface Field { id: string; entity: string; label: string; fieldKey: string; fieldType: string; options: string[]; isRequired: boolean; isActive: boolean; sortOrder: number }
interface FormState { label: string; fieldType: string; options: string; isRequired: boolean; sortOrder: number }

const emptyForm: FormState = { label: "", fieldType: "TEXT", options: "", isRequired: false, sortOrder: 0 };

export default function CustomFieldsPage() {
  const { t } = useTranslation();
  const [entity, setEntity]       = useState("PARTY");
  const [fields, setFields]       = useState<Field[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<"add" | "edit" | null>(null);
  const [editing, setEditing]     = useState<Field | null>(null);
  const [form, setForm]           = useState<FormState>(emptyForm);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [deleteId, setDeleteId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/custom-fields?entity=${entity}`);
      setFields(r.data.data || []);
    } catch { setFields([]); }
    setLoading(false);
  }, [entity]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyForm); setErr(""); setEditing(null); setModal("add"); };
  const openEdit = (f: Field) => {
    setForm({ label: f.label, fieldType: f.fieldType, options: f.options.join(", "), isRequired: f.isRequired, sortOrder: f.sortOrder });
    setEditing(f); setErr(""); setModal("edit");
  };

  const save = async () => {
    if (!form.label.trim()) { setErr("Label is required"); return; }
    setSaving(true); setErr("");
    try {
      const payload = {
        entity,
        label: form.label.trim(),
        fieldType: form.fieldType,
        options: form.options ? form.options.split(",").map(s => s.trim()).filter(Boolean) : [],
        isRequired: form.isRequired,
        sortOrder: form.sortOrder,
      };
      if (modal === "add") {
        await api.post("/custom-fields", payload);
      } else if (editing) {
        await api.patch(`/custom-fields/${editing.id}`, { label: payload.label, options: payload.options, isRequired: payload.isRequired, sortOrder: payload.sortOrder });
      }
      setModal(null); load();
    } catch (e: any) {
      setErr(e.response?.data?.message || "Save failed");
    }
    setSaving(false);
  };

  const toggleActive = async (f: Field) => {
    try { await api.patch(`/custom-fields/${f.id}`, { isActive: !f.isActive }); load(); } catch { /* noop */ }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try { await api.delete(`/custom-fields/${deleteId}`); } catch { /* noop */ }
    setDeleteId(null); load();
  };

  const needsOptions = form.fieldType === "SELECT" || form.fieldType === "MULTI_SELECT";

  return (
    <div style={S.page}>
      <h1 style={S.title}>{ t('page_custom_fields') }</h1>
      <p style={S.sub}>Add extra fields to any entity — your data your way. These appear in forms across the CRM.</p>

      <div style={S.card}>
        <div style={S.toolbar}>
          {/* Entity Selector */}
          <div style={{ position: "relative", width: 220 }}>
            <select style={{ ...S.select, paddingRight: 32 }} value={entity} onChange={e => setEntity(e.target.value)}>
              {ENTITIES.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-ghost)" }}>{fields.length} field{fields.length !== 1 ? "s" : ""}</span>
          <button onClick={openAdd} style={{ ...S.btn, marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} /> Add Field
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-ghost)" }}>Loading…</div>
        ) : fields.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗂️</div>
            <div style={{ color: "var(--text-ghost)", fontSize: 14 }}>No custom fields yet for {ENTITIES.find(e => e.key === entity)?.label}</div>
            <button onClick={openAdd} style={{ ...S.btn, marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={13} /> Add First Field</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={S.table}>
            <thead>
              <tr>{["","Label","Field Key","Type","Required","Status","Actions"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {fields.map(f => (
                <tr key={f.id}>
                  <td style={{ ...S.td, width: 28, color: "var(--text-ghost)" }}><GripVertical size={14} /></td>
                  <td style={S.td}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{f.label}</span>
                    {f.options.length > 0 && <div style={{ fontSize: 10, color: "var(--text-ghost)", marginTop: 2 }}>Options: {f.options.join(", ")}</div>}
                  </td>
                  <td style={S.td}><code style={{ fontSize: 11, background: "var(--bg-hover)", padding: "2px 6px", borderRadius: 4 }}>{f.fieldKey}</code></td>
                  <td style={S.td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: (TYPE_BADGE[f.fieldType] || "#6366f1") + "20", color: TYPE_BADGE[f.fieldType] || "#6366f1" }}>
                      {FIELD_TYPES.find(t => t.key === f.fieldType)?.label || f.fieldType}
                    </span>
                  </td>
                  <td style={{ ...S.td, textAlign: "center" as const }}>
                    {f.isRequired ? <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 12 }}>Yes</span> : <span style={{ color: "var(--text-ghost)", fontSize: 12 }}>No</span>}
                  </td>
                  <td style={S.td}>
                    <button onClick={() => toggleActive(f)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      {f.isActive
                        ? <><ToggleRight size={18} color="#10b981" /><span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>Active</span></>
                        : <><ToggleLeft size={18} color="#ef4444" /><span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>Inactive</span></>}
                    </button>
                  </td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(f)} style={{ ...S.eBtn, color: "#818cf8", border: "1px solid #6366f130" }}><Pencil size={11} /> Edit</button>
                      <button onClick={() => setDeleteId(f.id)} style={{ ...S.eBtn, color: "#ef4444", border: "1px solid #ef444430" }}><Trash2 size={11} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={S.mbox}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
              <h3 style={{ color: "var(--text-primary)", margin: 0, fontSize: 16, fontWeight: 700 }}>{modal === "add" ? "Add Custom Field" : "Edit Custom Field"}</h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {modal === "add" && (
                <div>
                  <label style={S.label}>Entity</label>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, padding: "9px 12px", background: "var(--bg-hover)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    {ENTITIES.find(e => e.key === entity)?.label}
                  </div>
                </div>
              )}

              <div>
                <label style={S.label}>Field Label <span style={{ color: "#ef4444" }}>*</span></label>
                <input style={S.input} placeholder="e.g. Lead Source, Aadhar Number" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} />
              </div>

              {modal === "add" && (
                <div>
                  <label style={S.label}>Field Type</label>
                  <select style={S.select} value={form.fieldType} onChange={e => setForm(p => ({ ...p, fieldType: e.target.value }))}>
                    {FIELD_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
              )}

              {needsOptions && (
                <div>
                  <label style={S.label}>Options <span style={{ fontWeight: 400, color: "var(--text-ghost)" }}>(comma-separated)</span></label>
                  <input style={S.input} placeholder="Option 1, Option 2, Option 3" value={form.options} onChange={e => setForm(p => ({ ...p, options: e.target.value }))} />
                </div>
              )}

              <div className="grid-r2" style={{ gap: 12 }}>
                <div>
                  <label style={S.label}>Sort Order</label>
                  <input type="number" style={S.input} value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: Number(e.target.value) }))} min={0} />
                </div>
                <div>
                  <label style={S.label}>Required?</label>
                  <button
                    onClick={() => setForm(p => ({ ...p, isRequired: !p.isRequired }))}
                    style={{ ...S.eBtn, width: "100%", justifyContent: "center", background: form.isRequired ? "#ef444418" : "var(--bg-hover)", color: form.isRequired ? "#ef4444" : "var(--text-ghost)", border: `1px solid ${form.isRequired ? "#ef444430" : "var(--border)"}` }}
                  >
                    {form.isRequired ? "Required" : "Optional"}
                  </button>
                </div>
              </div>

              {err && <div style={{ color: "#ef4444", fontSize: 12 }}>{err}</div>}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
                <button onClick={() => setModal(null)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
                <button onClick={save} disabled={saving} style={{ ...S.btn, display: "flex", alignItems: "center", gap: 6, opacity: saving ? 0.7 : 1 }}>
                  <Save size={13} /> {saving ? "Saving…" : "Save Field"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div style={{ ...S.mbox, maxWidth: 400, padding: 28 }}>
            <h3 style={{ color: "var(--text-primary)", margin: "0 0 8px", fontSize: 16 }}>Delete Custom Field?</h3>
            <p style={{ color: "var(--text-ghost)", fontSize: 13, margin: "0 0 20px" }}>
              This will permanently delete the field and <strong style={{ color: "#ef4444" }}>all stored values</strong> for it across all records.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteId(null)} style={{ ...S.btn, background: "var(--bg-hover)", color: "var(--text-sec)" }}>Cancel</button>
              <button onClick={confirmDelete} style={{ ...S.btn, background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
