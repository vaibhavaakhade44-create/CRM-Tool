import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { KeyRound } from "lucide-react";
import ModuleAccessMatrix, { type AccessMatrixMember } from "@/components/admin/ModuleAccessMatrix";

export default function AdminAccessPage() {
  const { activeOrg } = useAuthStore();
  const [members, setMembers] = useState<AccessMatrixMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/access/team");
      setMembers(r.data.data.members || []);
    } catch { /* leave as-is */ }
    setLoading(false);
  }, [activeOrg?.id]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (userId: string, moduleKey: string, hasAccess: boolean) => {
    // optimistic
    setMembers((prev) => prev.map((m) => m.user.id !== userId ? m : {
      ...m,
      user: {
        ...m.user,
        moduleAccess: hasAccess
          ? m.user.moduleAccess.filter((a) => a.moduleKey !== moduleKey)
          : [...m.user.moduleAccess, { moduleKey }],
      },
    }));
    try {
      if (hasAccess) await api.post("/access/revoke", { userId, moduleKey });
      else await api.post("/access/grant", { userId, moduleKeys: [moduleKey] });
    } catch {
      load(); // reconcile on failure
    }
  };

  return (
    <div className="page-pad">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <KeyRound size={20} color="#6366f1" />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Employee Module Access</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-ghost)", marginTop: 2, marginBottom: 24, maxWidth: 640, lineHeight: 1.5 }}>
        Every employee in {activeOrg?.name ?? "your organization"} and the modules they can open. Click a cell to grant or
        revoke access instantly. Owners and admins always have every module.
      </p>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-ghost)" }}>Loading…</div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <ModuleAccessMatrix members={members} onToggle={toggle} enabledModules={activeOrg?.enabledModules} />
        </div>
      )}
    </div>
  );
}
