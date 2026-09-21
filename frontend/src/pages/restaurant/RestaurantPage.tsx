import { useState, useEffect, useCallback } from "react";
import {
  UtensilsCrossed, Plus, Minus, Trash2, ChefHat, Receipt,
  Table2, RefreshCw, Search, Tag, Leaf, Drumstick,
  Clock, CheckCircle, AlertCircle, X, Edit2,
} from "lucide-react";
import api from "@/lib/api";
import { getApiError } from "@/lib/utils";
import { useTranslation } from 'react-i18next';

// ── Types ────────────────────────────────────────────────────

interface Table { id: string; tableNumber: string; section?: string; capacity: number; status: string; }
interface Category { id: string; name: string; }
interface MenuItem { id: string; name: string; price: number; foodType: string; categoryId: string; description?: string; isAvailable: boolean; }
interface CartItem { menuItemId: string; itemName: string; price: number; quantity: number; notes?: string; }
interface KOT { id: string; kotNumber: string; status: string; orderType: string; total: number; subtotal: number; taxAmount: number; items: any[]; table?: { tableNumber: string; section?: string }; customerName?: string; createdAt: string; }

// ── Constants ────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "#10b981", OCCUPIED: "#ef4444", RESERVED: "#f59e0b", CLEANING: "#6366f1",
};
const KOT_COLOR: Record<string, string> = {
  PENDING: "#f59e0b", PREPARING: "#6366f1", READY: "#10b981", SERVED: "#6b7280", CANCELLED: "#ef4444",
};

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
  background: active ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "var(--bg-hover)",
  color: active ? "white" : "var(--text-sec)", transition: "all 0.15s",
});

const CARD: React.CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16,
};

// ── Main Component ────────────────────────────────────────────

export default function RestaurantPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"pos" | "kot" | "menu" | "tables">("pos");
  const [tables, setTables] = useState<Table[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [kots, setKots] = useState<KOT[]>([]);
  const [stats, setStats] = useState<any>(null);

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [orderType, setOrderType] = useState("DINE_IN");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Modals
  const [showBillModal, setShowBillModal] = useState(false);
  const [billKot, setBillKot] = useState<KOT | null>(null);
  const [payMethod, setPayMethod] = useState("CASH");
  const [discount, setDiscount] = useState("0");
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableForm, setTableForm] = useState({ tableNumber: "", section: "", capacity: "4" });
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuForm, setMenuForm] = useState<any>({ name: "", categoryId: "", price: "", costPrice: "0", foodType: "VEG", description: "", taxRate: "5", preparationTime: "" });
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [catForm, setCatForm] = useState({ name: "" });

  const load = useCallback(async () => {
    try {
      const [t, c, m, k, s] = await Promise.all([
        api.get("/restaurant/tables"),
        api.get("/restaurant/categories"),
        api.get("/restaurant/items"),
        api.get("/restaurant/kot?status=PENDING,PREPARING,READY"),
        api.get("/restaurant/dashboard"),
      ]);
      setTables(t.data.data || []);
      setCategories(c.data.data || []);
      setMenuItems(m.data.data || []);
      setKots(k.data.data || []);
      setStats(s.data.data);
      if (c.data.data?.length && !activeCategory) setActiveCategory(c.data.data[0].id);
    } catch (e) { setError(getApiError(e)); }
  }, [activeCategory]);

  useEffect(() => { load(); }, []);

  // ── Cart helpers ────────────────────────────────────────────

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const ex = prev.find(c => c.menuItemId === item.id);
      if (ex) return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, itemName: item.name, price: item.price, quantity: 1 }];
    });
  }
  function removeFromCart(id: string) { setCart(prev => prev.filter(c => c.menuItemId !== id)); }
  function changeQty(id: string, delta: number) {
    setCart(prev => prev.map(c => c.menuItemId === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  }
  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const cartTax   = cartTotal * 0.05;

  // ── Send KOT ────────────────────────────────────────────────

  async function sendKOT() {
    if (!cart.length) return;
    if (orderType === "DINE_IN" && !selectedTable) { setError("Select a table for dine-in orders"); return; }
    setLoading(true); setError("");
    try {
      await api.post("/restaurant/kot", {
        tableId: orderType === "DINE_IN" ? selectedTable?.id : undefined,
        orderType, items: cart,
      });
      setCart([]); setSelectedTable(null);
      await load();
    } catch (e) { setError(getApiError(e)); }
    setLoading(false);
  }

  // ── Generate bill ───────────────────────────────────────────

  async function generateBill() {
    if (!billKot) return;
    setLoading(true); setError("");
    try {
      await api.post("/restaurant/bills", { kotId: billKot.id, discount, paymentMethod: payMethod });
      setShowBillModal(false); setBillKot(null); setDiscount("0");
      await load();
    } catch (e) { setError(getApiError(e)); }
    setLoading(false);
  }

  // ── Update KOT status ────────────────────────────────────────

  async function updateKOTStatus(kotId: string, status: string) {
    try {
      await api.patch(`/restaurant/kot/${kotId}/status`, { status });
      setKots(prev => prev.map(k => k.id === kotId ? { ...k, status } : k));
    } catch (e) { setError(getApiError(e)); }
  }

  // ── Save table ──────────────────────────────────────────────

  async function saveTable() {
    if (!tableForm.tableNumber) return;
    setLoading(true);
    try {
      await api.post("/restaurant/tables", { ...tableForm, capacity: parseInt(tableForm.capacity) });
      setShowTableModal(false); setTableForm({ tableNumber: "", section: "", capacity: "4" });
      await load();
    } catch (e) { setError(getApiError(e)); }
    setLoading(false);
  }

  // ── Save menu item ──────────────────────────────────────────

  async function saveMenuItem() {
    if (!menuForm.name || !menuForm.categoryId || !menuForm.price) return;
    setLoading(true);
    try {
      if (editingItem) {
        await api.patch(`/restaurant/items/${editingItem.id}`, menuForm);
      } else {
        await api.post("/restaurant/items", menuForm);
      }
      setShowMenuModal(false); setEditingItem(null);
      setMenuForm({ name: "", categoryId: "", price: "", costPrice: "0", foodType: "VEG", description: "", taxRate: "5", preparationTime: "" });
      await load();
    } catch (e) { setError(getApiError(e)); }
    setLoading(false);
  }

  // ── Save category ────────────────────────────────────────────

  async function saveCategory() {
    if (!catForm.name) return;
    setLoading(true);
    try {
      await api.post("/restaurant/categories", catForm);
      setShowCategoryModal(false); setCatForm({ name: "" });
      await load();
    } catch (e) { setError(getApiError(e)); }
    setLoading(false);
  }

  const visibleItems = menuItems.filter(i =>
    i.isAvailable &&
    (!activeCategory || i.categoryId === activeCategory) &&
    (!menuSearch || i.name.toLowerCase().includes(menuSearch.toLowerCase()))
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-main)", padding: 20 }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#f59e0b,#ef4444)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UtensilsCrossed size={18} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{ t('page_restaurant') }</h1>
            <p style={{ fontSize: 12, color: "var(--text-ghost)", margin: 0 }}>Petpooja-style point of sale</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {stats && (
            <>
              <Stat label="Available" value={stats.tables.AVAILABLE || 0} color="#10b981" />
              <Stat label="Occupied"  value={stats.tables.OCCUPIED  || 0} color="#ef4444" />
              <Stat label="Active KOTs" value={stats.activeKOTs}         color="#6366f1" />
              <Stat label="Today ₹"  value={`₹${(stats.todayRevenue||0).toLocaleString("en-IN")}`} color="#f59e0b" />
            </>
          )}
          <button onClick={load} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", color: "var(--text-sec)" }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 8, fontSize: 13, color: "#f87171" }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "#f87171" }}><X size={14} /></button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {(["pos", "kot", "menu", "tables"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={TAB_STYLE(tab === t)}>
            {t === "pos" ? "🍽️ POS" : t === "kot" ? "👨‍🍳 Kitchen" : t === "menu" ? "📋 Menu" : "🪑 Tables"}
          </button>
        ))}
      </div>

      {/* ══════════════════ POS TAB ══════════════════ */}
      {tab === "pos" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
          {/* Left: menu */}
          <div>
            {/* Order type */}
            <div style={{ ...CARD, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["DINE_IN", "TAKEAWAY", "DELIVERY"].map(ot => (
                  <button key={ot} onClick={() => setOrderType(ot)} style={{ ...TAB_STYLE(orderType === ot), padding: "6px 14px" }}>
                    {ot === "DINE_IN" ? "🍽 Dine-in" : ot === "TAKEAWAY" ? "📦 Takeaway" : "🛵 Delivery"}
                  </button>
                ))}
              </div>
              {orderType === "DINE_IN" && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {tables.map(t => (
                    <button key={t.id} onClick={() => setSelectedTable(t)}
                      style={{ padding: "5px 12px", borderRadius: 7, border: `2px solid ${selectedTable?.id === t.id ? "#6366f1" : "var(--border)"}`, background: selectedTable?.id === t.id ? "rgba(99,102,241,0.1)" : "var(--bg-hover)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: STATUS_COLOR[t.status] }}>
                      T{t.tableNumber} {t.section ? `(${t.section})` : ""} ●
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Category filter + search */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 140 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" }} />
                <input value={menuSearch} onChange={e => setMenuSearch(e.target.value)} placeholder="Search items…"
                  style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-hover)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", outline: "none" }} />
              </div>
              {categories.map(c => (
                <button key={c.id} onClick={() => setActiveCategory(c.id)} style={{ ...TAB_STYLE(activeCategory === c.id), padding: "6px 12px", fontSize: 12 }}>
                  {c.name}
                </button>
              ))}
            </div>

            {/* Items grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              {visibleItems.map(item => {
                const inCart = cart.find(c => c.menuItemId === item.id);
                return (
                  <div key={item.id} onClick={() => addToCart(item)}
                    style={{ ...CARD, cursor: "pointer", position: "relative", transition: "transform 0.1s", border: inCart ? "2px solid #6366f1" : "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                      {item.foodType === "VEG" ? <Leaf size={12} color="#10b981" /> : <Drumstick size={12} color="#ef4444" />}
                      <span style={{ fontSize: 10, color: item.foodType === "VEG" ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                        {item.foodType.replace("_", " ")}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.3 }}>{item.name}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#6366f1" }}>₹{Number(item.price).toFixed(0)}</div>
                    {inCart && (
                      <div style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: "50%", background: "#6366f1", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {inCart.quantity}
                      </div>
                    )}
                  </div>
                );
              })}
              {!visibleItems.length && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--text-ghost)", fontSize: 14 }}>
                  {categories.length ? "No items in this category" : "Add menu categories and items first →"}
                </div>
              )}
            </div>
          </div>

          {/* Right: cart */}
          <div style={{ position: "sticky", top: 20 }}>
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Receipt size={16} color="#6366f1" />
                <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 15 }}>
                  Order {selectedTable ? `— Table ${selectedTable.tableNumber}` : ""}
                </span>
                {cart.length > 0 && <button onClick={() => setCart([])} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><Trash2 size={14} /></button>}
              </div>

              {cart.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-ghost)", fontSize: 13 }}>
                  <UtensilsCrossed size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <div>Tap items to add to order</div>
                </div>
              ) : (
                <>
                  {cart.map(item => (
                    <div key={item.menuItemId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName}</div>
                        <div style={{ fontSize: 12, color: "#6366f1" }}>₹{(item.price * item.quantity).toFixed(0)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => changeQty(item.menuItemId, -1)} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus size={11} /></button>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", minWidth: 16, textAlign: "center" }}>{item.quantity}</span>
                        <button onClick={() => changeQty(item.menuItemId, 1)} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={11} /></button>
                        <button onClick={() => removeFromCart(item.menuItemId)} style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={11} /></button>
                      </div>
                    </div>
                  ))}

                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
                    <Row label="Subtotal" value={`₹${cartTotal.toFixed(0)}`} />
                    <Row label="GST (5%)" value={`₹${cartTax.toFixed(0)}`} />
                    <Row label="Total" value={`₹${(cartTotal + cartTax).toFixed(0)}`} bold />
                  </div>

                  <button onClick={sendKOT} disabled={loading}
                    style={{ width: "100%", marginTop: 14, height: 42, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#f59e0b,#ef4444)", color: "white", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
                    {loading ? "Sending…" : "🍳 Send to Kitchen (KOT)"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ KITCHEN / KOT TAB ══════════════════ */}
      {tab === "kot" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {kots.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "var(--text-ghost)" }}>
                <ChefHat size={36} style={{ marginBottom: 10, opacity: 0.4 }} />
                <div>No active orders in kitchen</div>
              </div>
            )}
            {kots.map(kot => (
              <div key={kot.id} style={{ ...CARD, borderLeft: `4px solid ${KOT_COLOR[kot.status] || "#6366f1"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{kot.kotNumber}</div>
                    <div style={{ fontSize: 12, color: "var(--text-ghost)", marginTop: 2 }}>
                      {kot.table ? `Table ${kot.table.tableNumber}` : kot.orderType.replace("_", " ")}
                      {kot.customerName ? ` • ${kot.customerName}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: `${KOT_COLOR[kot.status]}22`, color: KOT_COLOR[kot.status] }}>{kot.status}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-ghost)" }}>
                      <Clock size={11} />
                      {new Date(kot.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  {kot.items.map((it: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-sec)", padding: "2px 0" }}>
                      <span>{it.quantity}× {it.itemName}</span>
                      <span style={{ color: "var(--text-ghost)" }}>₹{(it.price * it.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <span style={{ fontWeight: 700, color: "#6366f1" }}>₹{Number(kot.total).toFixed(0)}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {kot.status === "PENDING" && (
                      <button onClick={() => updateKOTStatus(kot.id, "PREPARING")}
                        style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: "#6366f1", color: "white", fontSize: 12, cursor: "pointer" }}>
                        Start
                      </button>
                    )}
                    {kot.status === "PREPARING" && (
                      <button onClick={() => updateKOTStatus(kot.id, "READY")}
                        style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: "#10b981", color: "white", fontSize: 12, cursor: "pointer" }}>
                        Ready
                      </button>
                    )}
                    {(kot.status === "READY" || kot.status === "PREPARING") && (
                      <button onClick={() => { setBillKot(kot); setShowBillModal(true); }}
                        style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: "#f59e0b", color: "white", fontSize: 12, cursor: "pointer" }}>
                        Bill
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════ MENU TAB ══════════════════ */}
      {tab === "menu" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={() => setShowCategoryModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", fontSize: 13, color: "var(--text-sec)" }}>
              <Tag size={14} /> Add Category
            </button>
            <button onClick={() => { setEditingItem(null); setShowMenuModal(true); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", cursor: "pointer", fontSize: 13, color: "white", fontWeight: 600 }}>
              <Plus size={14} /> Add Menu Item
            </button>
          </div>
          {categories.map(cat => {
            const catItems = menuItems.filter(i => i.categoryId === cat.id);
            return (
              <div key={cat.id} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <Tag size={14} color="#6366f1" /> {cat.name}
                  <span style={{ fontSize: 12, color: "var(--text-ghost)", fontWeight: 400 }}>({catItems.length} items)</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                  {catItems.map(item => (
                    <div key={item.id} style={{ ...CARD, opacity: item.isAvailable ? 1 : 0.55 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                            {item.foodType === "VEG" ? <Leaf size={11} color="#10b981" /> : <Drumstick size={11} color="#ef4444" />}
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.name}</span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#6366f1" }}>₹{Number(item.price).toFixed(0)}</div>
                        </div>
                        <button onClick={() => { setEditingItem(item); setMenuForm({ name: item.name, categoryId: item.categoryId, price: String(item.price), costPrice: "0", foodType: item.foodType, description: item.description || "", taxRate: "5", preparationTime: "" }); setShowMenuModal(true); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)", padding: 4 }}><Edit2 size={13} /></button>
                      </div>
                      {item.description && <div style={{ fontSize: 12, color: "var(--text-ghost)", marginTop: 4, lineHeight: 1.4 }}>{item.description}</div>}
                    </div>
                  ))}
                  {!catItems.length && <div style={{ fontSize: 13, color: "var(--text-ghost)", padding: "8px 0" }}>No items yet</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════ TABLES TAB ══════════════════ */}
      {tab === "tables" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button onClick={() => setShowTableModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", cursor: "pointer", fontSize: 13, color: "white", fontWeight: 600 }}>
              <Plus size={14} /> Add Table
            </button>
          </div>
          {/* Group by section */}
          {Array.from(new Set(tables.map(t => t.section || "Main"))).map(section => {
            const secTables = tables.filter(t => (t.section || "Main") === section);
            return (
              <div key={section} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  {section}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                  {secTables.map(t => (
                    <div key={t.id} style={{ ...CARD, textAlign: "center", borderTop: `3px solid ${STATUS_COLOR[t.status] || "#6366f1"}` }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: STATUS_COLOR[t.status], marginBottom: 4 }}>T{t.tableNumber}</div>
                      <div style={{ fontSize: 12, color: "var(--text-ghost)", marginBottom: 6 }}>Seats {t.capacity}</div>
                      <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: `${STATUS_COLOR[t.status]}22`, color: STATUS_COLOR[t.status], fontSize: 11, fontWeight: 700 }}>
                        {t.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {!tables.length && <div style={{ textAlign: "center", padding: 50, color: "var(--text-ghost)" }}><Table2 size={36} style={{ opacity: 0.3, marginBottom: 10 }} /><div>No tables added yet</div></div>}
        </div>
      )}

      {/* ══════════════════ MODALS ══════════════════ */}

      {/* Bill Modal */}
      {showBillModal && billKot && (
        <Modal title={`Generate Bill — ${billKot.kotNumber}`} onClose={() => { setShowBillModal(false); setBillKot(null); }}>
          <Row label="Subtotal" value={`₹${Number(billKot.subtotal).toFixed(0)}`} />
          <Row label="Tax"      value={`₹${Number(billKot.taxAmount).toFixed(0)}`} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <label style={{ fontSize: 13, color: "var(--text-sec)", minWidth: 70 }}>Discount ₹</label>
            <input value={discount} onChange={e => setDiscount(e.target.value)} type="number" min="0"
              style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-hover)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <label style={{ fontSize: 13, color: "var(--text-sec)", minWidth: 70 }}>Payment</label>
            <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
              style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-hover)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
              {["CASH", "CARD", "UPI", "WALLET"].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <Row label="Final Total" value={`₹${(Number(billKot.total) - parseFloat(discount || "0")).toFixed(0)}`} bold style={{ marginTop: 12 }} />
          <button onClick={generateBill} disabled={loading}
            style={{ width: "100%", marginTop: 14, height: 40, borderRadius: 9, border: "none", background: "linear-gradient(135deg,#10b981,#059669)", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {loading ? "Processing…" : "✓ Confirm Payment"}
          </button>
        </Modal>
      )}

      {/* Table Modal */}
      {showTableModal && (
        <Modal title="Add Table" onClose={() => setShowTableModal(false)}>
          <FormField label="Table Number *">
            <input value={tableForm.tableNumber} onChange={e => setTableForm(f => ({ ...f, tableNumber: e.target.value }))} placeholder="e.g. 1, A1, T01"
              style={INPUT_STYLE} />
          </FormField>
          <FormField label="Section">
            <input value={tableForm.section} onChange={e => setTableForm(f => ({ ...f, section: e.target.value }))} placeholder="Indoor / Outdoor / VIP"
              style={INPUT_STYLE} />
          </FormField>
          <FormField label="Capacity (seats)">
            <input value={tableForm.capacity} onChange={e => setTableForm(f => ({ ...f, capacity: e.target.value }))} type="number" min="1"
              style={INPUT_STYLE} />
          </FormField>
          <button onClick={saveTable} disabled={loading} style={BTN_PRIMARY}>{loading ? "Saving…" : "Add Table"}</button>
        </Modal>
      )}

      {/* Menu Item Modal */}
      {showMenuModal && (
        <Modal title={editingItem ? "Edit Menu Item" : "Add Menu Item"} onClose={() => { setShowMenuModal(false); setEditingItem(null); }}>
          <FormField label="Name *">
            <input value={menuForm.name} onChange={e => setMenuForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Item name" style={INPUT_STYLE} />
          </FormField>
          <FormField label="Category *">
            <select value={menuForm.categoryId} onChange={e => setMenuForm((f: any) => ({ ...f, categoryId: e.target.value }))} style={INPUT_STYLE}>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <div className="grid-r2" style={{ gap: 10 }}>
            <FormField label="Price (₹) *">
              <input value={menuForm.price} onChange={e => setMenuForm((f: any) => ({ ...f, price: e.target.value }))} type="number" min="0" placeholder="0" style={INPUT_STYLE} />
            </FormField>
            <FormField label="Cost Price (₹)">
              <input value={menuForm.costPrice} onChange={e => setMenuForm((f: any) => ({ ...f, costPrice: e.target.value }))} type="number" min="0" placeholder="0" style={INPUT_STYLE} />
            </FormField>
          </div>
          <FormField label="Food Type">
            <select value={menuForm.foodType} onChange={e => setMenuForm((f: any) => ({ ...f, foodType: e.target.value }))} style={INPUT_STYLE}>
              <option value="VEG">🟢 Veg</option>
              <option value="NON_VEG">🔴 Non-Veg</option>
              <option value="VEGAN">🌱 Vegan</option>
              <option value="EGG">🥚 Egg</option>
            </select>
          </FormField>
          <FormField label="Description">
            <input value={menuForm.description} onChange={e => setMenuForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Short description" style={INPUT_STYLE} />
          </FormField>
          <button onClick={saveMenuItem} disabled={loading} style={BTN_PRIMARY}>{loading ? "Saving…" : editingItem ? "Update Item" : "Add Item"}</button>
        </Modal>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <Modal title="Add Category" onClose={() => setShowCategoryModal(false)}>
          <FormField label="Category Name *">
            <input value={catForm.name} onChange={e => setCatForm({ name: e.target.value })} placeholder="e.g. Starters, Main Course, Drinks" style={INPUT_STYLE} />
          </FormField>
          <button onClick={saveCategory} disabled={loading} style={BTN_PRIMARY}>{loading ? "Saving…" : "Add Category"}</button>
        </Modal>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{label}</div>
    </div>
  );
}

function Row({ label, value, bold, style: s }: { label: string; value: string; bold?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4, ...s }}>
      <span style={{ color: "var(--text-ghost)" }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 400, color: bold ? "var(--text-primary)" : "var(--text-sec)" }}>{value}</span>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)" }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--border-input)", background: "var(--bg-hover)",
  color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};
const BTN_PRIMARY: React.CSSProperties = {
  width: "100%", marginTop: 4, height: 40, borderRadius: 9, border: "none",
  background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white",
  fontSize: 14, fontWeight: 600, cursor: "pointer",
};
