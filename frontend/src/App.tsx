import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import AdminLayout from "@/components/layout/AdminLayout";
import AccessGate from "@/components/AccessGate";
import RoleGate from "@/components/RoleGate";
import LoginPage from "@/pages/auth/LoginPage";
import CreateOrgPage from "@/pages/auth/CreateOrgPage";
import AcceptInvitePage from "@/pages/auth/AcceptInvitePage";
import VerifyEmailPage from "@/pages/auth/VerifyEmailPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import CrmPage from "@/pages/crm/CrmPage";
import PartyDetailPage from "@/pages/crm/PartyDetailPage";
import DuplicatesPage from "@/pages/crm/DuplicatesPage";
import InventoryPage from "@/pages/inventory/InventoryPage";
import PurchasePage from "@/pages/purchase/PurchasePage";
import SalesPage from "@/pages/sales/SalesPage";
import FinancePage from "@/pages/finance/FinancePage";
import HRPage from "@/pages/hr/HRPage";
import ProjectsPage from "@/pages/projects/ProjectsPage";
import LeadsPage from "@/pages/leads/LeadsPage";
import AppointmentsPage from "@/pages/leads/AppointmentsPage";
import AutomationPage from "@/pages/leads/AutomationPage";
import LeadFormsPage from "@/pages/leads/LeadFormsPage";
import WhatsAppPage from "@/pages/whatsapp/WhatsAppPage";
import LeadCaptureFormPage from "@/pages/public/LeadCaptureFormPage";
import SupportPage from "@/pages/support/SupportPage";
import TradePage from "@/pages/trade/TradePage";
import RetailPage from "@/pages/retail/RetailPage";
import WarehousePage from "@/pages/warehouse/WarehousePage";
import StorePage from "@/pages/store/StorePage";
import ReportsPage from "@/pages/reports/ReportsPage";
import GSTReportsPage from "@/pages/gst/GSTReportsPage";
import EInvoicePage from "@/pages/gst/EInvoicePage";
import EWayBillPage from "@/pages/gst/EWayBillPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminTeamPage from "@/pages/admin/AdminTeamPage";
import AdminAccessPage from "@/pages/admin/AdminAccessPage";
import DirectoryPage from "@/pages/directory/DirectoryPage";
import AdminModulesPage from "@/pages/admin/AdminModulesPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import AdminLogsPage from "@/pages/admin/AdminLogsPage";
import SuperAdminLayout from "@/pages/superAdmin/SuperAdminLayout";
import SuperAdminDashboard from "@/pages/superAdmin/SuperAdminDashboard";
import SuperAdminOrgsPage from "@/pages/superAdmin/SuperAdminOrgsPage";
import SuperAdminUsersPage from "@/pages/superAdmin/SuperAdminUsersPage";
import SuperAdminModuleRequestsPage from "@/pages/superAdmin/SuperAdminModuleRequestsPage";
import AccessRequestsPage from "@/pages/superAdmin/AccessRequestsPage";
import SuperAdminLoginPage from "@/pages/superAdmin/SuperAdminLoginPage";
import ComingSoonPage from "@/pages/ComingSoonPage";
import NotFoundPage from "@/pages/NotFoundPage";
import EmailPage from "@/pages/email/EmailPage";
import ActivitiesPage from "@/pages/activities/ActivitiesPage";
import DealsPage from "@/pages/deals/DealsPage";
import QuotationsPage from "@/pages/quotations/QuotationsPage";
import RecurringInvoicesPage from "@/pages/recurring/RecurringInvoicesPage";
import DocumentsPage from "@/pages/documents/DocumentsPage";
import AuditPage from "@/pages/audit/AuditPage";
import ApprovalQueuePage from "@/pages/admin/ApprovalQueuePage";
import BatchTrackingPage from "@/pages/inventory/BatchTrackingPage";
import BOMPage from "@/pages/inventory/BOMPage";
import TDSPage from "@/pages/finance/TDSPage";
import BudgetPage from "@/pages/finance/BudgetPage";
import ReconciliationPage from "@/pages/finance/ReconciliationPage";
import WebhooksPage from "@/pages/settings/WebhooksPage";
import SecurityPage from "@/pages/settings/SecurityPage";
import ITProjectsPage from "@/pages/projects/ITProjectsPage";
import SprintBoardPage from "@/pages/projects/SprintBoardPage";
import TeamDashboardPage from "@/pages/hr/TeamDashboardPage";
import MyWorkPage from "@/pages/projects/MyWorkPage";
import PMDashboard from "@/pages/projects/PMDashboard";
import TeamPage from "@/pages/projects/TeamPage";
import BugTrackerPage from "@/pages/projects/BugTrackerPage";
import TimeTrackingPage from "@/pages/projects/TimeTrackingPage";
import TelecallingPage from "@/pages/telecalling/TelecallingPage";
import ServicesPage from "@/pages/services/ServicesPage";
import StockMarketPage from "@/pages/stockmarket/StockMarketPage";
import HealthPage from "@/pages/health/HealthPage";
import PatientPortalPage from "@/pages/health/PatientPortalPage";
import HealthPortalLoginPage from "@/pages/health/HealthPortalLoginPage";
import DoctorDashboardPage from "@/pages/health/DoctorDashboardPage";
import RestaurantPage from "@/pages/restaurant/RestaurantPage";
import HotelPage from "@/pages/hotel/HotelPage";
import WBAPage from "@/pages/wba/WBAPage";
import CarsPage from "@/pages/cars/CarsPage";
import ReceptionistPage from "@/pages/receptionist/ReceptionistPage";
import CurrencyPage from "@/pages/settings/CurrencyPage";
import CustomFieldsPage from "@/pages/settings/CustomFieldsPage";
import BrandingPage from "@/pages/settings/BrandingPage";
import CompliancePage from "@/pages/settings/CompliancePage";
import LandingPage from "@/pages/landing/LandingPage";
import InvoicePortalPage from "@/pages/portal/InvoicePortalPage";
import PublicProjectPage from "@/pages/public/PublicProjectPage";
import { useAuthStore } from "@/stores/authStore";
import { ShortcutsProvider } from "@/contexts/ShortcutsContext";

// Wrap a page with module-level access gate
const G = (moduleKey: string, Page: React.ComponentType) => (
  <AccessGate moduleKey={moduleKey}><Page /></AccessGate>
);

// Wrap a page with BOTH module access gate AND minimum role check
// minRole defaults to "STAFF" (any member with module access can see it)
const GR = (moduleKey: string, minRole: "MANAGER" | "ADMIN" | "OWNER", Page: React.ComponentType) => (
  <AccessGate moduleKey={moduleKey}>
    <RoleGate minRole={minRole}><Page /></RoleGate>
  </AccessGate>
);

// Shows landing page for guests, redirects authenticated users to dashboard
function PublicHome() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <ShortcutsProvider>
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/super-admin/login" element={<SuperAdminLoginPage />} />
        <Route path="/portal/invoice/:token"  element={<InvoicePortalPage />} />
        <Route path="/patient-portal"          element={<PatientPortalPage />} />
        <Route path="/health-portal/login"     element={<HealthPortalLoginPage />} />
        <Route path="/health-portal/doctor"    element={<DoctorDashboardPage />} />
        <Route path="/public/project/:token" element={<PublicProjectPage />} />
        <Route path="/forms/:id"             element={<LeadCaptureFormPage />} />
        <Route path="/login"          element={<LoginPage />} />
        <Route path="/register"       element={<Navigate to="/login" replace />} />
        <Route path="/create-org"     element={<CreateOrgPage />} />
        <Route path="/accept-invite"   element={<AcceptInvitePage />} />
        <Route path="/verify-email"    element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />

        {/* ── Org Admin Panel (OWNER / ADMIN only) ── */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="team"      element={<AdminTeamPage />} />
          <Route path="access"    element={<AdminAccessPage />} />
          <Route path="modules"   element={<AdminModulesPage />} />
          <Route path="settings"   element={<AdminSettingsPage />} />
          <Route path="logs"       element={<AdminLogsPage />} />
          <Route path="approvals"  element={<ApprovalQueuePage />} />
        </Route>

        {/* ── Super Admin (platform owner only) ── */}
        <Route path="/super-admin" element={<SuperAdminLayout />}>
          <Route index element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="dashboard"        element={<SuperAdminDashboard />} />
          <Route path="organizations"    element={<SuperAdminOrgsPage />} />
          <Route path="users"            element={<SuperAdminUsersPage />} />
          <Route path="module-requests"  element={<SuperAdminModuleRequestsPage />} />
          <Route path="access-requests"  element={<AccessRequestsPage />} />
        </Route>

        {/* ── Main App ── */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard"    element={<DashboardPage />} />

          {/* ── Core (gated by module key) ── */}
          <Route path="/crm"          element={G("CRM", CrmPage)} />
          <Route path="/crm/:id"      element={G("CRM", PartyDetailPage)} />
          <Route path="/duplicates"   element={G("CRM", DuplicatesPage)} />
          <Route path="/inventory"    element={G("INVENTORY", InventoryPage)} />
          <Route path="/batches"      element={G("INVENTORY", BatchTrackingPage)} />
          <Route path="/bom"          element={G("INVENTORY", BOMPage)} />
          <Route path="/purchase"     element={G("PURCHASE", PurchasePage)} />
          <Route path="/store"        element={G("STORE", StorePage)} />
          <Route path="/dispatch"     element={G("DISPATCH", SalesPage)} />
          <Route path="/accounts"     element={G("ACCOUNTS", FinancePage)} />
          <Route path="/receptionist" element={G("RECEPTIONIST", ReceptionistPage)} />

          {/* ── Operations ── */}
          <Route path="/pos"          element={G("POS", RetailPage)} />
          <Route path="/warehouse"    element={G("WAREHOUSE", WarehousePage)} />
          <Route path="/hr"           element={GR("HR", "MANAGER", HRPage)} />
          <Route path="/projects"       element={G("PROJECTS", ProjectsPage)} />
          <Route path="/it-projects"   element={G("PROJECTS", ITProjectsPage)} />
          <Route path="/sprint-board"  element={G("PROJECTS", SprintBoardPage)} />
          <Route path="/team-dashboard" element={GR("HR", "MANAGER", TeamDashboardPage)} />
          <Route path="/pm-dashboard"  element={<PMDashboard />} />
          <Route path="/team"          element={<TeamPage />} />
          <Route path="/directory"     element={<DirectoryPage />} />
          <Route path="/my-work"       element={G("PROJECTS", MyWorkPage)} />
          <Route path="/bugs"          element={G("PROJECTS", BugTrackerPage)} />
          <Route path="/time-tracking" element={G("PROJECTS", TimeTrackingPage)} />
          <Route path="/telecalling"   element={<TelecallingPage />} />
          <Route path="/services"      element={<ServicesPage />} />
          <Route path="/stock-market"  element={<StockMarketPage />} />
          <Route path="/health"        element={G("HEALTH", HealthPage)} />

          {/* ── Growth ── */}
          <Route path="/marketing"    element={G("MARKETING", LeadsPage)} />
          <Route path="/support"      element={G("SUPPORT", SupportPage)} />
          <Route path="/ecommerce"    element={<ComingSoonPage title="E-commerce" description="Connect Shopify, WooCommerce and sync online orders automatically." />} />
          <Route path="/reports"      element={G("REPORTS", ReportsPage)} />
          <Route path="/gst"          element={G("REPORTS", GSTReportsPage)} />
          <Route path="/einvoice"     element={G("ACCOUNTS", EInvoicePage)} />
          <Route path="/ewaybill"     element={G("ACCOUNTS", EWayBillPage)} />
          <Route path="/tds"          element={G("ACCOUNTS", TDSPage)} />
          <Route path="/budgets"         element={G("ACCOUNTS", BudgetPage)} />
          <Route path="/reconciliation" element={G("ACCOUNTS", ReconciliationPage)} />

          {/* ── Industry ── */}
          <Route path="/import-export" element={G("IMPORT_EXPORT_SUITE", TradePage)} />
          <Route path="/retail"        element={G("RETAIL_FASHION", RetailPage)} />
          <Route path="/restaurant"    element={G("RESTAURANT", RestaurantPage)} />
          <Route path="/hotel"         element={G("HOTEL", HotelPage)} />
          <Route path="/wba"          element={G("WBA", WBAPage)} />
          <Route path="/cars"         element={G("CARS", CarsPage)} />

          {/* ── Sales ── */}
          <Route path="/deals"        element={<DealsPage />} />
          <Route path="/quotations"   element={<QuotationsPage />} />
          <Route path="/recurring"    element={<RecurringInvoicesPage />} />

          {/* ── Communication ── */}
          <Route path="/email"        element={<EmailPage />} />
          <Route path="/activities"   element={<ActivitiesPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/automations"  element={<AutomationPage />} />
          <Route path="/whatsapp"     element={<WhatsAppPage />} />
          <Route path="/lead-forms"   element={<LeadFormsPage />} />

          {/* ── Utility (no gate needed) ── */}
          <Route path="/documents"    element={<DocumentsPage />} />
          <Route path="/settings"      element={<SettingsPage />} />
          <Route path="/currency"      element={<CurrencyPage />} />
          <Route path="/webhooks"      element={<WebhooksPage />} />
          <Route path="/security"      element={<SecurityPage />} />
          <Route path="/audit"         element={<AuditPage />} />
          <Route path="/custom-fields" element={<CustomFieldsPage />} />
          <Route path="/branding"      element={<BrandingPage />} />
          <Route path="/compliance"    element={<CompliancePage />} />
        </Route>

        <Route path="/"  element={<PublicHome />} />
        <Route path="*"  element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
    </ShortcutsProvider>
  );
}
