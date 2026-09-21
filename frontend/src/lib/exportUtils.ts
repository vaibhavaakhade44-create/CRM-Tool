// ── Export Utilities ─────────────────────────────────────────────

/** Download any array of objects as a CSV file */
export function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const v = row[h];
      const s = v === null || v === undefined ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  triggerDownload(csv, filename.endsWith(".csv") ? filename : `${filename}.csv`, "text/csv;charset=utf-8;");
}

/** Download any array of objects as a JSON file */
export function exportJSON(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  triggerDownload(json, filename.endsWith(".json") ? filename : `${filename}.json`, "application/json");
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Flatten a table row for export — strips React nodes, keeps primitives */
export function flattenRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) { out[k] = ""; continue; }
    if (typeof v === "object" && !Array.isArray(v)) continue; // skip nested objects/React nodes
    if (Array.isArray(v)) { out[k] = v.join(", "); continue; }
    out[k] = v;
  }
  return out;
}
