import { useState, useRef } from "react";
import { Upload, X, Download, CheckCircle, AlertCircle, FileText } from "lucide-react";
import api from "@/lib/api";

interface ColumnDef { key: string; label: string; required?: boolean; }

interface BulkImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  endpoint: string;
  columns: ColumnDef[];
  sampleRows: Record<string, string>[];
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || [];
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || "").trim().replace(/^"|"$/g, ""); });
    return row;
  }).filter(r => Object.values(r).some(v => v));
}

function downloadTemplate(columns: ColumnDef[], sampleRows: Record<string, string>[]) {
  const header = columns.map(c => c.label).join(",");
  const rows = sampleRows.map(r => columns.map(c => r[c.key] ?? "").join(","));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "import_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function BulkImportModal({ onClose, onSuccess, title, endpoint, columns, sampleRows }: BulkImportModalProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [parseError, setParseError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setParseError(""); setResult(null);
    if (!file.name.endsWith(".csv")) { setParseError("Only .csv files are supported."); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const parsed = parseCSV(e.target?.result as string);
      if (!parsed.length) { setParseError("No valid rows found. Check the file format."); return; }
      setRows(parsed);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (!rows.length) return;
    setUploading(true);
    try {
      const r = await api.post(endpoint, { rows });
      setResult(r.data.data);
      if ((r.data.data?.created ?? 0) > 0) onSuccess();
    } catch (err: any) {
      setParseError(err?.response?.data?.message || "Upload failed. Please try again.");
    }
    setUploading(false);
  };

  const previewCols = columns.slice(0, 5);

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-ghost)" }}>Upload a CSV file to import records in bulk</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Template download */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Download CSV Template</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-ghost)" }}>Use this template to format your data correctly</p>
            </div>
            <button
              onClick={() => downloadTemplate(columns, sampleRows)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              <Download size={13} /> Template
            </button>
          </div>

          {/* Drop zone */}
          {!result && (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${rows.length ? "#6366f1" : "var(--border-input)"}`,
                borderRadius: 12, padding: "32px 20px", textAlign: "center",
                cursor: "pointer", marginBottom: 16, transition: "border-color 0.2s",
                background: rows.length ? "#6366f108" : "transparent",
              }}
            >
              <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              {rows.length ? (
                <>
                  <FileText size={28} style={{ color: "#6366f1", margin: "0 auto 8px" }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{fileName}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-ghost)" }}>{rows.length} rows ready to import</p>
                </>
              ) : (
                <>
                  <Upload size={28} style={{ color: "var(--text-ghost)", margin: "0 auto 8px" }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Drop your CSV file here</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-ghost)" }}>or click to browse</p>
                </>
              )}
            </div>
          )}

          {parseError && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#ef444420", border: "1px solid #ef444440", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
              <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>{parseError}</p>
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && !result && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Preview (first {Math.min(rows.length, 3)} of {rows.length} rows)
              </p>
              <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {previewCols.map(c => (
                        <th key={c.key} style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-ghost)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 3).map((row, i) => (
                      <tr key={i} style={{ borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
                        {previewCols.map(c => (
                          <td key={c.key} style={{ padding: "8px 10px", color: "var(--text-sec)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row[c.label] || row[c.key] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success result */}
          {result && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <CheckCircle size={40} color="#10b981" style={{ margin: "0 auto 12px" }} />
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Import Complete!</p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-ghost)" }}>{result.created} records imported successfully.</p>
              {result.errors?.length > 0 && (
                <div style={{ marginTop: 12, textAlign: "left", background: "#f59e0b20", border: "1px solid #f59e0b40", borderRadius: 8, padding: 12 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{result.errors.length} rows had errors:</p>
                  {result.errors.slice(0, 5).map((e, i) => <p key={i} style={{ margin: "2px 0", fontSize: 12, color: "#f59e0b" }}>• {e}</p>)}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 20px", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {result ? "Close" : "Cancel"}
            </button>
            {!result && rows.length > 0 && (
              <button onClick={handleSubmit} disabled={uploading}
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 8, padding: "9px 20px", color: "white", fontSize: 13, fontWeight: 600, cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.7 : 1 }}>
                {uploading ? "Importing…" : `Import ${rows.length} rows`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
