import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { ALL_MODULES } from "@/lib/modules";
import { Check, Lock, Clock, X, Send, RotateCcw } from "lucide-react";
import { useTranslation } from 'react-i18next';

const S = {
  sub: { fontSize: 13, color: "var(--text-ghost)", marginTop: 4, marginBottom: 28, maxWidth: 640, lineHeight: 1.5 } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 } as React.CSSProperties,
};

const ALWAYS_ON = ["DASHBOARD"]; // modules that can't be disabled

interface ModuleRequest {
  id: string; moduleKey: string; status: "PENDING" | "APPROVED" | "DENIED";
  message?: string | null; responseNote?: string | null;
}

// ── Request panel — the only way left to gain a module you don't have ──
function RequestPanel({ moduleKey, onClose, onSent }: { moduleKey: string; onClose: () => void; onSent: () => void }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSending(true);
    setError("");
    try {
      await api.post("/organizations/current/module-requests", { moduleKey, message: message || undefined });
      onSent();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not send the request.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      {error && <p style={{ fontSize: 11.5, color: "#f87171", margin: "0 0 8px" }}>{error}</p>}
      <textarea
        value={message} onChange={(e) => setMessage(e.target.value)}
        placeholder="Why do you need this? (optional)"
        style={{ width: "100%", minHeight: 54, resize: "vertical", background: "var(--bg-input)", border: "1px solid var(--border-input)", borderRadius: 6, padding: 8, fontSize: 12, color: "var(--text-primary)", boxSizing: "border-box", fontFamily: "inherit" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={submit} disabled={sending}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 10px", borderRadius: 6, border: "none", background: "#6366f1", color: "white", fontSize: 12, fontWeight: 600, cursor: sending ? "default" : "pointer", opacity: sending ? 0.7 : 1 }}>
          <Send size={12} /> {sending ? "Sending..." : "Send request"}
        </button>
        <button onClick={onClose} style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-ghost)", fontSize: 12, cursor: "pointer" }}>
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

export default function AdminModulesPage() {
  const { t } = useTranslation();
  const { updateActiveOrgModules, loadModuleAccess } = useAuthStore();
  const [enabled, setEnabled] = useState<string[]>([]);
  const [requests, setRequests] = useState<ModuleRequest[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [openRequestFor, setOpenRequestFor] = useState<string | null>(null);
  const [disabling, setDisabling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadingModules(true);
    try {
      const [orgRes, reqRes] = await Promise.all([
        api.get("/organizations/current"),
        api.get("/organizations/current/module-requests"),
      ]);
      setEnabled(orgRes.data.data?.enabledModules ?? []);
      setRequests(reqRes.data.data ?? []);
    } catch { /* leave state as-is on transient failure */ }
    setLoadingModules(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const requestFor = (key: string) => requests.find((r) => r.moduleKey === key && r.status !== "APPROVED");

  const disableModule = async (key: string) => {
    if (!confirm(`Turn off ${ALL_MODULES.find((m) => m.key === key)?.label}? Your team will lose access immediately.`)) return;
    setDisabling(key);
    try {
      const next = enabled.filter((k) => k !== key);
      await api.patch("/organizations/current", { enabledModules: next });
      setEnabled(next);
      updateActiveOrgModules(next);
      await loadModuleAccess();
    } finally {
      setDisabling(null);
    }
  };

  return (
    <div className="page-pad">
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{t('page_admin')}</h1>
      <p style={S.sub}>
        You can turn off a module your organisation no longer needs anytime. Turning a <b>new</b> one on
        needs the platform admin's approval — request it below and it'll unlock as soon as they say yes.
      </p>

      {loadingModules ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--text-ghost)" }}>Loading current module configuration…</div>
      ) : (
        <div style={S.grid}>
          {ALL_MODULES.map((mod) => {
            const isOn = enabled.includes(mod.key);
            const locked = ALWAYS_ON.includes(mod.key);
            const req = requestFor(mod.key);
            const isPending = req?.status === "PENDING";
            const isDenied = req?.status === "DENIED";
            const showingRequestPanel = openRequestFor === mod.key;

            return (
              <div key={mod.key}
                onClick={() => {
                  if (locked) return;
                  if (isOn) { disableModule(mod.key); return; }
                  if (!isPending) setOpenRequestFor(showingRequestPanel ? null : mod.key);
                }}
                style={{
                  background: "var(--bg-card)", borderRadius: 12, padding: "18px 20px",
                  border: `1px solid ${isOn ? "#6366f140" : isPending ? "#f59e0b40" : "var(--border)"}`,
                  cursor: locked ? "default" : isOn ? (disabling === mod.key ? "default" : "pointer") : isPending ? "default" : "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                  position: "relative" as const,
                  opacity: locked ? 0.7 : disabling === mod.key ? 0.5 : 1,
                }}>

                {/* Status indicator, top-right */}
                <div style={{ position: "absolute", top: 16, right: 16 }}>
                  {locked ? <Lock size={14} color="var(--text-ghost)" />
                    : isOn ? (
                      <div style={{ width: 36, height: 20, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", padding: "0 3px", boxSizing: "border-box" }}>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "white", transform: "translateX(16px)" }} />
                      </div>
                    ) : isPending ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#f59e0b", background: "#f59e0b18", padding: "3px 8px", borderRadius: 99 }}>
                        <Clock size={10} /> Pending
                      </span>
                    ) : isDenied ? (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#f87171", background: "#f8717118", padding: "3px 8px", borderRadius: 99 }}>Denied</span>
                    ) : (
                      <div style={{ width: 36, height: 20, borderRadius: 10, background: "var(--border)" }} />
                    )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, paddingRight: 60 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: isOn ? "#6366f120" : "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {locked ? <Lock size={14} color="var(--text-ghost)" /> : isOn ? <Check size={14} color="#818cf8" /> : isDenied ? <RotateCcw size={14} color="var(--text-ghost)" /> : <Clock size={14} color="var(--text-ghost)" style={{ opacity: isPending ? 1 : 0.35 }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isOn ? "var(--text-primary)" : "var(--text-ghost)" }}>{mod.label}</div>
                    {locked && <div style={{ fontSize: 10, color: "var(--text-ghost)" }}>Always enabled</div>}
                  </div>
                </div>

                {mod.description && <p style={{ fontSize: 12, color: "var(--text-ghost)", margin: 0, lineHeight: 1.5 }}>{mod.description}</p>}

                {isDenied && req?.responseNote && (
                  <p style={{ fontSize: 11, color: "#f87171", margin: "8px 0 0" }}>Platform admin: "{req.responseNote}"</p>
                )}
                {isDenied && (
                  <button onClick={(e) => { e.stopPropagation(); setOpenRequestFor(mod.key); }}
                    style={{ marginTop: 8, fontSize: 11.5, color: "#818cf8", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>
                    Request again
                  </button>
                )}
                {!isOn && !locked && !isPending && (
                  <p style={{ fontSize: 11, color: "var(--text-ghost)", margin: "8px 0 0", fontStyle: "italic" }}>
                    {showingRequestPanel ? "" : "Click to request access"}
                  </p>
                )}

                {showingRequestPanel && (
                  <RequestPanel
                    moduleKey={mod.key}
                    onClose={() => setOpenRequestFor(null)}
                    onSent={() => { setOpenRequestFor(null); load(); }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
