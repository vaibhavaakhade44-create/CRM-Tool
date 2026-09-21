import { Construction } from "lucide-react";

interface Props { title: string; description: string; }

export default function ComingSoonPage({ title, description }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 16, textAlign: "center", padding: 40 }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Construction style={{ width: 30, height: 30, color: "#818CF8" }} />
      </div>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>{title}</h2>
        <p style={{ fontSize: 14, color: "var(--text-faint)", margin: 0, maxWidth: 360, lineHeight: 1.6 }}>{description}</p>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#818CF8", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", padding: "6px 14px", borderRadius: 20 }}>
        Coming Soon
      </span>
    </div>
  );
}
