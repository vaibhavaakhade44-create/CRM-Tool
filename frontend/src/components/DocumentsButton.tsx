import { useState } from "react";
import { Paperclip, X } from "lucide-react";
import DocumentsPanel from "./DocumentsPanel";

interface Props {
  entityType: string;
  entityId: string;
  entityLabel?: string;
}

export default function DocumentsButton({ entityType, entityId, entityLabel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        title="Attachments"
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "4px 9px", borderRadius: 6, fontSize: 11, fontWeight: 500,
          cursor: "pointer", background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.2)", color: "#818CF8",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.15)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.08)"; }}
      >
        <Paperclip size={12} /> Docs
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 100px rgba(0,0,0,0.7)" }}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Paperclip size={15} color="#818CF8" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Documents</div>
                  {entityLabel && <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{entityLabel}</div>}
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer", padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
              <DocumentsPanel entityType={entityType} entityId={entityId} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
