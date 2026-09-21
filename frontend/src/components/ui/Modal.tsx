import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
}

const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

export function Modal({ open, onClose, title, children, size = "md", footer }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", onKey);
      return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "var(--overlay)" }} onClick={onClose} />

      {/* Panel */}
      <div
        className={cn("relative rounded-2xl w-full flex flex-col max-h-[90vh]", sizes[size])}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 80px var(--shadow)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
            style={{ color: "var(--text-ghost)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-ghost)"; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && <div className="px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>{footer}</div>}
      </div>
    </div>
  );
}
