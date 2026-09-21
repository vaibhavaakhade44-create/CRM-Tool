import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@/i18n";
import { Languages } from "lucide-react";

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const change = (code: string) => {
    i18n.changeLanguage(code);
    const lang = LANGUAGES.find(l => l.code === code);
    document.documentElement.dir = lang?.dir ?? "ltr";
    document.documentElement.lang = code;
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={t("label_language")}
        className="flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer"
        style={{
          width: 40, height: 40,
          background: open ? "var(--sb-active)" : "transparent",
          border: open ? "1px solid var(--brand-border)" : "1px solid transparent",
          color: open ? "var(--sb-accent)" : "var(--sb-text-dim)",
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = "var(--sb-hover)"; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = "transparent"; }}
      >
        <Languages style={{ width: 18, height: 18 }} />
      </button>

      {open && (
        <div style={{
          position: "fixed", left: "var(--rail-w)", bottom: 12, width: 220,
          background: "var(--sb-bg-raise)", border: "1px solid var(--sb-border)",
          borderRadius: 12, padding: "6px 4px", zIndex: 45,
          boxShadow: "16px 8px 40px rgba(0,0,0,0.45)",
          maxHeight: 320, overflowY: "auto",
        }}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => change(lang.code)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "7px 8px", borderRadius: 6, border: "none", cursor: "pointer",
                background: lang.code === current.code ? "var(--sb-active)" : "transparent",
                color: lang.code === current.code ? "var(--sb-accent)" : "var(--sb-text-dim)",
                fontSize: 12, textAlign: "left",
              }}
            >
              <span style={{ fontSize: 14 }}>{lang.flag}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{lang.native}</span>
              <span style={{ fontSize: 10, color: "var(--sb-text-ghost)" }}>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
