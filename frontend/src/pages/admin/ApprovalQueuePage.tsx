import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Clock, ShoppingCart, Receipt, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { apiClient } from "@/lib/apiClient";
import { useTranslation } from 'react-i18next';

interface PO {
  id: string;
  poNumber: string;
  total: number;
  orderDate: string;
  notes?: string;
  party?: { name: string };
  createdById?: string;
}

interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  notes?: string;
  employee: { name: string; designation?: string };
}

interface Pending { purchaseOrders: PO[]; expenses: Expense[] }

type Tab = "po" | "expense";

function fmt(n: number) {
  return "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ApprovalQueuePage() {
  const { t } = useTranslation();
  const { activeOrg } = useAuthStore();
  const [tab, setTab] = useState<Tab>("po");
  const [data, setData] = useState<Pending>({ purchaseOrders: [], expenses: [] });
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!activeOrg?.id) return;
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: Pending }>("/approvals/pending");
      setData(res.data.data);
    } finally {
      setLoading(false);
    }
  }, [activeOrg?.id]);

  useEffect(() => { load(); }, [load]);

  async function act(type: "po" | "expense", id: string, action: "approve" | "reject") {
    setActionId(id);
    try {
      await apiClient.post(`/approvals/${type}/${id}/${action}`, { note: noteMap[id] || "" });
      await load();
    } finally {
      setActionId(null);
    }
  }

  const poBadge = data.purchaseOrders.length;
  const expBadge = data.expenses.length;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 960, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{ t('page_admin') }</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-ghost)" }}>
            Review and approve purchase orders and expense claims
          </p>
        </div>
        <button onClick={load}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-sec)", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--bg-hover)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {([["po", "Purchase Orders", ShoppingCart, poBadge], ["expense", "Expenses", Receipt, expBadge]] as const).map(([key, label, Icon, count]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
              background: tab === key ? "var(--bg-card)" : "transparent",
              color: tab === key ? "var(--text-primary)" : "var(--text-ghost)",
              boxShadow: tab === key ? "0 1px 4px rgba(0,0,0,0.25)" : "none",
              transition: "all 0.15s",
            }}>
            <Icon size={14} />
            {label}
            {count > 0 && (
              <span style={{ background: "#6366f1", color: "#fff", borderRadius: 99, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-ghost)", fontSize: 14 }}>Loading…</div>
      ) : tab === "po" ? (
        data.purchaseOrders.length === 0 ? (
          <EmptyState icon={<CheckCircle size={40} color="#10b981" />} message="No purchase orders awaiting approval" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.purchaseOrders.map(po => (
              <ApprovalCard
                key={po.id}
                id={po.id}
                title={`PO # ${po.poNumber}`}
                subtitle={po.party?.name ?? "No supplier"}
                meta={[
                  { label: "Amount", value: fmt(po.total) },
                  { label: "Date", value: new Date(po.orderDate).toLocaleDateString("en-IN") },
                  po.notes ? { label: "Notes", value: po.notes } : null,
                ]}
                note={noteMap[po.id] || ""}
                onNoteChange={v => setNoteMap(p => ({ ...p, [po.id]: v }))}
                onApprove={() => act("po", po.id, "approve")}
                onReject={() => act("po", po.id, "reject")}
                busy={actionId === po.id}
              />
            ))}
          </div>
        )
      ) : (
        data.expenses.length === 0 ? (
          <EmptyState icon={<CheckCircle size={40} color="#10b981" />} message="No expense claims awaiting approval" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.expenses.map(exp => (
              <ApprovalCard
                key={exp.id}
                id={exp.id}
                title={exp.title}
                subtitle={`${exp.employee.name}${exp.employee.designation ? ` — ${exp.employee.designation}` : ""}`}
                meta={[
                  { label: "Amount", value: fmt(exp.amount) },
                  { label: "Category", value: exp.category },
                  { label: "Date", value: new Date(exp.expenseDate).toLocaleDateString("en-IN") },
                  exp.notes ? { label: "Notes", value: exp.notes } : null,
                ]}
                note={noteMap[exp.id] || ""}
                onNoteChange={v => setNoteMap(p => ({ ...p, [exp.id]: v }))}
                onApprove={() => act("expense", exp.id, "approve")}
                onReject={() => act("expense", exp.id, "reject")}
                busy={actionId === exp.id}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

interface CardProps {
  id: string;
  title: string;
  subtitle: string;
  meta: (null | { label: string; value: string })[];
  note: string;
  onNoteChange: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}

function ApprovalCard({ title, subtitle, meta, note, onNoteChange, onApprove, onReject, busy }: CardProps) {
  const [showNote, setShowNote] = useState(false);

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Clock size={14} color="#f59e0b" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pending Approval</span>
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-ghost)" }}>{subtitle}</p>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={() => setShowNote(p => !p)}
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-sec)", cursor: "pointer", fontSize: 12 }}>
            + Note
          </button>
          <button onClick={onReject} disabled={busy}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, border: "1px solid #ef444430", background: "#ef444410", color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: busy ? 0.5 : 1 }}>
            <XCircle size={14} /> Reject
          </button>
          <button onClick={onApprove} disabled={busy}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: busy ? 0.5 : 1 }}>
            <CheckCircle size={14} /> Approve
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginTop: 14 }}>
        {meta.filter(Boolean).map((m, i) => (
          <span key={i} style={{ fontSize: 12, color: "var(--text-ghost)" }}>
            <span style={{ color: "var(--text-sec)", fontWeight: 600 }}>{m!.label}:</span> {m!.value}
          </span>
        ))}
      </div>

      {showNote && (
        <div style={{ marginTop: 12 }}>
          <input
            value={note}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="Add an optional note for the requester…"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" }}
          />
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-ghost)" }}>
      <div style={{ marginBottom: 12 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
    </div>
  );
}
