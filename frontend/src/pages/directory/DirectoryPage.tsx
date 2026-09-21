import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Users2, Search, X, Mail, Phone, Briefcase, CalendarDays, IdCard, Building2 } from "lucide-react";
import { getInitials } from "@/lib/utils";

interface DirectoryEntry {
  id: string;
  name: string;
  designation?: string | null;
  department?: string | null;
  orgRole?: string | null;
  employeeCode?: string | null;
  email?: string | null;
  phone?: string | null;
  employmentType?: string | null;
  joiningDate?: string | null;
}

const AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9", "#f97316"];
function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const prettyDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const prettyEnum = (v?: string | null) => (v ? v.replace(/_/g, " ") : "—");

/* ── Employee detail modal ─────────────────────────────────── */
function DetailModal({ entry, onClose }: { entry: DirectoryEntry; onClose: () => void }) {
  const rows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
    { icon: <IdCard size={14} />, label: "Employee code", value: entry.employeeCode || "—" },
    {
      icon: <Mail size={14} />, label: "Email",
      value: entry.email ? <a href={`mailto:${entry.email}`} style={{ color: "#6366f1", textDecoration: "none" }}>{entry.email}</a> : "—",
    },
    {
      icon: <Phone size={14} />, label: "Phone",
      value: entry.phone ? <a href={`tel:${entry.phone}`} style={{ color: "#6366f1", textDecoration: "none" }}>{entry.phone}</a> : "—",
    },
    { icon: <Building2 size={14} />, label: "Department", value: entry.department || "—" },
    { icon: <Briefcase size={14} />, label: "Employment type", value: prettyEnum(entry.employmentType) },
    { icon: <CalendarDays size={14} />, label: "Joined", value: prettyDate(entry.joiningDate) },
  ];

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 420, padding: 22 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: colorFor(entry.name), display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 17, flexShrink: 0 }}>
            {getInitials(entry.name)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{entry.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-ghost)" }}>
              {[entry.designation, entry.orgRole && prettyEnum(entry.orgRole)].filter(Boolean).join(" · ") || "Team member"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)", padding: 2 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {rows.map(r => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-ghost)", display: "flex", flexShrink: 0 }}>{r.icon}</span>
              <span style={{ fontSize: 12, color: "var(--text-ghost)", width: 120, flexShrink: 0 }}>{r.label}</span>
              <span style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis" }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DirectoryPage() {
  const { activeOrg } = useAuthStore();
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DirectoryEntry | null>(null);

  useEffect(() => {
    setLoading(true);
    api.get("/organizations/current/directory")
      .then(r => setEntries(r.data.data ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [activeOrg?.id]);

  const filtered = entries.filter(e =>
    !search.trim() ||
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.designation || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.department || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-pad">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <Users2 size={20} color="#6366f1" />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Company Directory</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-ghost)", marginTop: 2, marginBottom: 20 }}>
        Who works at {activeOrg?.name ?? "your organization"} and what they do.
      </p>

      <div style={{ position: "relative", maxWidth: 320, marginBottom: 20 }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, title, department..."
          style={{ width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px 8px 32px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-ghost)" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-ghost)" }}>
          {search ? "No one matches your search." : "No employees added yet."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {filtered.map(e => (
            <button
              key={e.id}
              onClick={() => setSelected(e)}
              title={`View ${e.name}'s details`}
              style={{ textAlign: "left", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "border-color .15s" }}
              onMouseEnter={ev => (ev.currentTarget.style.borderColor = "#6366f1")}
              onMouseLeave={ev => (ev.currentTarget.style.borderColor = "var(--border)")}
            >
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: colorFor(e.name), display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {getInitials(e.name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-ghost)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {[e.designation, e.department].filter(Boolean).join(" · ") || "Team member"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <DetailModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
