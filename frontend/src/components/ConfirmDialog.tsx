import { AlertTriangle, X } from "lucide-react";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel = "Delete", cancelLabel = "Cancel", danger = true, onConfirm, onCancel }: Props) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 400, maxWidth: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: danger ? "#ef444420" : "#6366f120", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <AlertTriangle size={18} color={danger ? "#ef4444" : "#6366f1"} />
            </div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: "var(--text-ghost)", cursor: "pointer", padding: 2 }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--text-sec)", lineHeight: 1.6 }}>{message}</p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-sec)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: danger ? "#ef4444" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
