import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { ALL_MODULES } from "@/lib/modules";
import { Users, Shield, Check, Clock, CheckCircle, XCircle, Mail, UserPlus, ChevronDown, ChevronUp, Send, Trash2, AlertCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';
import ModuleAccessMatrix from "@/components/admin/ModuleAccessMatrix";

const S = {
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  sub: { fontSize: 13, color: "var(--text-ghost)", marginTop: 4, marginBottom: 28 } as React.CSSProperties,
  card: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20 } as React.CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  input: { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const },
  select: { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 6 } as React.CSSProperties,
};

// Department presets — pre-select typical modules + suggested role for each department
const DEPT_PRESETS: { label: string; color: string; modules: string[]; role: string }[] = [
  { label: "HR & Payroll",   color: "#818CF8", role: "MANAGER", modules: ["HR"] },
  { label: "Stock Inward",   color: "#34D399", role: "STAFF",   modules: ["STORE", "INVENTORY"] },
  { label: "Stock Outward",  color: "#FBBF24", role: "STAFF",   modules: ["DISPATCH", "INVENTORY"] },
  { label: "Purchase",       color: "#C084FC", role: "STAFF",   modules: ["PURCHASE", "INVENTORY"] },
  { label: "Accounts",       color: "#F87171", role: "ACCOUNTANT", modules: ["ACCOUNTS"] },
  { label: "Warehouse",      color: "#FBBF24", role: "STAFF",   modules: ["WAREHOUSE", "INVENTORY"] },
  { label: "Sales & CRM",    color: "#6366f1", role: "STAFF",   modules: ["CRM", "DISPATCH", "ACCOUNTS"] },
  { label: "Marketing",      color: "#F87171", role: "STAFF",   modules: ["MARKETING", "CRM"] },
  { label: "Support",        color: "#34D399", role: "STAFF",   modules: ["SUPPORT", "CRM"] },
  { label: "Projects / IT",  color: "#8b5cf6", role: "STAFF",   modules: ["PROJECTS"] },
  { label: "Telecalling",    color: "#06b6d4", role: "STAFF",   modules: ["MARKETING", "CRM"] },
  { label: "Import/Export",  color: "#34D399", role: "STAFF",   modules: ["IMPORT_EXPORT_SUITE", "DISPATCH", "STORE", "INVENTORY", "ACCOUNTS"] },
  { label: "Reports Only",   color: "#818CF8", role: "VIEWER",  modules: ["REPORTS"] },
  { label: "Full Access",    color: "#6366f1", role: "ADMIN",   modules: ALL_MODULES.map((m) => m.key) },
];

const MODULE_GROUPS = [
  { label: "Core Business", modules: ALL_MODULES.filter((m) => m.category === "core") },
  { label: "Operations",    modules: ALL_MODULES.filter((m) => m.category === "operations") },
  { label: "Growth",        modules: ALL_MODULES.filter((m) => m.category === "growth") },
  { label: "Industry",      modules: ALL_MODULES.filter((m) => m.category === "industry") },
];

interface MemberAccess {
  id: string; role: string; joinedAt: string;
  user: { id: string; name: string; email: string; lastLoginAt?: string; isActive: boolean; moduleAccess: Array<{ moduleKey: string }> };
}
interface AccessReq {
  id: string; moduleKey: string; status: string; message?: string; requestedAt: string;
  user: { id: string; name: string; email: string };
}
interface PendingInvite {
  id: string; email: string; role: string; allowedModules: string[];
  expiresAt: string; createdAt: string; invitedBy?: string; expired: boolean;
}

export default function AdminTeamPage() {
  const { t } = useTranslation();
  const { activeOrg } = useAuthStore();
  const [members, setMembers] = useState<MemberAccess[]>([]);
  const [requests, setRequests] = useState<AccessReq[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "access" | "invite" | "pending">("members");

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("STAFF");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [showModules, setShowModules] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [resending, setResending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, rRes, iRes] = await Promise.allSettled([
      api.get("/access/team"),
      api.get("/access/requests?status=PENDING"),
      api.get("/organizations/current/members/invites"),
    ]);
    if (mRes.status === "fulfilled") setMembers(mRes.value.data.data.members || []);
    if (rRes.status === "fulfilled") setRequests(rRes.value.data.data.requests || []);
    if (iRes.status === "fulfilled") setPendingInvites(iRes.value.data.data || []);
    setLoading(false);
  }, [activeOrg?.id]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id: string, action: "APPROVE" | "DENY") => {
    setResolving(id);
    try { await api.patch(`/access/requests/${id}`, { action }); load(); } catch { /* ignore */ }
    setResolving(null);
  };

  const toggleAccess = async (userId: string, moduleKey: string, hasAccess: boolean) => {
    try {
      if (hasAccess) await api.post("/access/revoke", { userId, moduleKey });
      else await api.post("/access/grant", { userId, moduleKeys: [moduleKey] });
      load();
    } catch { /* ignore */ }
  };

  const applyPreset = (preset: { modules: string[]; role: string }) => {
    setSelectedModules(preset.modules);
    setInviteRole(preset.role);
    setInviteMsg("");
  };
  const toggleModule = (key: string) => {
    setSelectedModules((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
    setInviteMsg("");
  };

  const resendInvite = async (id: string) => {
    setResending(id);
    try {
      await api.post(`/organizations/current/members/invites/${id}/resend`);
      load();
    } catch { /* ignore */ }
    setResending(null);
  };

  const cancelInvite = async (id: string) => {
    try {
      await api.delete(`/organizations/current/members/invites/${id}`);
      load();
    } catch { /* ignore */ }
  };

  const sendInvite = async () => {
    if (!inviteEmail) return;
    if (selectedModules.length === 0) { setInviteMsg("✗ Please select at least one module for this employee."); return; }
    setInviting(true); setInviteMsg("");
    try {
      await api.post("/organizations/current/members/invite", { email: inviteEmail, role: inviteRole, allowedModules: selectedModules });
      setInviteMsg(`✓ Invite sent to ${inviteEmail}. They will see ${selectedModules.length} module(s) after joining.`);
      setInviteEmail(""); setSelectedModules([]);
    } catch (e: any) {
      setInviteMsg("✗ " + (e?.response?.data?.message || "Failed to send invite"));
    }
    setInviting(false);
  };

  const tabBtn = (t: typeof activeTab, label: string, badge?: number) => (
    <button key={t} onClick={() => setActiveTab(t)} style={{
      padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
      background: activeTab === t ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "var(--bg-card)",
      color: activeTab === t ? "white" : "var(--text-ghost)", fontWeight: 600, fontSize: 13, position: "relative" as const,
    }}>
      {label}
      {badge !== undefined && badge > 0 && (
        <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{badge}</span>
      )}
    </button>
  );

  return (
    <div className="page-pad">
      <h1 style={S.title}>{ t('page_admin') }</h1>
      <p style={S.sub}>Manage team members, module access, and pending requests</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {tabBtn("members", `Members (${members.length})`)}
        {tabBtn("access", "Access Requests", requests.length)}
        {tabBtn("pending", "Pending Invites", pendingInvites.length)}
        {tabBtn("invite", "Invite Member")}
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)" }}>Loading...</div> : (
        <>
          {/* ── MEMBERS + MODULE MATRIX ── */}
          {activeTab === "members" && (
            <div style={S.card}>
              <div style={S.cardTitle}><Users size={15} color="#6366f1" /> Team Members & Module Access Matrix</div>
              <p style={{ fontSize: 12, color: "var(--text-ghost)", marginBottom: 16 }}>
                Click any module cell to grant/revoke access instantly. OWNER/ADMIN always have full access.
              </p>
              <ModuleAccessMatrix members={members} onToggle={toggleAccess} enabledModules={activeOrg?.enabledModules} />
            </div>
          )}

          {/* ── ACCESS REQUESTS ── */}
          {activeTab === "access" && (
            <div style={S.card}>
              <div style={S.cardTitle}><Shield size={15} color="#f59e0b" /> Pending Module Access Requests</div>
              {requests.length === 0 ? (
                <div style={{ color: "var(--text-ghost)", textAlign: "center", padding: 40 }}>
                  <CheckCircle size={36} color="#10b981" style={{ margin: "0 auto 12px", display: "block" }} />
                  All caught up — no pending requests.
                </div>
              ) : requests.map((r) => {
                const mod = ALL_MODULES.find((m) => m.key === r.moduleKey);
                return (
                  <div key={r.id} style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{r.user.name}</span>
                        <span style={{ fontSize: 11, color: "var(--text-ghost)" }}>{r.user.email}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: "#6366f120", color: "#818cf8", fontWeight: 600 }}>
                          {mod?.label || r.moduleKey}
                        </span>
                        {r.message && <span style={{ fontSize: 12, color: "var(--text-ghost)", fontStyle: "italic" }}>"{r.message}"</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-ghost)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={10} />
                        {new Date(r.requestedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => resolve(r.id, "APPROVE")} disabled={resolving === r.id}
                        style={{ background: "#10b98120", color: "#10b981", border: "1px solid #10b98140", borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                        <Check size={13} /> Approve
                      </button>
                      <button onClick={() => resolve(r.id, "DENY")} disabled={resolving === r.id}
                        style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef444440", borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                        <XCircle size={13} /> Deny
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── INVITE MEMBER ── */}
          {activeTab === "invite" && (
            <div style={{ maxWidth: 720 }}>
              <div style={S.card}>
                <div style={S.cardTitle}><UserPlus size={15} color="#6366f1" /> Invite a Team Member</div>
                <p style={{ fontSize: 13, color: "var(--text-ghost)", marginBottom: 20 }}>
                  Send an email invite and control exactly which modules the employee sees on their dashboard.
                </p>

                {/* Email + Role row */}
                <div className="grid-r2" style={{ gap: 14, marginBottom: 20 }}>
                  <div>
                    <label style={S.label}>Email Address</label>
                    <div style={{ position: "relative" }}>
                      <Mail size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
                      <input style={{ ...S.input, paddingLeft: 36 }} type="email" placeholder="employee@company.com"
                        value={inviteEmail} onChange={(e) => { setInviteEmail(e.target.value); setInviteMsg(""); }} />
                    </div>
                  </div>
                  <div>
                    <label style={S.label}>Role</label>
                    <select style={{ ...S.select, width: "100%" }} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                      <optgroup label="── Management ──────────────────">
                        <option value="ADMIN">Admin — Full org access</option>
                        <option value="MANAGER">Manager — Department head / HR Manager</option>
                      </optgroup>
                      <optgroup label="── Department Staff ─────────────">
                        <option value="STAFF">HR Executive / HR Staff</option>
                        <option value="STAFF">Sales Executive / BDE</option>
                        <option value="STAFF">Purchase Officer / Procurement</option>
                        <option value="STAFF">Inventory / Store In-charge</option>
                        <option value="STAFF">Dispatch / Logistics Executive</option>
                        <option value="STAFF">Warehouse Staff</option>
                        <option value="STAFF">Marketing Executive</option>
                        <option value="STAFF">Customer Support Executive</option>
                        <option value="STAFF">Operations Staff</option>
                        <option value="STAFF">Field Sales / Telecalling</option>
                        <option value="STAFF">Import-Export Executive</option>
                        <option value="STAFF">IT / Software Developer</option>
                        <option value="STAFF">Project Coordinator</option>
                        <option value="STAFF">Restaurant / Hotel Staff</option>
                      </optgroup>
                      <optgroup label="── Finance ───────────────────────">
                        <option value="ACCOUNTANT">Accountant / Finance Staff</option>
                        <option value="ACCOUNTANT">GST / Tax Executive</option>
                        <option value="ACCOUNTANT">Billing / Invoice Staff</option>
                      </optgroup>
                      <optgroup label="── Read-Only Access ──────────────">
                        <option value="VIEWER">Viewer — Read only</option>
                      </optgroup>
                    </select>
                    <p style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 5 }}>
                      All "Department Staff" map to <strong>STAFF</strong> role. Finance options map to <strong>ACCOUNTANT</strong>. Use Module Access below to control exactly what each person sees.
                    </p>
                  </div>
                </div>

                {/* Department Presets */}
                <div style={{ marginBottom: 18 }}>
                  <label style={S.label}>Quick Select by Department</label>
                  <p style={{ fontSize: 12, color: "var(--text-ghost)", marginBottom: 10, marginTop: 0 }}>
                    Click a department to pre-fill typical modules for that role.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {DEPT_PRESETS.map((preset) => {
                      const isActive = preset.modules.length === selectedModules.length &&
                        preset.modules.every((m) => selectedModules.includes(m));
                      return (
                        <button key={preset.label} onClick={() => applyPreset(preset)} style={{
                          padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          border: `1px solid ${isActive ? preset.color : "var(--border)"}`,
                          background: isActive ? preset.color + "20" : "var(--bg-hover)",
                          color: isActive ? preset.color : "var(--text-sec)",
                          display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
                        }}>
                          {preset.label}
                          <span style={{ fontSize: 10, opacity: 0.75 }}>({preset.role})</span>
                          {isActive && <Check size={11} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Module Checkboxes */}
                <div style={{ marginBottom: 20 }}>
                  <button onClick={() => setShowModules((p) => !p)} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 10,
                  }}>
                    <span style={{ ...S.label, marginBottom: 0 }}>
                      Modules to Grant ({selectedModules.length} selected)
                    </span>
                    {showModules
                      ? <ChevronUp size={13} color="var(--text-ghost)" />
                      : <ChevronDown size={13} color="var(--text-ghost)" />}
                  </button>

                  {showModules && (
                    <div style={{ background: "var(--bg-hover)", borderRadius: 10, border: "1px solid var(--border)", padding: 16 }}>
                      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                        <button onClick={() => setSelectedModules(ALL_MODULES.map((m) => m.key))}
                          style={{ fontSize: 11, color: "#818cf8", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>
                          Select All
                        </button>
                        <span style={{ color: "var(--text-ghost)" }}>·</span>
                        <button onClick={() => setSelectedModules([])}
                          style={{ fontSize: 11, color: "var(--text-ghost)", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>
                          Clear All
                        </button>
                      </div>

                      {MODULE_GROUPS.map((group) => (
                        <div key={group.label} style={{ marginBottom: 14 }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, marginTop: 0 }}>
                            {group.label}
                          </p>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6 }}>
                            {group.modules.map((mod) => {
                              const checked = selectedModules.includes(mod.key);
                              return (
                                <label key={mod.key} onClick={() => toggleModule(mod.key)} style={{
                                  display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                                  background: checked ? mod.accentBg : "var(--bg-card)",
                                  border: `1px solid ${checked ? mod.accentBorder : "var(--border)"}`,
                                  transition: "all 0.15s", userSelect: "none" as const,
                                }}>
                                  <div style={{
                                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                    border: `2px solid ${checked ? mod.accentColor : "var(--border)"}`,
                                    background: checked ? mod.accentColor : "transparent",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    transition: "all 0.15s",
                                  }}>
                                    {checked && <Check size={10} color="white" />}
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 500, color: checked ? "var(--text-primary)" : "var(--text-sec)", lineHeight: 1.3 }}>
                                    {mod.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {inviteMsg && (
                  <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 14, background: inviteMsg.startsWith("✓") ? "#10b98120" : "#ef444420", color: inviteMsg.startsWith("✓") ? "#10b981" : "#ef4444", fontSize: 13, fontWeight: 500 }}>
                    {inviteMsg}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={sendInvite} style={{ ...S.btn, opacity: (inviting || !inviteEmail) ? 0.6 : 1, cursor: (inviting || !inviteEmail) ? "not-allowed" : "pointer" }} disabled={inviting || !inviteEmail}>
                    <Mail size={14} /> {inviting ? "Sending..." : "Send Invite"}
                  </button>
                  {selectedModules.length > 0 && (
                    <span style={{ fontSize: 12, color: "var(--text-ghost)" }}>
                      Employee will see <strong style={{ color: "var(--text-primary)" }}>{selectedModules.length}</strong> module(s)
                    </span>
                  )}
                </div>
              </div>

              {/* How it works guide */}
              <div style={{ ...S.card, background: "#6366f108", border: "1px solid #6366f130" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <Shield size={14} /> How Employee Access Works
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    ["1. You send invite",      "Employee receives an email with a join link. You pre-select which modules they can access."],
                    ["2. Employee joins",        "They register or log in. Their sidebar and dashboard show only the modules you granted."],
                    ["3. Admin adjusts anytime", "Members tab → click any module cell to instantly grant or revoke access for any employee."],
                    ["4. Employee can request",  "If they need more modules, they submit an access request. You approve/deny from Access Requests tab."],
                  ].map(([step, desc]) => (
                    <div key={step} style={{ display: "flex", gap: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", minWidth: 140, flexShrink: 0 }}>{step}</span>
                      <span style={{ fontSize: 12, color: "var(--text-sec)" }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PENDING INVITES ── */}
          {activeTab === "pending" && (
            <div style={S.card}>
              <div style={S.cardTitle}><Mail size={15} color="#6366f1" /> Pending Invitations</div>
              <p style={{ fontSize: 12, color: "var(--text-ghost)", marginBottom: 20 }}>
                Invites below haven't been accepted yet. You can resend or cancel them.
              </p>
              {pendingInvites.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-ghost)" }}>
                  <CheckCircle size={36} color="#10b981" style={{ margin: "0 auto 12px", display: "block" }} />
                  No pending invitations — everyone has joined!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pendingInvites.map(inv => {
                    const rc = { OWNER:"#ef4444",ADMIN:"#f59e0b",MANAGER:"#6366f1",STAFF:"#818cf8",ACCOUNTANT:"#10b981",VIEWER:"var(--text-ghost)" }[inv.role] || "#818cf8";
                    const isExpired = inv.expired;
                    return (
                      <div key={inv.id} style={{
                        display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                        background: "var(--bg-hover)", borderRadius: 10,
                        border: `1px solid ${isExpired ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{inv.email}</span>
                            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: rc+"20", color: rc, fontWeight: 700 }}>{inv.role}</span>
                            {isExpired && (
                              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 700, display:"flex", alignItems:"center", gap:3 }}>
                                <AlertCircle size={9} /> Expired
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-ghost)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <span><Clock size={10} style={{ display:"inline", marginRight:3 }} />Sent {new Date(inv.createdAt).toLocaleDateString("en-IN", { dateStyle:"medium" })}</span>
                            {inv.invitedBy && <span>by {inv.invitedBy}</span>}
                            <span>· Expires {new Date(inv.expiresAt).toLocaleDateString("en-IN", { dateStyle:"medium" })}</span>
                            {inv.allowedModules.length > 0 && (
                              <span>{inv.allowedModules.length} module{inv.allowedModules.length > 1 ? "s" : ""}</span>
                            )}
                          </div>
                          {inv.allowedModules.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                              {inv.allowedModules.slice(0, 6).map(m => (
                                <span key={m} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 9999, background: "#6366f115", color: "#818cf8", border: "1px solid #6366f130" }}>{m}</span>
                              ))}
                              {inv.allowedModules.length > 6 && (
                                <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>+{inv.allowedModules.length - 6} more</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button
                            onClick={() => resendInvite(inv.id)}
                            disabled={resending === inv.id}
                            title="Resend invite email"
                            style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:7, fontSize:12, cursor:"pointer", background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.3)", color:"#818cf8" }}
                          >
                            <Send size={12} /> {resending === inv.id ? "…" : "Resend"}
                          </button>
                          <button
                            onClick={() => cancelInvite(inv.id)}
                            title="Cancel invite"
                            style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:7, fontSize:12, cursor:"pointer", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444" }}
                          >
                            <Trash2 size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
