import { useMemo, useState } from "react";
import { ALL_MODULES } from "@/lib/modules";
import { Check, X, Search } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  OWNER: "#ef4444", ADMIN: "#f59e0b", MANAGER: "#6366f1",
  STAFF: "#818cf8", ACCOUNTANT: "#10b981", VIEWER: "var(--text-ghost)",
};

export interface AccessMatrixMember {
  id: string;
  role: string;
  user: { id: string; name: string; email: string; lastLoginAt?: string; moduleAccess: Array<{ moduleKey: string }> };
}

/**
 * Presentational grid: every team member as a row, every module as a column,
 * one clickable cell to grant/revoke that person's access to that module.
 * OWNER/ADMIN rows are always-on and not editable.
 */
export default function ModuleAccessMatrix({
  members,
  onToggle,
  enabledModules,
}: {
  members: AccessMatrixMember[];
  onToggle: (userId: string, moduleKey: string, hasAccess: boolean) => void;
  /** If given, only these module columns are shown (e.g. the org's enabled modules). */
  enabledModules?: string[];
}) {
  const [q, setQ] = useState("");

  const modules = useMemo(
    () => (enabledModules && enabledModules.length ? ALL_MODULES.filter((m) => enabledModules.includes(m.key)) : ALL_MODULES),
    [enabledModules],
  );
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? members.filter((m) => m.user.name.toLowerCase().includes(t) || m.user.email.toLowerCase().includes(t)) : members;
  }, [members, q]);

  return (
    <div>
      <div style={{ position: "relative", maxWidth: 300, marginBottom: 14 }}>
        <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Filter employees..."
          style={{ width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "7px 10px 7px 30px", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-ghost)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid var(--border)", minWidth: 200, position: "sticky", left: 0, background: "var(--bg-card)", zIndex: 1 }}>Employee</th>
              <th style={{ textAlign: "center", padding: "8px 10px", color: "var(--text-ghost)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid var(--border)", minWidth: 80 }}>Role</th>
              <th style={{ textAlign: "center", padding: "8px 10px", color: "var(--text-ghost)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid var(--border)", minWidth: 100 }}>Last Login</th>
              {modules.map((mod) => (
                <th key={mod.key} style={{ textAlign: "center", padding: "6px 4px", color: "var(--text-ghost)", fontWeight: 700, fontSize: 10, borderBottom: "1px solid var(--border)", minWidth: 70, writingMode: "vertical-rl" as const, transform: "rotate(180deg)", height: 90, verticalAlign: "bottom" }}>
                  {mod.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const isAdmin = ["OWNER", "ADMIN"].includes(m.role);
              const grantedKeys = new Set(m.user.moduleAccess.map((a) => a.moduleKey));
              const rc = ROLE_COLORS[m.role] || "var(--text-ghost)";
              return (
                <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", position: "sticky", left: 0, background: "var(--bg-card)", zIndex: 1 }}>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{m.user.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-ghost)" }}>{m.user.email}</div>
                  </td>
                  <td style={{ textAlign: "center", padding: "10px 8px" }}>
                    <span style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, background: rc + "20", color: rc, fontWeight: 700 }}>{m.role}</span>
                  </td>
                  <td style={{ textAlign: "center", padding: "10px 8px", fontSize: 11, color: "var(--text-ghost)" }}>
                    {m.user.lastLoginAt ? new Date(m.user.lastLoginAt).toLocaleDateString("en-IN") : "Never"}
                  </td>
                  {modules.map((mod) => {
                    const has = isAdmin || grantedKeys.has(mod.key);
                    return (
                      <td key={mod.key} style={{ textAlign: "center", padding: "6px 4px" }}>
                        <button
                          onClick={() => !isAdmin && onToggle(m.user.id, mod.key, grantedKeys.has(mod.key))}
                          title={isAdmin ? "Admin — full access" : has ? "Click to revoke" : "Click to grant"}
                          style={{
                            width: 26, height: 26, borderRadius: 6, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center",
                            background: has ? (isAdmin ? "#6366f130" : "#10b98130") : "var(--bg-hover)",
                            border: `1px solid ${has ? (isAdmin ? "#6366f160" : "#10b98160") : "var(--border)"}`,
                            cursor: isAdmin ? "default" : "pointer",
                          }}>
                          {has ? <Check size={12} color={isAdmin ? "#818cf8" : "#10b981"} /> : <X size={10} color="var(--text-ghost)" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={3 + modules.length} style={{ padding: 32, textAlign: "center", color: "var(--text-ghost)" }}>No employees match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
