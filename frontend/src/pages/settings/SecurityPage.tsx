import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from 'react-i18next';
import {
  Shield, MonitorSmartphone, Key, Lock, Globe, Users,
  Trash2, Plus, Eye, EyeOff, Copy, Check, LogOut,
  AlertTriangle, CheckCircle, Clock, Wifi,
} from "lucide-react";

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

function authH(token: string, orgId: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-organization-id": orgId };
}
function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ── Tab bar ─────────────────────────────────────────────────────
const TABS = [
  { id: "overview",    label: "Overview",    Icon: Shield },
  { id: "sessions",    label: "Sessions",    Icon: MonitorSmartphone },
  { id: "apikeys",     label: "API Keys",    Icon: Key },
  { id: "password",    label: "Password",    Icon: Lock },
  { id: "ipallowlist", label: "IP Allowlist", Icon: Globe },
  { id: "permissions", label: "Permissions", Icon: Users },
];

// ─────────────────────────────────────────────────────────────────
//  OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────
function OverviewTab() {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !activeOrg) return;
    fetch(`${API}/security/overview`, { headers: authH(token, activeOrg.id) })
      .then(r => r.json()).then(r => { if (r.success) setData(r.data); })
      .finally(() => setLoading(false));
  }, [token, activeOrg]);

  if (loading) return <div style={{ color: "var(--text-faint)", padding: 24 }}>Loading…</div>;
  if (!data) return null;

  const stats = [
    { label: "Active Members",     value: data.members,          Icon: Users,          color: "#6366f1" },
    { label: "Locked Accounts",    value: data.lockedUsers,       Icon: AlertTriangle,  color: data.lockedUsers > 0 ? "#f59e0b" : "#22c55e" },
    { label: "Active API Keys",    value: data.activeApiKeys,     Icon: Key,            color: "#8b5cf6" },
    { label: "IP Allowlist Rules", value: data.ipAllowlistRules,  Icon: Wifi,           color: "#06b6d4" },
    { label: "Custom Permissions", value: data.customPermissions, Icon: Shield,         color: "#10b981" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {stats.map(({ label, value, Icon, color }) => (
          <div key={label} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 12, padding: "16px 18px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon style={{ width: 16, height: 16, color }} />
              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Recent Audit Events</div>
        {data.recentAudit?.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No recent events</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.recentAudit?.map((log: any, i: number) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
              background: "var(--bg-hover)", borderRadius: 8, fontSize: 12,
            }}>
              <CheckCircle style={{ width: 13, height: 13, color: "#22c55e", flexShrink: 0 }} />
              <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{log.action}</span>
              <span style={{ color: "var(--text-faint)" }}>{log.resource}</span>
              <span style={{ color: "var(--text-faint)" }}>by {log.userName}</span>
              {log.ipAddress && <span style={{ color: "var(--text-faint)", marginLeft: "auto" }}>{log.ipAddress}</span>}
              <span style={{ color: "var(--text-faint)", marginLeft: 8, flexShrink: 0 }}>{timeAgo(log.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  SESSIONS TAB
// ─────────────────────────────────────────────────────────────────
function SessionsTab() {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = () => {
    if (!token || !activeOrg) return;
    fetch(`${API}/sessions`, { headers: authH(token, activeOrg.id) })
      .then(r => r.json()).then(r => { if (r.success) setSessions(r.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [token, activeOrg]);

  const revoke = async (id: string) => {
    setRevoking(id);
    await fetch(`${API}/sessions/${id}`, { method: "DELETE", headers: authH(token!, activeOrg!.id) });
    load();
    setRevoking(null);
  };

  const revokeAll = async () => {
    await fetch(`${API}/sessions/all`, { method: "DELETE", headers: authH(token!, activeOrg!.id) });
    load();
  };

  if (loading) return <div style={{ color: "var(--text-faint)", padding: 24 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Active Sessions</div>
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>{sessions.length} device(s) signed in</div>
        </div>
        {sessions.filter(s => !s.isCurrent).length > 0 && (
          <button onClick={revokeAll} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8, color: "#ef4444", fontSize: 12, cursor: "pointer",
          }}>
            <LogOut style={{ width: 13, height: 13 }} />
            Logout all other devices
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.map(s => (
          <div key={s.id} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
            background: "var(--bg-card)", border: `1px solid ${s.isCurrent ? "#6366f1" : "var(--border)"}`,
            borderRadius: 10,
          }}>
            <MonitorSmartphone style={{ width: 18, height: 18, color: s.isCurrent ? "#6366f1" : "var(--text-faint)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {s.browser || "Unknown browser"} on {s.os || "Unknown OS"}
                </span>
                {s.isCurrent && (
                  <span style={{
                    fontSize: 10, padding: "1px 7px", borderRadius: 9999,
                    background: "rgba(99,102,241,0.15)", color: "#6366f1", border: "1px solid #6366f1",
                  }}>Current</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                {s.ipAddress && <span>{s.ipAddress} · </span>}
                Last active {timeAgo(s.lastActiveAt)} · Since {fmtDate(s.createdAt)}
              </div>
            </div>
            {!s.isCurrent && (
              <button
                onClick={() => revoke(s.id)}
                disabled={revoking === s.id}
                style={{
                  padding: "5px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer",
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                  color: "#ef4444",
                }}
              >
                {revoking === s.id ? "…" : "Revoke"}
              </button>
            )}
          </div>
        ))}
        {sessions.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No active sessions found</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  API KEYS TAB
// ─────────────────────────────────────────────────────────────────
const SCOPES = ["leads:read", "leads:write", "crm:read", "crm:write", "inventory:read", "finance:read", "all:read"];

function ApiKeysTab() {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: "", scopes: ["all:read"], expiresInDays: "" });
  const [creating, setCreating] = useState(false);

  const load = () => {
    if (!token || !activeOrg) return;
    fetch(`${API}/api-keys`, { headers: authH(token, activeOrg.id) })
      .then(r => r.json()).then(r => { if (r.success) setKeys(r.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [token, activeOrg]);

  const create = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    const body: any = { name: form.name, scopes: form.scopes };
    if (form.expiresInDays) body.expiresInDays = parseInt(form.expiresInDays);
    const r = await fetch(`${API}/api-keys`, {
      method: "POST", headers: authH(token!, activeOrg!.id), body: JSON.stringify(body),
    }).then(r => r.json());
    setCreating(false);
    if (r.success) { setNewKey(r.data.key); load(); setShowCreate(false); setForm({ name: "", scopes: ["all:read"], expiresInDays: "" }); }
  };

  const revoke = async (id: string) => {
    await fetch(`${API}/api-keys/${id}`, { method: "DELETE", headers: authH(token!, activeOrg!.id) });
    load();
  };

  const copyKey = () => {
    if (newKey) { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const toggleScope = (scope: string) => {
    setForm(f => ({ ...f, scopes: f.scopes.includes(scope) ? f.scopes.filter(s => s !== scope) : [...f.scopes, scope] }));
  };

  if (loading) return <div style={{ color: "var(--text-faint)", padding: 24 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {newKey && (
        <div style={{
          padding: 16, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 10, display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#22c55e", fontSize: 13, fontWeight: 600 }}>
            <CheckCircle style={{ width: 15, height: 15 }} />
            API key created — copy it now, it won't be shown again
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 7 }}>
            <code style={{ flex: 1, fontSize: 12, color: "#a5b4fc", fontFamily: "monospace", wordBreak: "break-all" }}>{newKey}</code>
            <button onClick={copyKey} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)" }}>
              {copied ? <Check style={{ width: 15, height: 15, color: "#22c55e" }} /> : <Copy style={{ width: 15, height: 15 }} />}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} style={{ alignSelf: "flex-end", fontSize: 12, color: "var(--text-faint)", background: "none", border: "none", cursor: "pointer" }}>Dismiss</button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{keys.length} active key(s)</div>
        <button onClick={() => setShowCreate(!showCreate)} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 8, color: "#818cf8", fontSize: 12, cursor: "pointer",
        }}>
          <Plus style={{ width: 13, height: 13 }} /> New API Key
        </button>
      </div>

      {showCreate && (
        <div style={{ padding: 18, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Create API Key</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 11, color: "var(--text-faint)", display: "block", marginBottom: 4 }}>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. My Integration" style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-faint)", display: "block", marginBottom: 4 }}>Expires in (days, optional)</label>
              <input type="number" value={form.expiresInDays} onChange={e => setForm(f => ({ ...f, expiresInDays: e.target.value }))}
                placeholder="e.g. 90" style={inputSt} min="1" max="365" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-faint)", display: "block", marginBottom: 6 }}>Scopes</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SCOPES.map(s => (
                <button key={s} onClick={() => toggleScope(s)} style={{
                  padding: "3px 10px", borderRadius: 9999, fontSize: 11, cursor: "pointer", fontFamily: "monospace",
                  background: form.scopes.includes(s) ? "rgba(99,102,241,0.15)" : "var(--bg-hover)",
                  border: `1px solid ${form.scopes.includes(s) ? "#6366f1" : "var(--border)"}`,
                  color: form.scopes.includes(s) ? "#818cf8" : "var(--text-faint)",
                }}>{s}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowCreate(false)} style={{ ...btnSt, background: "transparent", color: "var(--text-faint)" }}>Cancel</button>
            <button onClick={create} disabled={creating} style={{ ...btnSt, background: "#6366f1", color: "#fff", border: "none" }}>
              {creating ? "Creating…" : "Create Key"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {keys.map(k => (
          <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10 }}>
            <Key style={{ width: 16, height: 16, color: "#8b5cf6", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{k.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <code style={{ color: "#a5b4fc" }}>{k.keyPrefix}…</code>
                {k.scopes.map((s: string) => (
                  <span key={s} style={{ padding: "1px 6px", background: "#1e1b4b", color: "#a5b4fc", borderRadius: 9999, fontSize: 10, fontFamily: "monospace" }}>{s}</span>
                ))}
                {k.lastUsedAt && <span>· Last used {timeAgo(k.lastUsedAt)}</span>}
                {k.expiresAt && <span>· Expires {fmtDate(k.expiresAt)}</span>}
                <span>· Created {fmtDate(k.createdAt)}</span>
              </div>
            </div>
            <button onClick={() => revoke(k.id)} style={{
              padding: "5px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444",
            }}>Revoke</button>
          </div>
        ))}
        {keys.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No active API keys</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  PASSWORD TAB
// ─────────────────────────────────────────────────────────────────
function PasswordTab() {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const strength = (p: string) => {
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const save = async () => {
    if (form.newPassword !== form.confirmPassword) { setMsg({ type: "err", text: "Passwords do not match" }); return; }
    if (strength(form.newPassword) < 4) { setMsg({ type: "err", text: "Password is too weak" }); return; }
    setSaving(true);
    const r = await fetch(`${API}/auth/change-password`, {
      method: "POST", headers: authH(token!, activeOrg!.id),
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    }).then(r => r.json());
    setSaving(false);
    if (r.success) { setMsg({ type: "ok", text: "Password changed successfully" }); setForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); }
    else setMsg({ type: "err", text: r.message || "Failed to change password" });
  };

  const s = strength(form.newPassword);
  const strengthColors = ["", "#ef4444", "#f59e0b", "#f59e0b", "#22c55e"];
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

  return (
    <div style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Change Password</div>
      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Minimum 8 chars with uppercase, number, and special character.</div>

      {msg && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: msg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${msg.type === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: msg.type === "ok" ? "#22c55e" : "#ef4444",
        }}>{msg.text}</div>
      )}

      <div>
        <label style={{ fontSize: 11, color: "var(--text-faint)", display: "block", marginBottom: 4 }}>Current password</label>
        <div style={{ position: "relative" }}>
          <input type={showCurrent ? "text" : "password"} value={form.currentPassword}
            onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
            style={{ ...inputSt, paddingRight: 36 }} />
          <button onClick={() => setShowCurrent(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)" }}>
            {showCurrent ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
          </button>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 11, color: "var(--text-faint)", display: "block", marginBottom: 4 }}>New password</label>
        <div style={{ position: "relative" }}>
          <input type={showNew ? "text" : "password"} value={form.newPassword}
            onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
            style={{ ...inputSt, paddingRight: 36 }} />
          <button onClick={() => setShowNew(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)" }}>
            {showNew ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
          </button>
        </div>
        {form.newPassword && (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= s ? strengthColors[s] : "var(--border)" }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-faint)" }}>
              <span style={{ color: s >= 1 ? "#22c55e" : "var(--text-faint)" }}>8+ chars</span>
              <span style={{ color: /[A-Z]/.test(form.newPassword) ? "#22c55e" : "var(--text-faint)" }}>Uppercase</span>
              <span style={{ color: /[0-9]/.test(form.newPassword) ? "#22c55e" : "var(--text-faint)" }}>Number</span>
              <span style={{ color: /[^A-Za-z0-9]/.test(form.newPassword) ? "#22c55e" : "var(--text-faint)" }}>Special</span>
              {form.newPassword && <span style={{ marginLeft: "auto", color: strengthColors[s] }}>{strengthLabels[s]}</span>}
            </div>
          </div>
        )}
      </div>

      <div>
        <label style={{ fontSize: 11, color: "var(--text-faint)", display: "block", marginBottom: 4 }}>Confirm new password</label>
        <input type="password" value={form.confirmPassword}
          onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
          style={{ ...inputSt, borderColor: form.confirmPassword && form.confirmPassword !== form.newPassword ? "#ef4444" : undefined }} />
      </div>

      <button onClick={save} disabled={saving} style={{ ...btnSt, background: "#6366f1", color: "#fff", border: "none", alignSelf: "flex-start" }}>
        {saving ? "Saving…" : "Change Password"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  IP ALLOWLIST TAB
// ─────────────────────────────────────────────────────────────────
function IpAllowlistTab() {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ipCidr: "", label: "" });
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    if (!token || !activeOrg) return;
    fetch(`${API}/security/ip-allowlist`, { headers: authH(token, activeOrg.id) })
      .then(r => r.json()).then(r => { if (r.success) setList(r.data); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [token, activeOrg]);

  const add = async () => {
    if (!form.ipCidr.trim()) return;
    setAdding(true);
    await fetch(`${API}/security/ip-allowlist`, {
      method: "POST", headers: authH(token!, activeOrg!.id), body: JSON.stringify(form),
    });
    setAdding(false);
    setForm({ ipCidr: "", label: "" });
    setShowAdd(false);
    load();
  };

  const remove = async (id: string) => {
    await fetch(`${API}/security/ip-allowlist/${id}`, { method: "DELETE", headers: authH(token!, activeOrg!.id) });
    load();
  };

  if (loading) return <div style={{ color: "var(--text-faint)", padding: 24 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: "12px 16px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, fontSize: 12, color: "#d97706" }}>
        <strong>Warning:</strong> When the allowlist is non-empty, only listed IPs can access this organization. Make sure you add your current IP before saving.
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          {list.length === 0 ? "No restrictions — all IPs allowed" : `${list.length} IP rule(s)`}
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 8, color: "#818cf8", fontSize: 12, cursor: "pointer",
        }}>
          <Plus style={{ width: 13, height: 13 }} /> Add IP / CIDR
        </button>
      </div>

      {showAdd && (
        <div style={{ padding: 16, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label style={{ fontSize: 11, color: "var(--text-faint)", display: "block", marginBottom: 4 }}>IP / CIDR *</label>
              <input value={form.ipCidr} onChange={e => setForm(f => ({ ...f, ipCidr: e.target.value }))}
                placeholder="e.g. 203.0.113.0/24 or 1.2.3.4" style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-faint)", display: "block", marginBottom: 4 }}>Label (optional)</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Office network" style={inputSt} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowAdd(false)} style={{ ...btnSt, background: "transparent", color: "var(--text-faint)" }}>Cancel</button>
            <button onClick={add} disabled={adding} style={{ ...btnSt, background: "#6366f1", color: "#fff", border: "none" }}>
              {adding ? "Adding…" : "Add Rule"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10 }}>
            <Wifi style={{ width: 16, height: 16, color: "#06b6d4", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <code style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "monospace" }}>{e.ipCidr}</code>
              {e.label && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-faint)" }}>{e.label}</span>}
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>Added {fmtDate(e.createdAt)}</div>
            </div>
            <button onClick={() => remove(e.id)} style={{
              padding: "5px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444",
            }}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  PERMISSIONS TAB
// ─────────────────────────────────────────────────────────────────
const MODULES = ["CRM", "INVENTORY", "PURCHASE", "STORE", "DISPATCH", "ACCOUNTS", "HR", "PROJECTS", "MARKETING", "SUPPORT", "REPORTS", "WAREHOUSE"];
const ACTIONS = ["view", "edit", "delete", "export"] as const;

function PermissionsTab() {
  const { accessToken: token, activeOrg } = useAuthStore();
  const [perms, setPerms] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ userId: "", moduleKey: "CRM", actions: ["view"] as string[] });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    if (!token || !activeOrg) return;
    Promise.all([
      fetch(`${API}/security/permissions`, { headers: authH(token, activeOrg.id) }).then(r => r.json()),
      fetch(`${API}/organizations/${activeOrg.id}/members`, { headers: authH(token, activeOrg.id) }).then(r => r.json()),
    ]).then(([p, m]) => {
      if (p.success) setPerms(p.data);
      if (m.success) setMembers(m.data);
    }).finally(() => setLoading(false));
  };
  useEffect(load, [token, activeOrg]);

  const save = async () => {
    if (!form.userId || !form.moduleKey || !form.actions.length) return;
    setSaving(true);
    await fetch(`${API}/security/permissions`, {
      method: "POST", headers: authH(token!, activeOrg!.id), body: JSON.stringify(form),
    });
    setSaving(false);
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    await fetch(`${API}/security/permissions/${id}`, { method: "DELETE", headers: authH(token!, activeOrg!.id) });
    load();
  };

  const toggleAction = (a: string) => {
    setForm(f => ({ ...f, actions: f.actions.includes(a) ? f.actions.filter(x => x !== a) : [...f.actions, a] }));
  };

  if (loading) return <div style={{ color: "var(--text-faint)", padding: 24 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
        OWNER and ADMIN roles have full access by default. These rules apply only to MEMBER-role users.
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{perms.length} custom rule(s)</div>
        <button onClick={() => setShowForm(!showForm)} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 8, color: "#818cf8", fontSize: 12, cursor: "pointer",
        }}>
          <Plus style={{ width: 13, height: 13 }} /> Add Rule
        </button>
      </div>

      {showForm && (
        <div style={{ padding: 16, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 11, color: "var(--text-faint)", display: "block", marginBottom: 4 }}>User *</label>
              <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} style={inputSt}>
                <option value="">Select user…</option>
                {members.map((m: any) => (
                  <option key={m.userId || m.id} value={m.userId || m.id}>
                    {m.user?.name || m.name || m.email} ({m.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-faint)", display: "block", marginBottom: 4 }}>Module *</label>
              <select value={form.moduleKey} onChange={e => setForm(f => ({ ...f, moduleKey: e.target.value }))} style={inputSt}>
                {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-faint)", display: "block", marginBottom: 6 }}>Allowed Actions</label>
            <div style={{ display: "flex", gap: 8 }}>
              {ACTIONS.map(a => (
                <button key={a} onClick={() => toggleAction(a)} style={{
                  padding: "4px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer",
                  background: form.actions.includes(a) ? "rgba(99,102,241,0.15)" : "var(--bg-hover)",
                  border: `1px solid ${form.actions.includes(a) ? "#6366f1" : "var(--border)"}`,
                  color: form.actions.includes(a) ? "#818cf8" : "var(--text-faint)",
                  textTransform: "capitalize",
                }}>{a}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} style={{ ...btnSt, background: "transparent", color: "var(--text-faint)" }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ ...btnSt, background: "#6366f1", color: "#fff", border: "none" }}>
              {saving ? "Saving…" : "Save Rule"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {perms.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10 }}>
            <Users style={{ width: 15, height: 15, color: "#10b981", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                {p.userId} · {p.moduleKey}
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {p.actions.map((a: string) => (
                  <span key={a} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 9999, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", textTransform: "capitalize" }}>{a}</span>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginRight: 12 }}>
              <Clock style={{ width: 11, height: 11, display: "inline", marginRight: 3 }} />
              {timeAgo(p.createdAt)}
            </div>
            <button onClick={() => remove(p.id)} style={{
              padding: "4px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444",
            }}>Remove</button>
          </div>
        ))}
        {perms.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No custom rules — all members use role defaults</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  SHARED STYLES
// ─────────────────────────────────────────────────────────────────
const inputSt: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px",
  background: "var(--bg-hover)", border: "1px solid var(--border-input)",
  borderRadius: 8, color: "var(--text-primary)", fontSize: 13,
};

const btnSt: React.CSSProperties = {
  padding: "7px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer",
  border: "1px solid var(--border)", fontWeight: 500,
};

// ─────────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export default function SecurityPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Shield style={{ width: 22, height: 22, color: "#6366f1" }} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{ t('page_security') }</h1>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-faint)" }}>Manage sessions, API keys, password, IP restrictions and permissions.</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
              background: "none", border: "none", cursor: "pointer", fontSize: 13,
              color: activeTab === id ? "#818cf8" : "var(--text-faint)",
              borderBottom: activeTab === id ? "2px solid #6366f1" : "2px solid transparent",
              marginBottom: -1, fontWeight: activeTab === id ? 600 : 400,
              transition: "color 0.15s",
            }}
          >
            <Icon style={{ width: 13, height: 13 }} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview"    && <OverviewTab />}
      {activeTab === "sessions"    && <SessionsTab />}
      {activeTab === "apikeys"     && <ApiKeysTab />}
      {activeTab === "password"    && <PasswordTab />}
      {activeTab === "ipallowlist" && <IpAllowlistTab />}
      {activeTab === "permissions" && <PermissionsTab />}
    </div>
  );
}
