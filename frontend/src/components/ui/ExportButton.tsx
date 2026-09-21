import { Download } from "lucide-react";
import { exportCSV, flattenRow } from "@/lib/exportUtils";

interface Props {
  data: Record<string, unknown>[];
  filename: string;
  label?: string;
}

export default function ExportButton({ data, filename, label = "Export CSV" }: Props) {
  const handleExport = () => {
    const flat = data.map(flattenRow);
    exportCSV(flat, filename);
  };

  return (
    <button
      onClick={handleExport}
      disabled={!data.length}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "var(--bg-hover)", border: "1px solid var(--border)",
        borderRadius: 8, padding: "7px 14px",
        color: "var(--text-muted)", fontSize: 13, fontWeight: 500,
        cursor: data.length ? "pointer" : "not-allowed",
        opacity: data.length ? 1 : 0.4, transition: "all 0.15s",
      }}
      onMouseEnter={e => { if (data.length) (e.currentTarget.style.color = "var(--text-primary)"); }}
      onMouseLeave={e => { (e.currentTarget.style.color = "var(--text-muted)"); }}
    >
      <Download size={14} />
      {label}
    </button>
  );
}
