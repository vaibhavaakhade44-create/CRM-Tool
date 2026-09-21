import { useState, useEffect } from "react";
import api from "@/lib/api";

interface FieldWithValue {
  id: string; label: string; fieldKey: string; fieldType: string;
  options: string[]; isRequired: boolean; value: string;
}

interface Props {
  entity: string;
  entityId: string;
  readOnly?: boolean;
  onSave?: () => void;
}

const S = {
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 } as React.CSSProperties,
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" },
  select: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const, fontFamily: "inherit" },
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12, fontFamily: "inherit" } as React.CSSProperties,
};

export default function CustomFieldRenderer({ entity, entityId, readOnly = false, onSave }: Props) {
  const [fields, setFields] = useState<FieldWithValue[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    if (!entityId || !entity) return;
    api.get(`/custom-fields/values?entity=${entity}&entityId=${entityId}`)
      .then(r => {
        const data: FieldWithValue[] = r.data.data || [];
        setFields(data);
        const init: Record<string, string> = {};
        for (const f of data) init[f.id] = f.value || "";
        setValues(init);
      })
      .catch(() => { /* entity has no custom fields */ });
  }, [entity, entityId]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/custom-fields/values", {
        entity, entityId,
        values: fields.map(f => ({ fieldId: f.id, value: values[f.id] ?? "" })),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      onSave?.();
    } catch { /* noop */ }
    setSaving(false);
  };

  if (fields.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        Custom Fields
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {fields.map(f => (
          <div key={f.id}>
            <label style={S.label}>
              {f.label}
              {f.isRequired && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
            </label>
            {renderInput(f, values[f.id] ?? "", (v) => setValues(p => ({ ...p, [f.id]: v })), readOnly)}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={save} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save Custom Fields"}
          </button>
          {saved && <span style={{ fontSize: 12, color: "#10b981", fontWeight: 500 }}>✓ Saved</span>}
        </div>
      )}
    </div>
  );
}

function renderInput(f: FieldWithValue, value: string, onChange: (v: string) => void, readOnly: boolean) {
  const baseInput: React.CSSProperties = {
    width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8,
    padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
    ...(readOnly ? { opacity: 0.7, cursor: "default" } : {}),
  };

  switch (f.fieldType) {
    case "NUMBER":
      return <input type="number" style={baseInput} value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} />;
    case "DATE":
      return <input type="date" style={baseInput} value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} />;
    case "BOOLEAN":
      return (
        <select style={baseInput as any} value={value} disabled={readOnly} onChange={e => onChange(e.target.value)}>
          <option value="">— Select —</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    case "SELECT":
      return (
        <select style={baseInput as any} value={value} disabled={readOnly} onChange={e => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "MULTI_SELECT":
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {f.options.map(o => {
            const selected = (value || "").split(",").includes(o);
            return (
              <button
                key={o} disabled={readOnly}
                onClick={() => {
                  if (readOnly) return;
                  const cur = value ? value.split(",").filter(Boolean) : [];
                  const nxt = selected ? cur.filter(x => x !== o) : [...cur, o];
                  onChange(nxt.join(","));
                }}
                style={{ border: `1px solid ${selected ? "#6366f1" : "var(--border)"}`, background: selected ? "#6366f120" : "var(--bg-hover)", color: selected ? "#818cf8" : "var(--text-ghost)", padding: "3px 10px", borderRadius: 5, cursor: readOnly ? "default" : "pointer", fontSize: 12, fontFamily: "inherit" }}
              >{o}</button>
            );
          })}
        </div>
      );
    case "URL":
      return <input type="url" style={baseInput} placeholder="https://..." value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} />;
    case "EMAIL":
      return <input type="email" style={baseInput} placeholder="name@example.com" value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} />;
    default:
      return <input type="text" style={baseInput} value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} />;
  }
}
