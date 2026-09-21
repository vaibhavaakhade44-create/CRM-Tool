import { useState, useEffect } from "react";
import { Plus, Zap, Trash2, ToggleLeft, ToggleRight, ChevronRight, Activity, Tag, Star, UserPlus, CalendarClock } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from 'react-i18next';

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  triggerValue: string | null;
  actionType: string;
  actionConfig: Record<string, any>;
  isActive: boolean;
  executionCount: number;
  createdAt: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  status_changed: "Status Changed",
  lead_created: "Lead Created",
  tag_added: "Tag Added",
  score_above: "Score Above",
  follow_up_due: "Follow-up Due",
};

const ACTION_LABELS: Record<string, string> = {
  create_followup: "Schedule Follow-up",
  add_tag: "Add Tag",
  update_grade: "Set Lead Grade",
  assign_to: "Assign To User",
};

const TRIGGER_ICON: Record<string, React.ElementType> = {
  status_changed: Activity,
  lead_created: Zap,
  tag_added: Tag,
  score_above: Star,
  follow_up_due: CalendarClock,
};

const ACTION_ICON: Record<string, React.ElementType> = {
  create_followup: CalendarClock,
  add_tag: Tag,
  update_grade: Star,
  assign_to: UserPlus,
};

const STATUS_OPTIONS = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];
const GRADE_OPTIONS = ["A", "B", "C", "D"];

interface RuleFormData {
  name: string;
  trigger: string;
  triggerValue: string;
  actionType: string;
  actionConfig: Record<string, any>;
}

const DEFAULT_FORM: RuleFormData = {
  name: "",
  trigger: "status_changed",
  triggerValue: "CONTACTED",
  actionType: "create_followup",
  actionConfig: { days: 1, note: "" },
};

function ActionConfigFields({ actionType, config, onChange }: {
  actionType: string;
  config: Record<string, any>;
  onChange: (c: Record<string, any>) => void;
}) {
  if (actionType === "create_followup") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Days from now
          </label>
          <input
            type="number"
            min={1}
            max={90}
            value={config.days ?? 1}
            onChange={e => onChange({ ...config, days: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Follow-up note (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Call and check interest"
            value={config.note ?? ""}
            onChange={e => onChange({ ...config, note: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
          />
        </div>
      </div>
    );
  }
  if (actionType === "add_tag") {
    return (
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Tag to add</label>
        <input
          type="text"
          placeholder="e.g. hot-lead"
          value={config.tag ?? ""}
          onChange={e => onChange({ ...config, tag: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
        />
      </div>
    );
  }
  if (actionType === "update_grade") {
    return (
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Set grade to</label>
        <select
          value={config.grade ?? "A"}
          onChange={e => onChange({ ...config, grade: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
        >
          {GRADE_OPTIONS.map(g => <option key={g} value={g}>Grade {g}</option>)}
        </select>
      </div>
    );
  }
  if (actionType === "assign_to") {
    return (
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>User ID to assign</label>
        <input
          type="text"
          placeholder="Paste user ID"
          value={config.userId ?? ""}
          onChange={e => onChange({ ...config, userId: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
        />
        <p className="text-[11px] mt-1" style={{ color: "var(--text-ghost)" }}>
          You can find user IDs in Admin → Team page
        </p>
      </div>
    );
  }
  return null;
}

function TriggerValueField({ trigger, value, onChange }: {
  trigger: string;
  value: string;
  onChange: (v: string) => void;
}) {
  if (trigger === "status_changed") {
    return (
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>When status changes to</label>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    );
  }
  if (trigger === "tag_added") {
    return (
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>When tag is added</label>
        <input
          type="text"
          placeholder="e.g. hot-lead"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
        />
      </div>
    );
  }
  if (trigger === "score_above") {
    return (
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Score threshold</label>
        <input
          type="number"
          min={1}
          max={100}
          placeholder="e.g. 70"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
        />
      </div>
    );
  }
  return null;
}

function CreateRuleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { activeOrg } = useAuthStore();
  const [form, setForm] = useState<RuleFormData>({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Rule name is required"); return; }
    setSaving(true);
    setError("");
    try {
      await api.post("/automations", {
        ...form,
        triggerValue: form.triggerValue || null,
      }, { headers: { "x-organization-id": activeOrg?.id } });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create rule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-lg rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <Zap className="w-4.5 h-4.5 text-amber-400" />
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Automation Rule</h2>
          </div>
          <button onClick={onClose} className="text-lg font-light" style={{ color: "var(--text-ghost)" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Rule Name *</label>
            <input
              type="text"
              placeholder="e.g. Auto follow-up after contact"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
            />
          </div>

          {/* Trigger section */}
          <div className="rounded-xl p-4" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#818cf8" }}>WHEN (Trigger)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Trigger Event</label>
                <select
                  value={form.trigger}
                  onChange={e => setForm(f => ({ ...f, trigger: e.target.value, triggerValue: "" }))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
                >
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <TriggerValueField
                trigger={form.trigger}
                value={form.triggerValue}
                onChange={v => setForm(f => ({ ...f, triggerValue: v }))}
              />
            </div>
          </div>

          {/* Action section */}
          <div className="rounded-xl p-4" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#34d399" }}>THEN (Action)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Action Type</label>
                <select
                  value={form.actionType}
                  onChange={e => setForm(f => ({ ...f, actionType: e.target.value, actionConfig: {} }))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
                >
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <ActionConfigFields
                actionType={form.actionType}
                config={form.actionConfig}
                onChange={c => setForm(f => ({ ...f, actionConfig: c }))}
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: saving ? "#4338ca99" : "#4f46e5" }}>
              {saving ? "Creating…" : "Create Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RuleCard({ rule, onToggle, onDelete }: {
  rule: AutomationRule;
  onToggle: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const TriggerIcon = TRIGGER_ICON[rule.trigger] || Zap;
  const ActionIcon = ACTION_ICON[rule.actionType] || Zap;

  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${rule.isActive ? "rgba(99,102,241,0.25)" : "var(--border)"}`,
        opacity: rule.isActive ? 1 : 0.65,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: rule.isActive ? "rgba(99,102,241,0.12)" : "var(--bg-hover)" }}>
            <Zap className="w-4 h-4" style={{ color: rule.isActive ? "#818cf8" : "var(--text-ghost)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{rule.name}</p>
            <p className="text-[11px]" style={{ color: "var(--text-ghost)" }}>
              Ran {rule.executionCount} time{rule.executionCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onToggle(rule.id, rule.isActive)}
            className="transition-colors"
            title={rule.isActive ? "Disable rule" : "Enable rule"}
          >
            {rule.isActive
              ? <ToggleRight className="w-6 h-6" style={{ color: "#818cf8" }} />
              : <ToggleLeft className="w-6 h-6" style={{ color: "var(--text-ghost)" }} />
            }
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="p-1 rounded-lg transition-colors hover:bg-red-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" style={{ color: "#f87171" }} />
          </button>
        </div>
      </div>

      {/* Trigger → Action flow */}
      <div className="flex items-center gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.12)" }}>
          <TriggerIcon className="w-3 h-3 flex-shrink-0" style={{ color: "#818cf8" }} />
          <span style={{ color: "#818cf8", fontWeight: 500 }}>
            {TRIGGER_LABELS[rule.trigger] || rule.trigger}
            {rule.triggerValue ? ` → ${rule.triggerValue}` : ""}
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-ghost)" }} />
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.12)" }}>
          <ActionIcon className="w-3 h-3 flex-shrink-0" style={{ color: "#34d399" }} />
          <span style={{ color: "#34d399", fontWeight: 500 }}>
            {ACTION_LABELS[rule.actionType] || rule.actionType}
          </span>
        </div>
      </div>

      {/* Action config summary */}
      {Object.keys(rule.actionConfig || {}).length > 0 && (
        <div className="mt-2 text-[11px] px-2 py-1.5 rounded-lg" style={{ background: "var(--bg-hover)", color: "var(--text-ghost)" }}>
          {rule.actionType === "create_followup" && `Follow up in ${rule.actionConfig.days} day(s)${rule.actionConfig.note ? ` — "${rule.actionConfig.note}"` : ""}`}
          {rule.actionType === "add_tag" && `Add tag: "${rule.actionConfig.tag}"`}
          {rule.actionType === "update_grade" && `Set grade to: ${rule.actionConfig.grade}`}
          {rule.actionType === "assign_to" && `Assign to user: ${rule.actionConfig.userId}`}
        </div>
      )}
    </div>
  );
}

export default function AutomationPage() {
  const { t } = useTranslation();
  const { activeOrg } = useAuthStore();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const orgHeader = { headers: { "x-organization-id": activeOrg?.id } };

  async function fetchRules() {
    try {
      const res = await api.get("/automations", orgHeader);
      setRules(res.data?.data ?? []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (activeOrg) fetchRules(); }, [activeOrg]);

  async function handleToggle(id: string, current: boolean) {
    try {
      await api.patch(`/automations/${id}/toggle`, {}, orgHeader);
      setRules(rs => rs.map(r => r.id === id ? { ...r, isActive: !current } : r));
    } catch {}
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this automation rule?")) return;
    try {
      await api.delete(`/automations/${id}`, orgHeader);
      setRules(rs => rs.filter(r => r.id !== id));
    } catch {}
  }

  const active = rules.filter(r => r.isActive);
  const inactive = rules.filter(r => !r.isActive);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Zap className="w-5 h-5" style={{ color: "#f59e0b" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_automations') }</h1>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Auto-trigger actions when lead events happen — follow-ups, tags, grading, and assignment.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 12px rgba(99,102,241,0.35)" }}
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Rules", value: rules.length, color: "#818cf8" },
          { label: "Active", value: active.length, color: "#34d399" },
          { label: "Inactive", value: inactive.length, color: "#9ca3af" },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16" style={{ color: "var(--text-ghost)" }}>
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading rules…</p>
          </div>
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(245,158,11,0.1)" }}>
            <Zap className="w-7 h-7" style={{ color: "#f59e0b" }} />
          </div>
          <h3 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>No automation rules yet</h3>
          <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
            Create your first rule to automate repetitive tasks like follow-ups and tagging.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: "#4f46e5" }}
          >
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Active rules */}
          {active.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2"
                style={{ color: "#34d399" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Active ({active.length})
              </p>
              <div className="space-y-3">
                {active.map(r => (
                  <RuleCard key={r.id} rule={r} onToggle={handleToggle} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}

          {/* Inactive rules */}
          {inactive.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2"
                style={{ color: "var(--text-ghost)" }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--text-ghost)" }} />
                Inactive ({inactive.length})
              </p>
              <div className="space-y-3">
                {inactive.map(r => (
                  <RuleCard key={r.id} rule={r} onToggle={handleToggle} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* How it works panel */}
      <div className="mt-8 rounded-2xl p-5" style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.12)" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "#818cf8" }}>How Automation Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: "Status Changed", desc: "When a lead status is updated, automatically schedule a follow-up or change grade." },
            { title: "Lead Created", desc: "When a new lead is added, auto-assign it to a team member or add a welcome tag." },
            { title: "Tag Added", desc: "When a specific tag is applied, trigger grading updates or re-assignment." },
            { title: "Follow-up Due", desc: "When a follow-up is due, auto-create the next follow-up date to keep pipeline moving." },
          ].map(item => (
            <div key={item.title} className="p-3 rounded-xl" style={{ background: "var(--bg-card)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{item.title}</p>
              <p className="text-[11px]" style={{ color: "var(--text-ghost)" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <CreateRuleModal onClose={() => setShowCreate(false)} onCreated={fetchRules} />
      )}
    </div>
  );
}
