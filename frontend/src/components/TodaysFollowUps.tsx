import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneCall, Car, Building2, ArrowUpRight } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/api";

interface FollowUpItem {
  id: string;
  name: string;
  company?: string; // CRM lead's company, or car lead's interested make/model
  status: string;
  nextFollowUpDate?: string;
  assignedTo?: { name: string } | null;
  kind: "lead" | "car";
}

const STATUS_COLOR: Record<string, string> = {
  // CRM/Marketing lead statuses
  NEW: "#60a5fa", CONTACTED: "#fbbf24", QUALIFIED: "#34d399", PROPOSAL: "#c084fc", NEGOTIATION: "#f472b6",
  // Car buyer lead statuses
  HOT: "#f87171", WARM: "#fbbf24", COLD: "#60a5fa", URGENT: "#fb923c", NOT_INTERESTED: "#9ca3af",
};

function dueLabel(dateStr?: string): { text: string; color: string } {
  if (!dateStr) return { text: "", color: "var(--text-ghost)" };
  const due = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((startOfToday.getTime() - new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()) / 86400000);
  if (days > 0) return { text: `${days}d overdue`, color: "#f87171" };
  if (days === 0) return { text: "Due today", color: "#fbbf24" };
  return { text: "Upcoming", color: "var(--text-ghost)" };
}

// Platform-wide "who needs a call today" worklist — shows on every org's
// dashboard (admin and employee variants) when the Marketing (Leads) and/or
// Cars module is enabled, so nobody has to remember to open those pages to
// find out. Merges both lead types into one worklist.
export default function TodaysFollowUps() {
  const { moduleAccess, activeOrg, user } = useAuthStore();
  const isOrgAdmin = activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";
  const canSeeMarketing = isOrgAdmin || moduleAccess.includes("MARKETING");
  const canSeeCars = isOrgAdmin || moduleAccess.includes("CARS");
  const navigate = useNavigate();
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canSeeMarketing && !canSeeCars) { setLoading(false); return; }
    const assignedParam = !isOrgAdmin && user?.id ? `&assignedToId=${user.id}` : "";
    const calls: Promise<FollowUpItem[]>[] = [];
    if (canSeeMarketing) {
      calls.push(
        api.get(`/leads?followUp=due&limit=8${assignedParam}`)
          .then(r => (r.data.data.leads ?? []).map((l: any) => ({ id: l.id, name: l.name, company: l.company, status: l.status, nextFollowUpDate: l.nextFollowUpDate, assignedTo: l.assignedTo, kind: "lead" as const })))
          .catch(() => [])
      );
    }
    if (canSeeCars) {
      calls.push(
        api.get(`/cars/leads?followUp=due&limit=8${assignedParam}`)
          .then(r => (r.data.data.leads ?? []).map((l: any) => ({ id: l.id, name: l.name, company: [l.interestedMake, l.interestedModel].filter(Boolean).join(" "), status: l.status, nextFollowUpDate: l.nextFollowUpDate, assignedTo: l.assignedTo, kind: "car" as const })))
          .catch(() => [])
      );
    }
    Promise.all(calls)
      .then(results => {
        const merged = results.flat().sort((a, b) => new Date(a.nextFollowUpDate ?? 0).getTime() - new Date(b.nextFollowUpDate ?? 0).getTime());
        setItems(merged);
      })
      .finally(() => setLoading(false));
  }, [canSeeMarketing, canSeeCars, isOrgAdmin, user?.id, activeOrg?.id]);

  if ((!canSeeMarketing && !canSeeCars) || loading || items.length === 0) return null;

  const hasLeads = items.some(i => i.kind === "lead");
  const hasCars = items.some(i => i.kind === "car");

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            📞 Follow-ups Due Today {isOrgAdmin ? "· Team" : ""}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-ghost)", margin: "2px 0 0" }}>
            {items.length} need{items.length === 1 ? "s" : ""} a call today or are overdue
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {hasLeads && (
            <button onClick={() => navigate("/marketing")} style={{ background: "none", border: "none", color: "#818cf8", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              Leads <ArrowUpRight size={13} />
            </button>
          )}
          {hasCars && (
            <button onClick={() => navigate("/cars")} style={{ background: "none", border: "none", color: "#38bdf8", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              Cars <ArrowUpRight size={13} />
            </button>
          )}
        </div>
      </div>
      <div>
        {items.slice(0, 8).map((it, i, arr) => {
          const due = dueLabel(it.nextFollowUpDate);
          const isCar = it.kind === "car";
          return (
            <div
              key={`${it.kind}-${it.id}`}
              onClick={() => navigate(isCar ? `/cars?open=${it.id}` : `/marketing?open=${it.id}`)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", cursor: "pointer",
                borderBottom: i < arr.length - 1 ? "1px solid var(--bg-hover)" : "none",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ width: 34, height: 34, borderRadius: 8, background: isCar ? "rgba(56,189,248,0.12)" : "rgba(96,165,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {isCar ? <Car size={15} color="#38bdf8" /> : <PhoneCall size={15} color="#60a5fa" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-ghost)", display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.company && <><Building2 size={10} /> {it.company}</>}
                  {isOrgAdmin && it.assignedTo?.name && <span>· {it.assignedTo.name}</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: (STATUS_COLOR[it.status] || "#818cf8") + "20", color: STATUS_COLOR[it.status] || "#818cf8", fontWeight: 600 }}>
                  {it.status.replace(/_/g, " ")}
                </span>
                <span style={{ fontSize: 10, color: due.color, fontWeight: 600 }}>{due.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
