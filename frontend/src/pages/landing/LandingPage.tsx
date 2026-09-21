import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Package, ShoppingCart, Truck, Receipt, UserCheck, TrendingUp,
  Briefcase, FileText, Headphones, Warehouse, ShoppingBag, Kanban,
  Globe, Mail, FileBox, Shield, Smartphone, Layers, MapPin,
  ChevronRight, Phone, UtensilsCrossed, Hotel as HotelIcon, Check, Zap,
  Stethoscope,
} from "lucide-react";
import ContactModal from "@/components/ContactModal";

const MODULES = [
  { Icon: Users,       name: "CRM & Parties",        tag: "Core",          color: "#2e9cc4", desc: "Manage customers, suppliers, contacts and their full communication history in one place.", features: ["Customer & supplier profiles", "Contact management", "Communication log", "Credit limits & payment terms", "GSTIN / PAN / IEC tracking"] },
  { Icon: Package,     name: "Inventory & Stock",     tag: "Core",          color: "#8b5cf6", desc: "Track every SKU, set reorder levels and get instant low-stock alerts before you run out.", features: ["Product catalog with HSN codes", "Real-time stock levels", "Low-stock & out-of-stock alerts", "Category management", "Barcode support"] },
  { Icon: ShoppingCart,name: "Purchase Orders",       tag: "Core",          color: "#10b981", desc: "Raise POs to suppliers, track delivery status and auto-update inventory on receipt.", features: ["PO creation & approval", "Item-level tracking", "Partial receipt support", "Supplier history", "PDF export"] },
  { Icon: Truck,       name: "Sales & Dispatch",      tag: "Core",          color: "#f59e0b", desc: "Process sales orders from confirmation to dispatch with live delivery tracking.", features: ["Sales order management", "Goods outward dispatch", "Vehicle & driver tracking", "Delivery status updates", "Shipping charges"] },
  { Icon: Receipt,     name: "Finance & Invoicing",   tag: "Core",          color: "#ef4444", desc: "GST-compliant invoices, track receivables/payables and print professional invoices instantly.", features: ["GST invoices (CGST/SGST/IGST)", "Receivables & payables", "Payment recording", "Overdue tracking", "Print-ready invoice PDF"] },
  { Icon: UserCheck,   name: "HR & Payroll",          tag: "Core",          color: "#06b6d4", desc: "Full employee lifecycle — onboarding to monthly auto-salary, attendance and leave management.", features: ["Employee profiles & documents", "Attendance tracking", "Auto payroll generation", "PF & ESI auto-calculation", "Leave approvals"] },
  { Icon: TrendingUp,  name: "Leads & Pipeline",      tag: "Growth",        color: "#f97316", desc: "Kanban pipeline to track leads from first contact to closed deal with full activity history.", features: ["Kanban lead board", "Stage-wise tracking", "Lead value & source", "Follow-up reminders", "Conversion analytics"] },
  { Icon: Briefcase,   name: "Deals",                 tag: "Growth",        color: "#a78bfa", desc: "Track high-value deals through stages, forecast revenue and never lose a winning opportunity.", features: ["Deal pipeline stages", "Expected close date", "Deal value tracking", "Activity log per deal", "Win/loss analysis"] },
  { Icon: FileText,    name: "Quotations",            tag: "Growth",        color: "#34d399", desc: "Create professional quotations in seconds, convert them to orders and print or email instantly.", features: ["Multi-item quotations", "GST / discount support", "Valid-until date", "Print & email ready", "Convert to sales order"] },
  { Icon: Headphones,  name: "Support Tickets",       tag: "Growth",        color: "#60a5fa", desc: "Manage customer support requests with priority tracking and SLA-aware resolution.", features: ["Ticket creation & assignment", "Priority levels", "Status tracking", "Customer communication", "Resolution history"] },
  { Icon: Warehouse,   name: "Warehouse",             tag: "Operations",    color: "#fb923c", desc: "Multi-location warehouse with bin-level stock tracking and transfer management.", features: ["Multiple warehouse locations", "Bin / rack management", "Stock transfers", "Inward & outward movements", "Stock take"] },
  { Icon: ShoppingBag, name: "Retail & POS",          tag: "Operations",    color: "#e879f9", desc: "Walk-in sale at the counter — barcode scan, quick billing and daily sales summary.", features: ["Point of sale interface", "Barcode scanning", "Quick checkout", "Daily sales report", "Returns management"] },
  { Icon: Kanban,      name: "Projects & Tasks",      tag: "Operations",    color: "#4ade80", desc: "Plan projects, assign tasks and track milestones — keep every team on schedule.", features: ["Project creation & milestones", "Task assignment & deadlines", "Status tracking", "Team collaboration", "Progress reporting"] },
  { Icon: Globe,       name: "Import-Export Suite",   tag: "Operations",    color: "#38bdf8", desc: "Built for EXIM traders — HS codes, trade documentation, shipping and customs tracking.", features: ["HS code management", "Trade documentation", "Shipping line tracking", "Port of loading/discharge", "Bill of lading management"] },
  { Icon: Mail,        name: "Email & Activities",    tag: "Communication", color: "#facc15", desc: "Send emails to clients, log calls and meetings and keep a full activity timeline.", features: ["Email composition & sending", "Activity logging", "Follow-up scheduling", "Timeline view", "Team visibility"] },
  { Icon: FileBox,        name: "Documents",             tag: "Communication",   color: "#94a3b8", desc: "Upload, organise and share business documents — invoices, contracts, compliance, photos.", features: ["Upload any file type", "Link to party / order / employee", "Cloud storage", "Search by name or tag", "Secure download links"] },
  { Icon: UtensilsCrossed,name: "Restaurant POS",        tag: "Food & Hospitality", color: "#f97316", desc: "Petpooja-style POS — table management, KOT, menu builder, billing and kitchen display for restaurants & cafés.", features: ["Table & section management", "Menu categories with VEG/NON-VEG tags", "Kitchen Order Tickets (KOT)", "Dine-in / Takeaway / Delivery", "5% GST auto-calculation", "Raw material & supplier tracking"] },
  { Icon: HotelIcon,      name: "Hotel / Resort",        tag: "Food & Hospitality", color: "#0ea5e9", desc: "Complete hotel PMS — room management, guest profiles, bookings, check-in/check-out and revenue tracking.", features: ["Room types & floor management", "Guest profiles with ID verification", "Booking with availability check", "Check-in / Check-out workflow", "12% GST on room charges", "Monthly revenue dashboard"] },
  { Icon: Stethoscope,    name: "Health & Clinic",        tag: "Health",             color: "#10b981", desc: "Complete clinic & hospital management — verified doctors, patient records, appointment booking and a public patient portal.", features: ["Doctor registration with govt. document verification", "Patient profiles with auto codes (PT-00001)", "Appointment booking — verified doctors only", "Prescriptions with full medicine details", "Visit history, diagnosis & follow-up notes", "Public patient portal — no login needed"] },
];

const TAGS = ["All", "Core", "Growth", "Operations", "Communication", "Food & Hospitality", "Health"];
const TAG_COLORS: Record<string, string> = {
  Core: "#2e9cc4", Growth: "#10b981", Operations: "#f59e0b", Communication: "#0ea5e9",
  "Food & Hospitality": "#f97316", Health: "#1f7ca0",
};

const WHY = [
  { Icon: MapPin,     title: "Built for Indian Business",  desc: "GSTIN, PAN, IEC, HSN codes, CGST/SGST/IGST — all Indian compliance baked in from day one." },
  { Icon: Layers,     title: "Everything in One Place",    desc: "CRM, inventory, HR, finance, projects — no switching between 6 apps. One login, one dashboard." },
  { Icon: Shield,     title: "Secure & Multi-tenant",      desc: "Each organisation is completely isolated. Role-based access, JWT auth, rate limiting and audit logs." },
  { Icon: Smartphone, title: "Fully Responsive",           desc: "Works on mobile, tablet and desktop. Manage your business from anywhere, any device." },
];

const STEPS = [
  { n: "01", title: "Admin Creates Your Account",    desc: "Your organisation admin creates your user account and invites you to the platform." },
  { n: "02", title: "Enable the Modules You Need",   desc: "Turn on only the features relevant to your business — CRM, HR, inventory or all of them." },
  { n: "03", title: "Start Working",                  desc: "Add parties, products, employees and let BusinessOS handle the calculations, alerts and reports." },
];

export default function LandingPage() {
  const navigate  = useNavigate();
  const [filter, setFilter]           = useState("All");
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);

  const filtered = filter === "All" ? MODULES : MODULES.filter(m => m.tag === filter);

  return (
    <div style={{ background: "var(--bg-main)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}

      {/* ── Navbar ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "color-mix(in srgb, var(--bg-card) 82%, transparent)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid var(--border)", padding: "0 clamp(16px,4vw,64px)", display: "flex", alignItems: "center", height: 64, gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: "linear-gradient(135deg,#2e9cc4,#74cde8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(116,205,232,0.35)" }}>
            <span style={{ color: "white", fontWeight: 800, fontSize: 13, letterSpacing: "-0.5px" }}>BO</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.4px" }}>BusinessOS</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <a href="#features" className="hidden sm:inline-block" style={{ padding: "8px 14px", borderRadius: 8, background: "transparent", border: "none", color: "var(--text-faint)", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
            Features
          </a>
          <span className="hidden sm:inline-block" style={{ width: 1, height: 20, background: "var(--border)", margin: "0 6px" }} />
          <button onClick={() => navigate("/login")} style={{ padding: "8px clamp(10px,3vw,18px)", borderRadius: 8, background: "transparent", border: "1px solid var(--border-input)", color: "var(--text-sec)", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            Login
          </button>
          <button onClick={() => setShowContact(true)} style={{ padding: "8px clamp(10px,3vw,18px)", borderRadius: 8, background: "linear-gradient(135deg,#2e9cc4,#74cde8)", border: "none", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 16px rgba(116,205,232,0.28)", whiteSpace: "nowrap" }}>
            Request Access
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="mesh-bg" style={{ position: "relative", padding: "88px clamp(16px,4vw,64px) 72px", overflow: "hidden" }}>
        <div className="grid-overlay" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        <div className="hero-grid" style={{ position: "relative", maxWidth: 1180, marginInline: "auto" }}>

          {/* ── Left: copy ── */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px 5px 8px", borderRadius: 20, background: "var(--brand-soft)", border: "1px solid var(--brand-border)", fontSize: 12, fontWeight: 600, color: "var(--brand-color)", marginBottom: 26 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-color)", boxShadow: "0 0 0 3px var(--brand-soft)" }} />
              The all-in-one business platform for Indian enterprises
            </div>
            <h1 style={{ fontSize: "clamp(34px,4.6vw,54px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 20px", color: "var(--text-primary)" }}>
              Run your entire business{" "}
              <span className="brand-text-gradient">from one platform</span>
            </h1>
            <p style={{ fontSize: "clamp(15px,1.6vw,17px)", color: "var(--text-faint)", maxWidth: 500, lineHeight: 1.7, marginBottom: 34 }}>
              CRM, Inventory, HR &amp; Payroll, Finance, Projects, Import-Export and more — all integrated, all GST-compliant, built for India.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => setShowContact(true)} style={{ padding: "14px 30px", borderRadius: 10, background: "linear-gradient(135deg,#2e9cc4,#74cde8)", border: "none", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 10px 28px rgba(116,205,232,0.32)" }}>
                Request Access <ChevronRight size={16} />
              </button>
              <button onClick={() => navigate("/login")} style={{ padding: "14px 30px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-input)", color: "var(--text-sec)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Sign In
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 10, marginTop: 52, flexWrap: "wrap" }}>
              {[
                { value: "16+",     label: "Modules" },
                { value: "100%",    label: "GST Compliant" },
                { value: "Multi-org", label: "Support" },
                { value: "Free",    label: "to Start" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "left", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 20px", boxShadow: "0 4px 20px var(--shadow)" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--brand-color)" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: floating product-preview visual (decorative) ── */}
          <div className="hero-visual" style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: "-10%", background: "radial-gradient(50% 50% at 50% 50%, rgba(116,205,232,0.18), transparent 70%)", pointerEvents: "none" }} />

            <div style={{ position: "relative", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 22, boxShadow: "0 40px 90px var(--shadow)", transform: "rotate(-2deg)" }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F87171" }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FBBF24" }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34D399" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-ghost)", fontWeight: 600 }}>Total Revenue</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>₹18.4L</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", background: "rgba(34,197,94,0.12)", padding: "4px 8px", borderRadius: 6 }}>+24%</span>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 64, marginBottom: 20 }}>
                {[38, 60, 48, 76, 58, 92, 70].map((h, i) => (
                  <div key={i} style={{
                    flex: 1, height: `${h}%`, borderRadius: 4,
                    background: i === 5 ? "linear-gradient(180deg,var(--brand-color),#1a6483)" : "var(--bg-hover)",
                  }} />
                ))}
              </div>

              {[
                { label: "Invoices paid", v: "128", c: "#74CDE8" },
                { label: "Open leads", v: "34", c: "#FBBF24" },
                { label: "Active orders", v: "56", c: "#60A5FA" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: row.c }} />
                    <span style={{ fontSize: 12, color: "var(--text-sec)" }}>{row.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{row.v}</span>
                </div>
              ))}
            </div>

            {/* Floating chips for depth */}
            <div style={{
              position: "absolute", top: -16, left: -22, display: "flex", alignItems: "center", gap: 8,
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "9px 14px",
              boxShadow: "0 16px 36px var(--shadow)", transform: "rotate(5deg)", fontSize: 12, fontWeight: 600, color: "var(--text-sec)",
            }}>
              <Check size={14} color="#22C55E" /> GST auto-calculated
            </div>
            <div style={{
              position: "absolute", bottom: -14, right: -18, display: "flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg,#2e9cc4,#74cde8)", borderRadius: 12, padding: "10px 16px",
              boxShadow: "0 16px 36px rgba(116,205,232,0.35)", transform: "rotate(-3deg)", fontSize: 12, fontWeight: 700, color: "#fff",
            }}>
              <Zap size={14} /> 16 modules synced
            </div>
          </div>
        </div>
      </section>

      {/* ── Module Showcase ── */}
      <section id="features" style={{ padding: "0 clamp(16px,4vw,64px) 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(22px,3vw,34px)", fontWeight: 800, margin: "0 0 10px" }}>Everything Your Business Needs</h2>
          <p style={{ color: "var(--text-ghost)", fontSize: 14 }}>Select a module to explore its features</p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
          {TAGS.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: "6px 16px", borderRadius: 6, border: "1px solid",
              borderColor: filter === t ? (TAG_COLORS[t] || "#2e9cc4") : "var(--border-input)",
              background: filter === t ? (TAG_COLORS[t] || "#2e9cc4") + "15" : "transparent",
              color: filter === t ? (TAG_COLORS[t] || "#2e9cc4") : "var(--text-ghost)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>{t}</button>
          ))}
        </div>

        {/* Module grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,280px),1fr))", gap: 14, maxWidth: 1200, marginInline: "auto" }}>
          {filtered.map(mod => {
            const isOpen = expanded === mod.name;
            return (
              <div
                key={mod.name}
                onClick={() => setExpanded(isOpen ? null : mod.name)}
                className="lift"
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${isOpen ? mod.color + "50" : "var(--border)"}`,
                  borderRadius: 14, padding: 18, cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: isOpen ? 12 : 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: mod.color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <mod.Icon size={17} color={mod.color} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{mod.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: (TAG_COLORS[mod.tag] || "#2e9cc4") + "15", color: TAG_COLORS[mod.tag] || "#2e9cc4" }}>{mod.tag}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-faint)", margin: 0, lineHeight: 1.5 }}>{mod.desc}</p>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: `1px solid ${mod.color}25`, paddingTop: 12, marginTop: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: mod.color, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Included features</div>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                      {mod.features.map(f => (
                        <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-sec)" }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: mod.color, flexShrink: 0 }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={e => { e.stopPropagation(); setShowContact(true); }}
                      style={{ marginTop: 14, width: "100%", padding: "9px 0", borderRadius: 7, background: mod.color, border: "none", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      Request Access to {mod.name}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Why BusinessOS ── */}
      <section style={{ padding: "60px clamp(16px,4vw,64px)", background: "var(--bg-card)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,30px)", fontWeight: 800, margin: "0 0 40px" }}>Why BusinessOS?</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,220px),1fr))", gap: 18, maxWidth: 960, marginInline: "auto" }}>
          {WHY.map(w => (
            <div key={w.title} className="lift" style={{ background: "var(--bg-main)", borderRadius: 14, padding: 22, border: "1px solid var(--border)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-soft)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <w.Icon size={17} color="var(--brand-color)" strokeWidth={1.8} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{w.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-faint)", lineHeight: 1.6 }}>{w.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: "60px clamp(16px,4vw,64px)" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px,3vw,30px)", fontWeight: 800, margin: "0 0 48px" }}>Get Running in 3 Steps</h2>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", maxWidth: 860, marginInline: "auto" }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ flex: "1 1 220px", maxWidth: 260, textAlign: "center" }}>
              <div style={{ fontSize: 42, fontWeight: 900, color: "var(--border)", lineHeight: 1, marginBottom: 8 }}>{s.n}</div>
              <div style={{ width: 32, height: 3, background: "#2e9cc4", borderRadius: 2, marginInline: "auto", marginBottom: 14 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-faint)", lineHeight: 1.6 }}>{s.desc}</div>
              {i < STEPS.length - 1 && (
                <div style={{ fontSize: 20, color: "var(--border)", marginTop: 14 }}>↓</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ padding: "60px clamp(16px,4vw,64px)", textAlign: "center", background: "var(--bg-card)", borderTop: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "clamp(22px,3.5vw,36px)", fontWeight: 800, margin: "0 0 14px", color: "var(--text-primary)" }}>
          Ready to streamline your business?
        </h2>
        <p style={{ color: "var(--text-faint)", fontSize: 15, marginBottom: 32 }}>
          Contact us to get your organisation set up and onboard your team.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setShowContact(true)} style={{ padding: "13px 32px", borderRadius: 10, background: "linear-gradient(135deg,#2e9cc4,#74cde8)", border: "none", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 28px rgba(116,205,232,0.28)" }}>
            Request Access
          </button>
          <button onClick={() => navigate("/login")} style={{ padding: "13px 26px", borderRadius: 10, background: "transparent", border: "1px solid var(--border-input)", color: "var(--text-sec)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Sign In
          </button>
        </div>
      </section>

      {/* ── Contact / Support ── */}
      <section style={{ padding: "40px clamp(16px,4vw,64px)", borderTop: "1px solid var(--border)", background: "var(--bg-main)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>Contact &amp; Support</h3>
          <p style={{ fontSize: 13, color: "var(--text-ghost)", marginBottom: 24 }}>Need help? Reach out to us on any of the channels below.</p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
            <a href="tel:9834134470" className="lift" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-sec)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              <Phone size={14} color="var(--brand-color)" /> 98341 34470
            </a>
            <a href="tel:7397962433" className="lift" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-sec)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              <Phone size={14} color="var(--brand-color)" /> 73979 62433
            </a>
            <a href="mailto:hariomvimal33333@gmail.com" className="lift" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-sec)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              <Mail size={14} color="var(--brand-color)" /> hariomvimal33333@gmail.com
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: "24px clamp(16px,4vw,64px)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg,#2e9cc4,#74cde8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontWeight: 800, fontSize: 10 }}>BO</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>BusinessOS</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-ghost)" }}>
          Built for Indian businesses · GST-compliant · Multi-org · Secure
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", color: "var(--text-ghost)", fontSize: 12, cursor: "pointer" }}>Login</button>
        </div>
      </footer>
    </div>
  );
}
