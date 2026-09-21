import { useState, useEffect, useCallback } from "react";
import { Copy, Merge, Users, Package, RefreshCw, ChevronDown, ChevronUp, Check } from "lucide-react";
import { useTranslation } from 'react-i18next';
import api from "@/lib/api";



interface PartyRecord {
  id: string;
  name: string;
  displayName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  gstin?: string;
  type: string;
  city?: string;
  createdAt: string;
}

interface ProductRecord {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  sellingPrice?: number;
  createdAt: string;
}

interface PartyGroup {
  field: string;
  matchValue: string;
  parties: PartyRecord[];
}

interface ProductGroup {
  field: string;
  matchValue: string;
  products: ProductRecord[];
}

type Tab = "parties" | "products";

function fieldBadge(field: string) {
  const colors: Record<string, string> = {
    name: "#6366f1",
    email: "#0ea5e9",
    phone: "#f59e0b",
    gstin: "#10b981",
    sku: "#8b5cf6",
  };
  return (
    <span style={{
      display: "inline-block", padding: "1px 8px", borderRadius: 99,
      fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
      background: (colors[field] ?? "#6366f1") + "22",
      color: colors[field] ?? "#6366f1",
      border: `1px solid ${(colors[field] ?? "#6366f1")}44`,
    }}>
      {field}
    </span>
  );
}

function PartyGroupCard({ group, onMerged }: { group: PartyGroup; onMerged: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [keepId, setKeepId] = useState(group.parties[0].id);
  const [merging, setMerging] = useState(false);
  const [done, setDone] = useState(false);

  async function handleMerge() {
    setMerging(true);
    try {
      const mergeIds = group.parties.filter(p => p.id !== keepId).map(p => p.id);
      await api.post("/duplicates/parties/merge", { keepId, mergeIds });
      setDone(true);
      setTimeout(onMerged, 800);
    } finally {
      setMerging(false);
    }
  }

  if (done) return (
    <div style={{ background: "var(--bg-card)", border: "1px solid #10b98133", borderRadius: 12, padding: "12px 16px", marginBottom: 8 }}>
      <div className="flex items-center gap-2" style={{ color: "#10b981" }}>
        <Check className="w-4 h-4" />
        <span className="text-sm font-medium">Merged successfully</span>
      </div>
    </div>
  );

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <div className="flex items-center gap-2">
          {fieldBadge(group.field)}
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            &quot;{group.matchValue}&quot;
          </span>
          <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
            {group.parties.length} duplicates
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-ghost)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-ghost)" }} />}
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
          <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            {group.parties.map(p => (
              <label
                key={p.id}
                className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                style={{
                  border: `1px solid ${keepId === p.id ? "#6366f1" : "var(--border)"}`,
                  background: keepId === p.id ? "#6366f120" : "var(--bg-hover)",
                }}
              >
                <input
                  type="radio"
                  name={`keep-${group.matchValue}-${group.field}`}
                  checked={keepId === p.id}
                  onChange={() => setKeepId(p.id)}
                  style={{ marginTop: 2, accentColor: "#6366f1" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                    {p.displayName && p.displayName !== p.name && (
                      <span className="text-xs" style={{ color: "var(--text-ghost)" }}>({p.displayName})</span>
                    )}
                    <span style={{
                      fontSize: 10, padding: "1px 6px", borderRadius: 99,
                      background: p.type === "CUSTOMER" ? "#0ea5e922" : "#f59e0b22",
                      color: p.type === "CUSTOMER" ? "#0ea5e9" : "#f59e0b",
                    }}>{p.type}</span>
                    {keepId === p.id && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "#6366f122", color: "#6366f1" }}>KEEP</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {p.email && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.email}</span>}
                    {(p.phone || p.mobile) && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.phone || p.mobile}</span>}
                    {p.gstin && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>GSTIN: {p.gstin}</span>}
                    {p.city && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.city}</span>}
                    <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
                      Added {new Date(p.createdAt).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMerge}
              disabled={merging}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "#6366f1", color: "#fff", border: "none", cursor: merging ? "wait" : "pointer", opacity: merging ? 0.7 : 1 }}
            >
              <Merge className="w-3.5 h-3.5" />
              {merging ? "Merging…" : "Merge — keep selected"}
            </button>
            <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
              Others will be archived
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductGroupCard({ group }: { group: ProductGroup }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <div className="flex items-center gap-2">
          {fieldBadge(group.field)}
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            &quot;{group.matchValue}&quot;
          </span>
          <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
            {group.products.length} duplicates
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-ghost)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-ghost)" }} />}
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
          <div style={{ display: "grid", gap: 6 }}>
            {group.products.map(p => (
              <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ border: "1px solid var(--border)", background: "var(--bg-hover)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                    {p.sku && <span className="text-xs" style={{ color: "var(--text-ghost)" }}>SKU: {p.sku}</span>}
                    {p.category && <span className="text-xs" style={{ color: "var(--text-ghost)" }}>{p.category}</span>}
                  </div>
                  <div className="flex gap-4 mt-1">
                    {p.sellingPrice !== undefined && (
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        ₹{Number(p.sellingPrice).toLocaleString("en-IN")}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
                      Added {new Date(p.createdAt).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--text-ghost)" }}>
            Review these products in Inventory and manually merge or delete duplicates.
          </p>
        </div>
      )}
    </div>
  );
}

export default function DuplicatesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("parties");
  const [partyGroups, setPartyGroups] = useState<PartyGroup[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pr, prod] = await Promise.all([
        api.get("/duplicates/parties").then(r => r.data),
        api.get("/duplicates/products").then(r => r.data),
      ]);
      setPartyGroups(pr.data?.groups ?? []);
      setProductGroups(prod.data?.groups ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to load duplicate data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabBtn = (tabId: Tab, label: string, count: number) => (
    <button
      onClick={() => setTab(tabId)}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
      style={{
        background: tab === tabId ? "#6366f1" : "var(--bg-hover)",
        color: tab === tabId ? "#fff" : "var(--text-secondary)",
        border: "none", cursor: "pointer",
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          background: tab === tabId ? "#ffffff33" : "#6366f133",
          color: tab === tabId ? "#fff" : "#6366f1",
          borderRadius: 99, padding: "0 6px", fontSize: 11, fontWeight: 700,
        }}>{count}</span>
      )}
    </button>
  );

  return (
    <div style={{ padding: "24px 28px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{ t('page_duplicates') }</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-ghost)" }}>
            Find and merge duplicate contacts, vendors, and products
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer" }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5" }}>
          <span>{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontWeight: 700, marginLeft: 12 }}>✕</button>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid-r2" style={{ gap: 12, marginBottom: 20 }}>
        {[
          { icon: Users, label: "Party duplicates", value: partyGroups.length, color: "#6366f1" },
          { icon: Package, label: "Product duplicates", value: productGroups.length, color: "#f59e0b" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon style={{ width: 18, height: 18, color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)", lineHeight: 1 }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-ghost)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {tabBtn("parties", "Contacts / Vendors", partyGroups.length)}
        {tabBtn("products", "Products", productGroups.length)}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--text-ghost)" }} />
          <span className="ml-2 text-sm" style={{ color: "var(--text-ghost)" }}>Scanning for duplicates…</span>
        </div>
      ) : tab === "parties" ? (
        partyGroups.length === 0 ? (
          <div className="text-center py-16">
            <Copy className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-ghost)", opacity: 0.4 }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No duplicate parties found</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>All your contacts and vendors look unique</p>
          </div>
        ) : (
          <div>
            {partyGroups.map((g, i) => (
              <PartyGroupCard key={`${g.field}-${g.matchValue}-${i}`} group={g} onMerged={load} />
            ))}
          </div>
        )
      ) : (
        productGroups.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-ghost)", opacity: 0.4 }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No duplicate products found</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-ghost)" }}>All your products look unique</p>
          </div>
        ) : (
          <div>
            {productGroups.map((g, i) => (
              <ProductGroupCard key={`${g.field}-${g.matchValue}-${i}`} group={g} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
