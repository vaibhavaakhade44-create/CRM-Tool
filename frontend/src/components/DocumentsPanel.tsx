import { useState, useEffect, useRef, useCallback, type DragEvent } from "react";
import api from "@/lib/api";
import { Upload, FileText, FileSpreadsheet, File, Image, Trash2, Download, X, Plus, Paperclip } from "lucide-react";

// ── Types ───────────────────────────────────────────────────
interface Doc {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  description?: string;
  createdAt: string;
}

interface Props {
  entityType: string;
  entityId: string;
  compact?: boolean; // smaller version for modals
}

// ── File type helpers ───────────────────────────────────────
const ACCEPTED = ".pdf,.csv,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt";

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return <FileText size={16} color="#ef4444" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv") || mimeType.includes("excel"))
    return <FileSpreadsheet size={16} color="#10b981" />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText size={16} color="#3b82f6" />;
  if (mimeType.startsWith("image/")) return <Image size={16} color="#a78bfa" />;
  return <File size={16} color="#818cf8" />;
}

function getFileColor(mimeType: string): string {
  if (mimeType === "application/pdf") return "#ef4444";
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv") || mimeType.includes("excel")) return "#10b981";
  if (mimeType.includes("word") || mimeType.includes("document")) return "#3b82f6";
  if (mimeType.startsWith("image/")) return "#a78bfa";
  return "#818cf8";
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Component ───────────────────────────────────────────────
export default function DocumentsPanel({ entityType, entityId, compact = false }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const r = await api.get("/documents", { params: { entityType: entityType.toUpperCase(), entityId } });
      setDocs(r.data.data?.documents || []);
    } catch { setDocs([]); }
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true); setError(""); setUploadProgress(0);
    try {
      const form = new FormData();
      form.append("entityType", entityType.toUpperCase());
      form.append("entityId", entityId);
      files.forEach(f => form.append("files", f));

      await api.post("/documents", form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || "Upload failed. Check file type/size (max 20MB).");
    }
    setUploading(false); setUploadProgress(0);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    uploadFiles(files);
    e.target.value = "";
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  };

  const handleDownload = async (doc: Doc) => {
    try {
      const r = await api.get(`/documents/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url; a.download = doc.originalName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { alert("Download failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this file permanently?")) return;
    try { await api.delete(`/documents/${id}`); setDocs(p => p.filter(d => d.id !== id)); }
    catch { alert("Delete failed"); }
  };

  // ── Compact mode (embedded in modals) ──────────────────────
  if (compact) {
    return (
      <div>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Paperclip size={13} color="var(--text-ghost)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Attachments {docs.length > 0 && <span style={{ color: "#818CF8" }}>({docs.length})</span>}
            </span>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#818CF8" }}
          >
            <Plus size={11} /> Upload
          </button>
          <input ref={fileInputRef} type="file" multiple accept={ACCEPTED} style={{ display: "none" }} onChange={handleFileInput} />
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "6px 10px", color: "#ef4444", fontSize: 11, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {error} <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0 }}><X size={12} /></button>
          </div>
        )}

        {uploading && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ height: 3, background: "var(--bg-hover)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${uploadProgress}%`, background: "#6366f1", borderRadius: 2, transition: "width 0.2s" }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--text-ghost)", marginTop: 3 }}>Uploading… {uploadProgress}%</div>
          </div>
        )}

        {/* Drag zone — compact */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          style={{
            border: `1px dashed ${dragOver ? "#6366f1" : "var(--border-input)"}`,
            borderRadius: 8, padding: "10px 14px", textAlign: "center",
            cursor: uploading ? "not-allowed" : "pointer",
            background: dragOver ? "rgba(99,102,241,0.06)" : "transparent",
            marginBottom: docs.length > 0 ? 10 : 0,
            transition: "all 0.15s",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--text-ghost)" }}>Drag files here or <span style={{ color: "#818CF8" }}>click to browse</span></span>
          <div style={{ fontSize: 10, color: "var(--text-ghost)", marginTop: 2 }}>PDF, CSV, Excel, Word, Images • Max 20 MB</div>
        </div>

        {/* File list — compact */}
        {docs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {docs.map(doc => {
              const color = getFileColor(doc.mimeType);
              return (
                <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#0A0A18", border: "1px solid var(--bg-hover)", borderRadius: 8 }}>
                  <div style={{ color, flexShrink: 0 }}>{getFileIcon(doc.mimeType)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--text-sec)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.originalName}</div>
                    <div style={{ fontSize: 10, color: "var(--text-ghost)" }}>{fmtSize(doc.fileSize)} · {fmtDate(doc.createdAt)}</div>
                  </div>
                  <button onClick={() => handleDownload(doc)} title="Download" style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer", padding: 3, borderRadius: 4 }}>
                    <Download size={13} />
                  </button>
                  <button onClick={() => handleDelete(doc.id)} title="Delete" style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer", padding: 3, borderRadius: 4 }}
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-ghost)")}>
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!loading && docs.length === 0 && !uploading && (
          <div style={{ fontSize: 11, color: "var(--text-ghost)", textAlign: "center", padding: "4px 0" }}>No attachments yet</div>
        )}
      </div>
    );
  }

  // ── Full mode (for dedicated tabs/pages) ───────────────────
  return (
    <div>
      {/* Drag-drop upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "#6366f1" : "var(--border-input)"}`,
          borderRadius: 12, padding: "32px 20px", textAlign: "center",
          cursor: uploading ? "not-allowed" : "pointer",
          background: dragOver ? "rgba(99,102,241,0.06)" : "#0A0A18",
          transition: "all 0.2s", marginBottom: 20,
        }}
      >
        <input ref={fileInputRef} type="file" multiple accept={ACCEPTED} style={{ display: "none" }} onChange={handleFileInput} />
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Upload size={20} color="#818CF8" />
        </div>
        {uploading ? (
          <div>
            <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>Uploading… {uploadProgress}%</div>
            <div style={{ height: 4, background: "var(--bg-hover)", borderRadius: 2, overflow: "hidden", maxWidth: 200, margin: "10px auto 0" }}>
              <div style={{ height: "100%", width: `${uploadProgress}%`, background: "#6366f1", borderRadius: 2, transition: "width 0.2s" }} />
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-sec)", margin: "0 0 4px" }}>
              {dragOver ? "Drop files here" : "Drag & drop files or click to browse"}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-ghost)", margin: 0 }}>
              PDF, CSV, Excel, Word, Images, TXT — Max 20 MB per file
            </p>
          </>
        )}
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {error} <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0 }}><X size={14} /></button>
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-ghost)", padding: "24px 0", fontSize: 13 }}>Loading…</div>
      ) : docs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 20px" }}>
          <Paperclip size={36} color="var(--border)" style={{ margin: "0 auto 10px" }} />
          <p style={{ color: "var(--text-ghost)", margin: 0, fontSize: 13 }}>No files uploaded yet</p>
          <p style={{ color: "var(--text-ghost)", margin: "4px 0 0", fontSize: 12 }}>Upload contracts, invoices, certificates, photos and more</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map(doc => {
            const color = getFileColor(doc.mimeType);
            return (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, transition: "border-color 0.15s" }}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.borderColor = "#2D2D50")}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)")}>
                {/* Icon */}
                <div style={{ width: 36, height: 36, borderRadius: 8, background: color + "18", border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {getFileIcon(doc.mimeType)}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.originalName}</div>
                  <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2 }}>
                    {fmtSize(doc.fileSize)} · {fmtDate(doc.createdAt)}
                    {doc.description && <> · <span style={{ color: "var(--text-faint)" }}>{doc.description}</span></>}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleDownload(doc)}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818CF8" }}
                  >
                    <Download size={13} /> Download
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    style={{ padding: "5px 8px", borderRadius: 6, cursor: "pointer", background: "transparent", border: "1px solid var(--border-input)", color: "var(--text-ghost)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.3)"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-input)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-ghost)"; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
