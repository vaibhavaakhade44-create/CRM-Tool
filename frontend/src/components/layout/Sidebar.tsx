import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Settings, ChevronDown, Building2,
  Users, Package, ShoppingCart, Truck, Receipt,
  ShoppingBag, Warehouse, UserCheck, Kanban,
  Megaphone, Headphones, Globe, BarChart3, Container, Shirt,
  LayoutGrid, PackageOpen, Mail, Calendar, Briefcase, FileText, ShieldCheck, RefreshCw, IndianRupee, Layers, Copy, Stamp, PiggyBank, Cog, DollarSign, Landmark, Webhook,
  MonitorCheck, ClipboardList, ClipboardCheck, UserCog, KanbanSquare, Zap, CalendarClock, MessageCircle, ShieldAlert,
  Phone, TrendingUp, Heart, Sliders, Palette, Scale,
  UtensilsCrossed, Hotel, FolderKanban, UsersRound, Car,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { getNavModules } from "@/lib/modules";
import { isWBAOrg } from "@/lib/org";
import type { OrganizationSummary } from "@/types";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const ICON_MAP: Record<string, React.ElementType> = {
  Users, Package, ShoppingCart, Truck, Receipt,
  ShoppingBag, Warehouse, UserCheck, Kanban,
  Megaphone, Headphones, Globe, BarChart3, Container, Shirt,
  PackageOpen,
  HeadphonesIcon: Headphones,
  UtensilsCrossed, Hotel,
  Phone, TrendingUp, Heart, Briefcase,
  ClipboardCheck, ShieldCheck, Car,
};

const MOD_I18N_KEY: Record<string, string> = {
  CRM: "mod_crm",
  INVENTORY: "mod_inventory",
  PURCHASE: "mod_purchase",
  STORE: "mod_store",
  DISPATCH: "mod_dispatch",
  ACCOUNTS: "mod_accounts",
  POS: "mod_pos",
  WAREHOUSE: "mod_warehouse",
  HR: "mod_hr",
  PROJECTS: "mod_projects",
  MARKETING: "mod_marketing",
  SUPPORT: "mod_support",
  ECOMMERCE: "mod_ecommerce",
  REPORTS: "mod_reports",
  IMPORT_EXPORT_SUITE: "mod_import_export",
  RETAIL_FASHION: "mod_retail",
  TELECALLING: "mod_telecalling",
  SERVICES: "mod_services",
  STOCK_MARKET: "mod_stock_market",
  HEALTH: "mod_health",
  RESTAURANT: "mod_restaurant",
  HOTEL: "mod_hotel",
};

interface FlyoutLink { href: string; label: string; Icon: React.ElementType }

/* ── Rail icon button ─────────────────────────────────────────── */
function RailButton({
  active, onClick, title, children, asDiv,
}: { active?: boolean; onClick?: () => void; title: string; children: React.ReactNode; asDiv?: boolean }) {
  const Comp: any = asDiv ? "div" : "button";
  return (
    <Comp
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer relative",
        active ? "text-[var(--sb-accent)]" : "text-[var(--sb-text-dim)] hover:text-[var(--sb-text)]"
      )}
      style={{
        width: 40, height: 40, flexShrink: 0,
        background: active ? "var(--sb-active)" : "transparent",
        border: active ? "1px solid var(--brand-border)" : "1px solid transparent",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--sb-hover)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {children}
    </Comp>
  );
}

/* ── Flyout panel — fixed, anchored to the right of the rail ────── */
function Flyout({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed", top: 0, bottom: 0, left: "var(--rail-w)", width: 236, zIndex: 45,
        background: "var(--sb-bg-raise)", borderRight: "1px solid var(--sb-border)",
        boxShadow: "16px 0 40px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column",
      }}
    >
      <div className="flex items-center justify-between flex-shrink-0" style={{ height: 54, padding: "0 16px", borderBottom: "1px solid var(--sb-border)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--sb-text)" }}>{title}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--sb-text-ghost)", cursor: "pointer", padding: 4 }}>
          <ChevronDown className="w-4 h-4 -rotate-90" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ padding: 10 }}>
        {children}
      </div>
    </div>
  );
}

function FlyoutLinkRow({ href, label, Icon, onClick, end }: FlyoutLink & { onClick: () => void; end?: boolean }) {
  return (
    <NavLink
      to={href}
      end={end}
      onClick={onClick}
      className={({ isActive }) => cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150",
        isActive ? "bg-brand-500/15 text-[var(--sb-accent)] border border-brand-400/25" : "nav-link-inactive"
      )}
    >
      <Icon style={{ width: 15, height: 15, flexShrink: 0 }} />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

/* ── Org switcher — rail avatar + flyout ─────────────────────────── */
function OrgSwitcherRail({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { organizations, activeOrg, setActiveOrg } = useAuthStore();
  const isOrgAdmin = activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";
  // White Band Associates is a single fixed org — no spinning up more from here
  const canAddOrg = isOrgAdmin && !isWBAOrg(activeOrg);
  const { t } = useTranslation();
  if (!activeOrg) return null;

  return (
    <>
      <RailButton active={open} onClick={onToggle} title={activeOrg.name}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
          style={{ background: "linear-gradient(135deg,var(--sb-accent),#2e9cc4)" }}>
          {getInitials(activeOrg.name)}
        </div>
      </RailButton>

      {open && (
        <Flyout title="Organization" onClose={onClose}>
          <p className="px-2 mb-2 truncate" style={{ fontSize: 12, fontWeight: 700, color: "var(--sb-text)" }}>{activeOrg.name}</p>
          {organizations.map((org: OrganizationSummary) => (
            <button
              key={org.id}
              onClick={() => { setActiveOrg(org); onClose(); }}
              className={cn("w-full flex items-center gap-3 px-3 py-2 transition-colors cursor-pointer rounded-lg", activeOrg.id === org.id ? "bg-brand-500/15" : "hover:bg-[var(--sb-hover)]")}
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                style={{ background: "linear-gradient(135deg,var(--sb-accent),#2e9cc4)" }}>
                {getInitials(org.name)}
              </div>
              <div className="flex-1 text-left overflow-hidden min-w-0">
                <p className="text-xs truncate font-medium" style={{ color: "var(--sb-text)" }}>{org.name}</p>
                <p className="text-[10px]" style={{ color: "var(--sb-text-ghost)" }}>{org.role}</p>
              </div>
              {activeOrg.id === org.id && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--sb-accent)" }} />}
            </button>
          ))}
          {canAddOrg && (
            <div style={{ borderTop: "1px solid var(--sb-border)" }} className="mt-1 pt-1">
              <NavLink
                to="/create-org"
                onClick={onClose}
                className="w-full flex items-center gap-3 px-3 py-2 transition-colors"
                style={{ color: "var(--sb-accent)" }}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{t("nav_add_org")}</span>
              </NavLink>
            </div>
          )}
        </Flyout>
      )}
    </>
  );
}

interface SidebarProps { open?: boolean; onClose?: () => void; }

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const { moduleAccess, activeOrg, employeeProfile } = useAuthStore();
  const isOrgAdmin = activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";
  const navModules = getNavModules(moduleAccess);
  const { t } = useTranslation();
  const location = useLocation();

  const [flyout, setFlyout] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setFlyout(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close any open flyout on route change (and close mobile sidebar)
  useEffect(() => { setFlyout(null); }, [location.pathname]);

  const toggleFlyout = (key: string) => setFlyout(f => (f === key ? null : key));
  const closeAll = () => { setFlyout(null); onClose?.(); };

  // moduleAccess already equals enabledModules for OWNER/ADMIN (seeded by
  // syncModulesFromOrg) — an isOrgAdmin bypass here would show nav for
  // modules the org never enabled at all, not just skip per-user grants.
  const canSee = (key: string) => moduleAccess.includes(key);

  // Employee-level functional roles from HR profile
  const orgRole = employeeProfile?.orgRole ?? null; // PROJECT_MANAGER | TEAM_LEAD | HR | MANAGEMENT | EMPLOYEE
  const isPM   = orgRole === "PROJECT_MANAGER";
  const isTL   = orgRole === "TEAM_LEAD";

  // White Band Associates hides PM Dashboard, Communication, Finance & Tax and Admin & Tools for every login
  const wbaOrg = isWBAOrg(activeOrg);

  const showIT       = canSee("PROJECTS");
  const showSales    = canSee("DISPATCH") || canSee("CRM") || canSee("MARKETING");
  const showFinance  = canSee("ACCOUNTS") && !wbaOrg;
  const showAdmin    = isOrgAdmin && !wbaOrg; // org management, not module-gated
  const showComm     = (canSee("CRM") || canSee("MARKETING")) && !wbaOrg;
  const showPMDash   = (canSee("PROJECTS") || isPM) && !wbaOrg;
  const showTeamPage = isTL;

  const commLinks: FlyoutLink[] = [
    { href: "/email",        label: t("nav_email"),        Icon: Mail },
    { href: "/activities",   label: t("nav_activities"),   Icon: Calendar },
    { href: "/appointments", label: t("nav_appointments"), Icon: CalendarClock },
    { href: "/automations",  label: t("nav_automations"),  Icon: Zap },
    { href: "/whatsapp",     label: t("nav_whatsapp"),     Icon: MessageCircle },
    { href: "/lead-forms",   label: t("nav_lead_forms"),   Icon: FileText },
  ];
  const itLinks: FlyoutLink[] = [
    { href: "/it-projects",    label: t("nav_it_projects"),    Icon: MonitorCheck },
    { href: "/sprint-board",   label: t("nav_sprint_board"),   Icon: KanbanSquare },
    { href: "/bugs",           label: t("nav_bug_tracker"),    Icon: ShieldAlert },
    { href: "/time-tracking",  label: t("nav_time_tracking"),  Icon: ClipboardList },
    { href: "/my-work",        label: t("nav_my_work"),        Icon: ClipboardList },
    { href: "/team-dashboard", label: t("nav_team_dashboard"), Icon: UserCog },
  ];
  const salesLinks: FlyoutLink[] = [
    { href: "/deals",      label: t("nav_deals"),      Icon: Briefcase },
    { href: "/quotations", label: t("nav_quotations"), Icon: FileText },
    { href: "/recurring",  label: t("nav_recurring"),  Icon: RefreshCw },
    { href: "/batches",    label: t("nav_batch"),      Icon: Layers },
    { href: "/bom",        label: t("nav_bom"),        Icon: Cog },
  ];
  const financeLinks: FlyoutLink[] = [
    { href: "/gst",            label: t("nav_gst"),            Icon: IndianRupee },
    { href: "/einvoice",       label: t("nav_einvoice"),       Icon: Stamp },
    { href: "/ewaybill",       label: t("nav_ewaybill"),       Icon: Truck },
    { href: "/tds",            label: t("nav_tds"),            Icon: Receipt },
    { href: "/budgets",        label: t("nav_budgets"),        Icon: PiggyBank },
    { href: "/reconciliation", label: t("nav_reconciliation"), Icon: Landmark },
    { href: "/duplicates",     label: t("nav_duplicates"),     Icon: Copy },
  ];
  const adminLinks: FlyoutLink[] = [
    { href: "/admin/dashboard", label: t("nav_admin"),         Icon: LayoutGrid },
    { href: "/audit",           label: t("nav_audit"),         Icon: ShieldCheck },
    { href: "/currency",        label: t("nav_currency"),      Icon: DollarSign },
    { href: "/webhooks",        label: t("nav_webhooks"),      Icon: Webhook },
    { href: "/security",        label: t("nav_security"),      Icon: ShieldAlert },
    { href: "/custom-fields",   label: t("nav_custom_fields"), Icon: Sliders },
    { href: "/branding",        label: t("nav_branding"),      Icon: Palette },
    { href: "/compliance",      label: t("nav_compliance"),    Icon: Scale },
  ];

  const isPathActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + "/");
  const isGroupActive = (links: FlyoutLink[]) => links.some(l => isPathActive(l.href));
  const isModulesActive = navModules.some(m => isPathActive(m.href));

  const railLinkClass = (active: boolean) => cn(
    "flex items-center justify-center rounded-xl transition-all duration-150",
    active ? "bg-brand-500/15 text-[var(--sb-accent)] border border-brand-400/25" : "nav-mod-inactive"
  );

  return (
    <aside
      ref={railRef}
      className={`app-sidebar flex flex-shrink-0${open ? " sidebar-open" : ""}`}
      style={{ width: "var(--rail-w)", height: "100vh", background: "var(--sb-bg)", borderRight: "1px solid var(--sb-border)", position: "relative" }}
    >
      <div className="flex flex-col items-center h-full" style={{ width: "var(--rail-w)" }}>
        {/* Logo */}
        <div className="flex items-center justify-center flex-shrink-0" style={{ height: 54, width: "100%", borderBottom: "1px solid var(--sb-border)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-lg"
            style={{ background: "linear-gradient(135deg,var(--sb-accent),#2e9cc4)" }}>
            BO
          </div>
        </div>

        {/* Org switcher */}
        <div className="flex-shrink-0" style={{ padding: "10px 0 6px" }}>
          <OrgSwitcherRail open={flyout === "org"} onToggle={() => toggleFlyout("org")} onClose={() => setFlyout(null)} />
        </div>

        <div style={{ width: 28, height: 1, background: "var(--sb-border)", margin: "2px 0 8px" }} />

        {/* ── Scrollable icon rail ── */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center" style={{ width: "100%", gap: 6, paddingBottom: 8 }}>

          <NavLink to="/dashboard" end onClick={closeAll} className={({ isActive }) => railLinkClass(isActive)} style={{ width: 40, height: 40 }} title={t("nav_dashboard")}>
            <LayoutDashboard style={{ width: 18, height: 18 }} />
          </NavLink>

          {navModules.length > 0 && (
            <RailButton active={flyout === "modules" || isModulesActive} onClick={() => toggleFlyout("modules")} title={t("nav_modules")}>
              <LayoutGrid style={{ width: 18, height: 18 }} />
            </RailButton>
          )}

          {showComm && (
            <RailButton active={flyout === "comm" || isGroupActive(commLinks)} onClick={() => toggleFlyout("comm")} title={t("nav_communication")}>
              <MessageCircle style={{ width: 18, height: 18 }} />
            </RailButton>
          )}

          {showPMDash && (
            <NavLink to="/pm-dashboard" onClick={closeAll} className={({ isActive }) => railLinkClass(isActive)} style={{ width: 40, height: 40 }} title="PM Dashboard">
              <FolderKanban style={{ width: 18, height: 18 }} />
            </NavLink>
          )}

          {showTeamPage && (
            <NavLink to="/team" onClick={closeAll} className={({ isActive }) => railLinkClass(isActive)} style={{ width: 40, height: 40 }} title="My Team">
              <UsersRound style={{ width: 18, height: 18 }} />
            </NavLink>
          )}

          {showIT && (
            <RailButton active={flyout === "it" || isGroupActive(itLinks)} onClick={() => toggleFlyout("it")} title={t("nav_it_section")}>
              <MonitorCheck style={{ width: 18, height: 18 }} />
            </RailButton>
          )}

          {showSales && (
            <RailButton active={flyout === "sales" || isGroupActive(salesLinks)} onClick={() => toggleFlyout("sales")} title={t("nav_sales_section")}>
              <Briefcase style={{ width: 18, height: 18 }} />
            </RailButton>
          )}

          {showFinance && (
            <RailButton active={flyout === "finance" || isGroupActive(financeLinks)} onClick={() => toggleFlyout("finance")} title={t("nav_finance_section")}>
              <IndianRupee style={{ width: 18, height: 18 }} />
            </RailButton>
          )}

          {showAdmin && (
            <RailButton active={flyout === "admin" || isGroupActive(adminLinks)} onClick={() => toggleFlyout("admin")} title={t("nav_admin_section")}>
              <ShieldCheck style={{ width: 18, height: 18 }} />
            </RailButton>
          )}
        </div>

        {/* ── Fixed bottom: language + settings ── */}
        <div className="flex flex-col items-center flex-shrink-0" style={{ padding: "8px 0", borderTop: "1px solid var(--sb-border)", gap: 6 }}>
          <LanguageSwitcher />
          <NavLink to="/directory" onClick={closeAll} className={({ isActive }) => railLinkClass(isActive)} style={{ width: 40, height: 40 }} title="Company Directory">
            <UsersRound style={{ width: 18, height: 18 }} />
          </NavLink>
          {isOrgAdmin && (
            <NavLink to="/settings" onClick={closeAll} className={({ isActive }) => railLinkClass(isActive)} style={{ width: 40, height: 40 }} title={t("nav_settings")}>
              <Settings style={{ width: 18, height: 18 }} />
            </NavLink>
          )}
        </div>
      </div>

      {/* ── Flyout panels ── */}
      {flyout === "modules" && (
        <Flyout title={t("nav_modules")} onClose={() => setFlyout(null)}>
          <div className="grid-r2" style={{ gap: 4 }}>
            {navModules.map((mod) => {
              const Icon = ICON_MAP[mod.iconName] || Package;
              const i18nKey = MOD_I18N_KEY[mod.key];
              const label = i18nKey ? t(i18nKey) : mod.label;
              return (
                <NavLink
                  key={mod.key}
                  to={mod.href}
                  onClick={closeAll}
                  className={({ isActive }) => cn(
                    "flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-center transition-all duration-150",
                    isActive ? "bg-brand-500/15 text-[var(--sb-accent)] border border-brand-400/25" : "nav-mod-inactive"
                  )}
                  style={{ textDecoration: "none" }}
                >
                  <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                  <span style={{ fontSize: 10.5, fontWeight: 500, lineHeight: 1.2, wordBreak: "break-word" as const }}>{label}</span>
                </NavLink>
              );
            })}
          </div>
        </Flyout>
      )}

      {flyout === "comm" && (
        <Flyout title={t("nav_communication")} onClose={() => setFlyout(null)}>
          <div className="flex flex-col gap-1">
            {commLinks.map(l => <FlyoutLinkRow key={l.href} {...l} onClick={closeAll} />)}
          </div>
        </Flyout>
      )}

      {flyout === "it" && (
        <Flyout title={t("nav_it_section")} onClose={() => setFlyout(null)}>
          <div className="flex flex-col gap-1">
            {itLinks.map(l => <FlyoutLinkRow key={l.href} {...l} onClick={closeAll} />)}
          </div>
        </Flyout>
      )}

      {flyout === "sales" && (
        <Flyout title={t("nav_sales_section")} onClose={() => setFlyout(null)}>
          <div className="flex flex-col gap-1">
            {salesLinks.map(l => <FlyoutLinkRow key={l.href} {...l} onClick={closeAll} />)}
          </div>
        </Flyout>
      )}

      {flyout === "finance" && (
        <Flyout title={t("nav_finance_section")} onClose={() => setFlyout(null)}>
          <div className="flex flex-col gap-1">
            {financeLinks.map(l => <FlyoutLinkRow key={l.href} {...l} onClick={closeAll} />)}
          </div>
        </Flyout>
      )}

      {flyout === "admin" && (
        <Flyout title={t("nav_admin_section")} onClose={() => setFlyout(null)}>
          <div className="flex flex-col gap-1">
            {adminLinks.map(l => <FlyoutLinkRow key={l.href} {...l} onClick={closeAll} />)}
          </div>
        </Flyout>
      )}
    </aside>
  );
}
