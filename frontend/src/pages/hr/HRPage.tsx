import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Users, Plus, Search, X, Calendar, DollarSign, UserCheck, Check, XCircle, Clock, Target, TrendingUp, Receipt, Briefcase, ChevronRight, Download, Star } from "lucide-react";
import DocumentsPanel from "@/components/DocumentsPanel";
import { kDigits, kDecimal, kAlphaNum, kName, kAlpha, kPhone, kPAN, kIFSC } from "@/lib/fieldRules";
import { useTranslation } from 'react-i18next';
import { useAuthStore } from "@/stores/authStore";
import { isWBAOrg, WBA_DESIGNATIONS, WBA_DEPARTMENTS, WBA_SALARY_TYPES, WBA_LEAVE_TYPES } from "@/lib/org";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const now = new Date();
const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

const S = {
  page:  {} as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-ghost)", marginTop: 2 } as React.CSSProperties,
  btn:   { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
  btnSm: { background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", color: "#818CF8", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 } as React.CSSProperties,
  btnDanger: { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 } as React.CSSProperties,
  btnGreen: { background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 } as React.CSSProperties,
  kpi:   { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" } as React.CSSProperties,
  kpiV:  { fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "4px 0 0" } as React.CSSProperties,
  kpiL:  { fontSize: 12, color: "var(--text-ghost)", fontWeight: 500 } as React.CSSProperties,
  card:  { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 } as React.CSSProperties,
  tabs:  { display: "flex", gap: 4, marginBottom: 24, flexWrap: "wrap" as const } as React.CSSProperties,
  tab:   (a: boolean) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: a ? "rgba(99,102,241,0.15)" : "transparent", color: a ? "#818CF8" : "var(--text-ghost)" }) as React.CSSProperties,
  toolbar: { display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" as const },
  sw:    { position: "relative" as const, flex: 1, maxWidth: 280 },
  si:    { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "8px 12px 8px 34px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  sIcon: { position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)" },
  th:    { textAlign: "left" as const, padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" },
  td:    { padding: "12px 12px", fontSize: 13, color: "var(--text-sec)", borderBottom: "1px solid var(--bg-hover)" },
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  input: { width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" as const },
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5 },
  select:{ width: "100%", background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", colorScheme: "dark" as const, boxSizing: "border-box" as const },
  fSel:  { background: "var(--bg-hover)", border: "1px solid var(--border-input)", borderRadius: 8, padding: "7px 10px", color: "var(--text-primary)", fontSize: 12, outline: "none", colorScheme: "dark" as const },
  empty: { padding: "48px 20px", textAlign: "center" as const, color: "var(--text-ghost)", fontSize: 13 },
  err:   { background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 12, marginBottom: 14 },
};

type Tab = "overview"|"employees"|"attendance"|"payroll"|"leaves"|"performance"|"expenses";

interface Summary { total: number; active: number; onLeave: number; departments: Array<{ department: string | null; _count: number }>; monthSalaryTotal?: number; }
interface Employee { id: string; employeeCode: string; name: string; email?: string; phone?: string; designation?: string; department?: string; employmentType: string; status: string; basicSalary: number; dailyRate?: number; hra: number; allowances: number; salaryType: string; joiningDate: string; shiftId?: string; }
interface AttRecord { id: string; employeeId: string; date: string; status: string; checkIn?: string; checkOut?: string; notes?: string; employee: { id: string; name: string; employeeCode: string }; }
interface Payroll { id: string; employeeId: string; month: number; year: number; basicSalary: number; hra: number; allowances: number; grossSalary: number; pfDeduction: number; esiDeduction: number; deductions: number; netSalary: number; presentDays: number; workingDays: number; isPaid: boolean; paidAt?: string; employee: { id: string; name: string; employeeCode: string; designation?: string; salaryType?: string }; }
interface LeaveReq { id: string; employeeId: string; leaveType: string; fromDate: string; toDate: string; days: number; reason?: string; status: string; employee: { id: string; name: string; employeeCode: string }; }
interface LeaveBalance { id: string; employeeId: string; year: number; leaveType: string; allocated: number; used: number; pending: number; carried: number; employee: { id: string; name: string; employeeCode: string }; }
interface Shift { id: string; name: string; startTime: string; endTime: string; workingHours: number; graceMins: number; isActive: boolean; _count?: { employees: number }; }
interface Goal { id: string; employeeId: string; title: string; description?: string; category: string; targetDate?: string; progress: number; status: string; year: number; quarter?: number; employee: { id: string; name: string; employeeCode: string; designation?: string }; }
interface Review { id: string; employeeId: string; reviewType: string; reviewPeriod: string; rating?: number; selfRating?: number; status: string; strengths?: string; improvements?: string; comments?: string; reviewDate: string; employee: { id: string; name: string; employeeCode: string; designation?: string; department?: string }; }
interface Expense { id: string; employeeId: string; expenseDate: string; category: string; title: string; amount: number; currency: string; receiptUrl?: string; status: string; notes?: string; approvedById?: string; approvedAt?: string; paidAt?: string; employee: { id: string; name: string; employeeCode: string; department?: string }; }

const ATT_COLORS: Record<string,string> = { PRESENT:"#10b981", ABSENT:"#ef4444", HALF_DAY:"#f59e0b", LEAVE:"#6366f1", HOLIDAY:"#8b5cf6" };
const LEAVE_STATUS_C: Record<string,string> = { PENDING:"#f59e0b", APPROVED:"#10b981", REJECTED:"#ef4444", CANCELLED:"var(--text-ghost)" };
const GOAL_STATUS_C: Record<string,string> = { IN_PROGRESS:"#6366f1", COMPLETED:"#10b981", ON_HOLD:"#f59e0b", CANCELLED:"#ef4444" };
const EXP_STATUS_C: Record<string,string> = { PENDING:"#f59e0b", APPROVED:"#10b981", REJECTED:"#ef4444", PAID:"#8b5cf6" };
const LEAVE_TYPES = ["Annual","Sick","Casual","Maternity","Paternity","Compensatory","Unpaid","Other"];
const EXP_CATS = ["Travel","Food","Accommodation","Office Supplies","Client Entertainment","Medical","Training","Fuel","Other"];

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ padding:"2px 8px", borderRadius:5, fontSize:11, fontWeight:600, background:color+"22", color }}>{text.replace(/_/g," ")}</span>;
}
function Stars({ value }: { value?: number }) {
  if (!value) return <span style={{ color:"var(--text-ghost)" }}>—</span>;
  return <span style={{ color:"#f59e0b" }}>{Array.from({length:5},(_,i)=><Star key={i} size={12} fill={i<Math.round(value)?"#f59e0b":"none"} color="#f59e0b"/>)}</span>;
}
function ProgBar({ pct, color="#6366f1" }: { pct: number; color?: string }) {
  return <div style={{ height:6, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
    <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:color, borderRadius:3, transition:"width 0.3s" }}/>
  </div>;
}
const fmt = (n: number) => `₹${n.toLocaleString("en-IN",{maximumFractionDigits:0})}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
const errMsg = (e: unknown) => (e as {response?:{data?:{message?:string}}})?.response?.data?.message || "Failed";

const DESIGNATION_OPTS = [
  "Developer","Senior Developer","Frontend Developer","Backend Developer","Full Stack Developer",
  "Project Manager","Team Lead","Scrum Master","Tech Lead",
  "HR Manager","HR Executive","HR Assistant",
  "Accountant","Senior Accountant","Finance Executive","Finance Manager",
  "Sales Executive","Business Development Manager","Business Analyst",
  "Operations Manager","Admin Executive","Office Manager",
  "UI/UX Designer","QA Engineer","DevOps Engineer",
  "Marketing Executive","Marketing Manager",
  "Director","CEO","CTO","CFO","Other",
];
const ORG_ROLES = [
  { value:"EMPLOYEE",        label:"Employee" },
  { value:"TEAM_LEAD",       label:"Team Lead" },
  { value:"PROJECT_MANAGER", label:"Project Manager" },
  { value:"HR",              label:"HR Manager" },
  { value:"MANAGEMENT",      label:"Management" },
];
// Job roles for a login account — mirrors backend JOB_ROLES; sets default module access
const LOGIN_JOB_ROLES = [
  { value:"MANAGER",         label:"Manager (all modules)" },
  { value:"PROJECT_MANAGER", label:"Project Manager" },
  { value:"ACCOUNTANT",      label:"Accountant" },
  { value:"EXECUTIVE",       label:"Executive / Sales" },
  { value:"HR",              label:"HR" },
  { value:"STAFF",           label:"Staff (no modules yet)" },
  { value:"INTERN",          label:"Intern (no modules yet)" },
];
const loginEmpty = { create:false, email:"", password:"", jobRole:"STAFF" };

const empEmpty = { employeeCode:"", name:"", email:"", phone:"", designation:"", department:"", employmentType:"FULL_TIME", joiningDate:"", salaryType:"MONTHLY", basicSalary:"", dailyRate:"", hra:"0", allowances:"0", pfEnabled:"", esiEnabled:"", orgRole:"EMPLOYEE", bankAccount:"", bankIfsc:"", panNumber:"", pfNumber:"", esiNumber:"", address:"", notes:"" };
const attEmpty = { employeeId:"", date:now.toISOString().slice(0,10), status:"PRESENT", checkIn:"", checkOut:"", notes:"" };
const payEmpty = { employeeId:"", month:String(now.getMonth()+1), year:String(now.getFullYear()), workingDays:"26", presentDays:"", hra:"0", allowances:"0", deductions:"0" };

// HR settings defaults — override from org settings
const HR_DEFAULTS = { defaultWorkingDays: 26, enableHRA: true, enableAllowances: true, enablePF: true, enableESI: true };
const leaveEmpty = { employeeId:"", leaveType:"Annual", fromDate:"", toDate:"", reason:"" };
const shiftEmpty = { name:"", startTime:"09:00", endTime:"18:00", workingHours:"8", graceMins:"0" };
const balanceEmpty = { employeeId:"", year:String(now.getFullYear()), leaveType:"Annual", allocated:"12", carried:"0" };
const goalEmpty = { employeeId:"", title:"", description:"", category:"Individual", targetDate:"", progress:"0", status:"IN_PROGRESS", year:String(now.getFullYear()), quarter:"" };
const reviewEmpty = { employeeId:"", reviewType:"ANNUAL", reviewPeriod:"", rating:"", selfRating:"", status:"DRAFT", strengths:"", improvements:"", comments:"" };
const expenseEmpty = { employeeId:"", expenseDate:now.toISOString().slice(0,10), category:"Travel", title:"", amount:"", receiptUrl:"", notes:"" };

export default function HRPage() {
  const { t } = useTranslation();
  const { activeOrg } = useAuthStore();

  // Role-based access levels within the HR module
  const role = activeOrg?.role ?? "STAFF";
  const isHRManager = role === "OWNER" || role === "ADMIN" || role === "MANAGER";
  const isOrgAdmin = role === "OWNER" || role === "ADMIN";

  // White Band Associates HR customisations: fixed designation/department lists,
  // its own salary types, no HRA/allowance, no payroll, Half-Day leave.
  const wbaOrg = isWBAOrg(activeOrg);
  const designationOpts: string[] = wbaOrg ? [...WBA_DESIGNATIONS] : DESIGNATION_OPTS;
  const leaveTypeOpts: string[] = wbaOrg ? [...WBA_LEAVE_TYPES] : LEAVE_TYPES;

  const [tab, setTab] = useState<Tab>("overview");
  const [summary, setSummary] = useState<Summary|null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Org-level HR settings (loaded once)
  const [orgHR, setOrgHR] = useState({ ...HR_DEFAULTS });

  // Employee
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [empForm, setEmpForm] = useState({...empEmpty});
  const [loginForm, setLoginForm] = useState({...loginEmpty});
  const [showEmpDetail, setShowEmpDetail] = useState(false);
  const [detailEmp, setDetailEmp] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Attendance
  const [attRecords, setAttRecords] = useState<AttRecord[]>([]);
  const [attMonth, setAttMonth] = useState(now.getMonth()+1);
  const [attYear, setAttYear] = useState(now.getFullYear());
  const [attLoading, setAttLoading] = useState(false);
  const [showAttModal, setShowAttModal] = useState(false);
  const [attForm, setAttForm] = useState({...attEmpty});

  // Payroll
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [payMonth, setPayMonth] = useState(now.getMonth()+1);
  const [payYear, setPayYear] = useState(now.getFullYear());
  const [payLoading, setPayLoading] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({...payEmpty});
  const [showAutoPayModal, setShowAutoPayModal] = useState(false);
  const [autoPayForm, setAutoPayForm] = useState({ month:String(now.getMonth()+1), year:String(now.getFullYear()), workingDays:"26" });
  const [autoPayResult, setAutoPayResult] = useState<any>(null);
  const [payslip, setPayslip] = useState<any>(null);
  const [showPayslip, setShowPayslip] = useState(false);

  // Leaves
  const [leaves, setLeaves] = useState<LeaveReq[]>([]);
  const [leaveFilter, setLeaveFilter] = useState("");
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({...leaveEmpty});
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [showLbModal, setShowLbModal] = useState(false);
  const [lbForm, setLbForm] = useState({...balanceEmpty});
  const [leaveSubTab, setLeaveSubTab] = useState<"requests"|"balances">("requests");

  // Shifts
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftForm, setShiftForm] = useState({...shiftEmpty});
  const [editShiftId, setEditShiftId] = useState<string|null>(null);

  // Performance
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [perfSubTab, setPerfSubTab] = useState<"goals"|"reviews">("goals");
  const [perfLoading, setPerfLoading] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({...goalEmpty});
  const [editGoalId, setEditGoalId] = useState<string|null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({...reviewEmpty});
  const [editReviewId, setEditReviewId] = useState<string|null>(null);

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expFilter, setExpFilter] = useState("");
  const [expLoading, setExpLoading] = useState(false);
  const [showExpModal, setShowExpModal] = useState(false);
  const [expForm, setExpForm] = useState({...expenseEmpty});

  // ── Loaders ──
  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, empRes, shiftRes, orgRes] = await Promise.all([
        api.get("/hr/summary"),
        api.get(`/hr?search=${search}&limit=200`),
        api.get("/hr/shifts"),
        api.get("/organizations/current"),
      ]);
      setSummary(sumRes.data.data);
      setEmployees(empRes.data.data.employees || []);
      setShifts(shiftRes.data.data || []);
      const hs = orgRes.data.data?.hrSettings;
      if (hs) {
        const merged = { ...HR_DEFAULTS, ...hs };
        setOrgHR(merged);
        // Seed default working days into both payroll forms
        setPayForm(p => ({ ...p, workingDays: String(merged.defaultWorkingDays) }));
        setAutoPayForm(p => ({ ...p, workingDays: String(merged.defaultWorkingDays) }));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [search]);

  const loadAttendance = useCallback(async () => {
    setAttLoading(true);
    try {
      const r = await api.get(`/hr/attendance?month=${attMonth}&year=${attYear}`);
      setAttRecords(r.data.data || []);
    } catch { /* ignore */ }
    setAttLoading(false);
  }, [attMonth, attYear]);

  const loadPayroll = useCallback(async () => {
    setPayLoading(true);
    try {
      const r = await api.get(`/hr/payroll?month=${payMonth}&year=${payYear}`);
      setPayrolls(r.data.data || []);
    } catch { /* ignore */ }
    setPayLoading(false);
  }, [payMonth, payYear]);

  const loadLeaves = useCallback(async () => {
    setLeaveLoading(true);
    try {
      const r = await api.get(`/hr/leaves${leaveFilter?`?status=${leaveFilter}`:""}`);
      setLeaves(r.data.data || []);
    } catch { /* ignore */ }
    setLeaveLoading(false);
  }, [leaveFilter]);

  const loadLeaveBalances = useCallback(async () => {
    setLbLoading(true);
    try {
      const r = await api.get(`/hr/leave-balances?year=${now.getFullYear()}`);
      setLeaveBalances(r.data.data || []);
    } catch { /* ignore */ }
    setLbLoading(false);
  }, []);

  const loadPerformance = useCallback(async () => {
    setPerfLoading(true);
    try {
      const [gR, rR] = await Promise.all([
        api.get(`/hr/goals?year=${now.getFullYear()}`),
        api.get("/hr/reviews"),
      ]);
      setGoals(gR.data.data || []);
      setReviews(rR.data.data || []);
    } catch { /* ignore */ }
    setPerfLoading(false);
  }, []);

  const loadExpenses = useCallback(async () => {
    setExpLoading(true);
    try {
      const r = await api.get(`/hr/expenses${expFilter?`?status=${expFilter}`:""}`);
      setExpenses(r.data.data || []);
    } catch { /* ignore */ }
    setExpLoading(false);
  }, [expFilter]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { if (tab==="attendance") loadAttendance(); }, [tab, loadAttendance]);
  useEffect(() => { if (tab==="payroll") loadPayroll(); }, [tab, loadPayroll]);
  useEffect(() => { if (tab==="leaves") { loadLeaves(); loadLeaveBalances(); } }, [tab, loadLeaves, loadLeaveBalances]);
  useEffect(() => { if (tab==="performance") loadPerformance(); }, [tab, loadPerformance]);
  useEffect(() => { if (tab==="expenses") loadExpenses(); }, [tab, loadExpenses]);

  // ── Employee CRUD ──
  // Next auto employee code (EMP-####) from the loaded roster — shown as a hint;
  // the backend generates the authoritative code when the field is left blank.
  const nextEmployeeCode = () => {
    let max = 0;
    for (const e of employees) {
      const m = /^EMP-(\d+)$/i.exec((e.employeeCode || "").trim());
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `EMP-${String(max + 1).padStart(4, "0")}`;
  };
  const openAdd = () => { setEditId(null); setEmpForm({...empEmpty, ...(wbaOrg ? { salaryType:"FIXED" } : {})}); setLoginForm({...loginEmpty}); setError(""); setShowEmpModal(true); };
  const openEdit = (e: Employee) => {
    setEditId(e.id);
    setEmpForm({ employeeCode:e.employeeCode, name:e.name, email:"", phone:"", designation:e.designation||"", department:e.department||"", employmentType:e.employmentType, joiningDate:new Date(e.joiningDate).toISOString().slice(0,10), salaryType:e.salaryType||"MONTHLY", basicSalary:String(e.basicSalary), dailyRate:String(e.dailyRate||""), hra:String(e.hra||0), allowances:String(e.allowances||0), pfEnabled:(e as any).pfEnabled!=null?String((e as any).pfEnabled):"", esiEnabled:(e as any).esiEnabled!=null?String((e as any).esiEnabled):"", orgRole:(e as any).orgRole||"EMPLOYEE", bankAccount:"", bankIfsc:"", panNumber:"", pfNumber:"", esiNumber:"", address:"", notes:"" });
    setError(""); setShowEmpModal(true);
  };
  const openDetail = async (emp: Employee) => {
    setShowEmpDetail(true); setDetailEmp(null); setDetailLoading(true);
    try { const r = await api.get(`/hr/${emp.id}`); setDetailEmp(r.data.data); }
    catch { setDetailEmp(emp); }
    setDetailLoading(false);
  };
  const saveEmployee = async () => {
    setSaving(true); setError("");
    try {
      const payload = {
        ...empForm,
        employeeCode: empForm.employeeCode.trim() || undefined, // blank → backend auto-generates EMP-####
        basicSalary:  parseFloat(empForm.basicSalary)||0,
        dailyRate:    empForm.salaryType==="DAILY"?(parseFloat(empForm.dailyRate)||0):undefined,
        hra:          parseFloat(empForm.hra)||0,
        allowances:   parseFloat(empForm.allowances)||0,
        email:        empForm.email||undefined,
        phone:        empForm.phone||undefined,
        pfEnabled:    empForm.pfEnabled===""?undefined:empForm.pfEnabled==="true",
        esiEnabled:   empForm.esiEnabled===""?undefined:empForm.esiEnabled==="true",
        orgRole:      empForm.orgRole||"EMPLOYEE",
      };
      if (editId) {
        await api.patch(`/hr/${editId}`, payload);
      } else {
        const r = await api.post("/hr", payload);
        // Optionally provision a login account for the new employee
        if (isOrgAdmin && loginForm.create) {
          const email = (loginForm.email || empForm.email || "").trim();
          if (!email || !loginForm.password) {
            setError("Login account needs an email and a temporary password.");
            setSaving(false); return;
          }
          await api.post(`/hr/${r.data.data.id}/login`, {
            email, password: loginForm.password, jobRole: loginForm.jobRole,
          });
        }
      }
      setShowEmpModal(false); loadBase();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };

  const terminateEmployee = async (emp: Employee) => {
    if (!confirm(`Terminate ${emp.name}? This will set their status to TERMINATED.`)) return;
    try { await api.delete(`/hr/${emp.id}`); loadBase(); } catch { alert("Failed to terminate employee"); }
  };

  // Salary preview calculation (client-side, mirrors backend logic)
  const salaryPreview = (() => {
    const basic    = parseFloat(empForm.basicSalary)||0;
    const hra      = orgHR.enableHRA ? (parseFloat(empForm.hra)||0) : 0;
    const allow    = orgHR.enableAllowances ? (parseFloat(empForm.allowances)||0) : 0;
    const gross    = basic + hra + allow;
    const usePF    = empForm.pfEnabled===""  ? orgHR.enablePF   : empForm.pfEnabled==="true";
    const useESI   = empForm.esiEnabled==="" ? orgHR.enableESI  : empForm.esiEnabled==="true";
    const pf       = usePF  ? basic * 0.12 : 0;
    const esi      = useESI ? (gross<=21000 ? gross*0.0075 : 0) : 0;
    const net      = gross - pf - esi;
    return { gross, pf, esi, net };
  })();

  // ── Attendance ──
  const saveAttendance = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/hr/attendance", { ...attForm, checkIn:attForm.checkIn||undefined, checkOut:attForm.checkOut||undefined, notes:attForm.notes||undefined });
      setShowAttModal(false); loadAttendance();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };

  // ── Payroll ──
  const savePayroll = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/hr/payroll", { employeeId:payForm.employeeId, month:parseInt(payForm.month), year:parseInt(payForm.year), workingDays:parseInt(payForm.workingDays)||26, presentDays:parseFloat(payForm.presentDays)||0, hra:parseFloat(payForm.hra)||0, allowances:parseFloat(payForm.allowances)||0, deductions:parseFloat(payForm.deductions)||0 });
      setShowPayModal(false); loadPayroll();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };
  const autoGeneratePayroll = async () => {
    setSaving(true); setError(""); setAutoPayResult(null);
    try {
      const r = await api.post("/hr/payroll/auto-generate", { month:parseInt(autoPayForm.month), year:parseInt(autoPayForm.year), workingDays:parseInt(autoPayForm.workingDays)||26 });
      setAutoPayResult(r.data.data); loadPayroll();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };
  const markPaid = async (id: string) => { try { await api.patch(`/hr/payroll/${id}/paid`,{}); loadPayroll(); } catch{} };
  const viewPayslip = async (p: Payroll) => {
    try {
      const r = await api.get(`/hr/payslip?employeeId=${p.employeeId}&month=${p.month}&year=${p.year}`);
      setPayslip(r.data.data); setShowPayslip(true);
    } catch { alert("Payslip not available"); }
  };

  // ── Leaves ──
  const saveLeave = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/hr/leaves", { ...leaveForm, reason:leaveForm.reason||undefined });
      setShowLeaveModal(false); loadLeaves(); loadBase();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };
  const updateLeaveStatus = async (id: string, status: string) => {
    try { await api.patch(`/hr/leaves/${id}/status`, { status }); loadLeaves(); loadBase(); } catch {}
  };
  const saveLeaveBalance = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/hr/leave-balances", { employeeId:lbForm.employeeId, year:parseInt(lbForm.year), leaveType:lbForm.leaveType, allocated:parseFloat(lbForm.allocated)||0, carried:parseFloat(lbForm.carried)||0 });
      setShowLbModal(false); loadLeaveBalances();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };

  // ── Shifts ──
  const saveShift = async () => {
    setSaving(true); setError("");
    try {
      const payload = { name:shiftForm.name, startTime:shiftForm.startTime, endTime:shiftForm.endTime, workingHours:parseFloat(shiftForm.workingHours)||8, graceMins:parseInt(shiftForm.graceMins)||0 };
      if (editShiftId) await api.patch(`/hr/shifts/${editShiftId}`, payload);
      else await api.post("/hr/shifts", payload);
      setShowShiftModal(false); loadBase();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };
  const deleteShift = async (id: string) => {
    if (!confirm("Delete this shift?")) return;
    try { await api.delete(`/hr/shifts/${id}`); loadBase(); } catch {}
  };

  // ── Performance ──
  const saveGoal = async () => {
    setSaving(true); setError("");
    try {
      const payload = { employeeId:goalForm.employeeId, title:goalForm.title, description:goalForm.description||undefined, category:goalForm.category, targetDate:goalForm.targetDate||undefined, progress:parseInt(goalForm.progress)||0, status:goalForm.status, year:parseInt(goalForm.year), quarter:goalForm.quarter?parseInt(goalForm.quarter):undefined };
      if (editGoalId) await api.patch(`/hr/goals/${editGoalId}`, payload);
      else await api.post("/hr/goals", payload);
      setShowGoalModal(false); loadPerformance();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };
  const deleteGoal = async (id: string) => {
    if (!confirm("Delete this goal?")) return;
    try { await api.delete(`/hr/goals/${id}`); loadPerformance(); } catch {}
  };
  const saveReview = async () => {
    setSaving(true); setError("");
    try {
      const payload = { employeeId:reviewForm.employeeId, reviewType:reviewForm.reviewType, reviewPeriod:reviewForm.reviewPeriod, rating:reviewForm.rating?parseFloat(reviewForm.rating):undefined, selfRating:reviewForm.selfRating?parseFloat(reviewForm.selfRating):undefined, status:reviewForm.status, strengths:reviewForm.strengths||undefined, improvements:reviewForm.improvements||undefined, comments:reviewForm.comments||undefined };
      if (editReviewId) await api.patch(`/hr/reviews/${editReviewId}`, payload);
      else await api.post("/hr/reviews", payload);
      setShowReviewModal(false); loadPerformance();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };

  // ── Expenses ──
  const saveExpense = async () => {
    setSaving(true); setError("");
    try {
      await api.post("/hr/expenses", { employeeId:expForm.employeeId, expenseDate:expForm.expenseDate, category:expForm.category, title:expForm.title, amount:parseFloat(expForm.amount)||0, receiptUrl:expForm.receiptUrl||undefined, notes:expForm.notes||undefined });
      setShowExpModal(false); loadExpenses();
    } catch (e) { setError(errMsg(e)); }
    setSaving(false);
  };
  const expAction = async (id: string, action: "approve"|"reject"|"paid") => {
    try { await api.patch(`/hr/expenses/${id}/${action}`,{}); loadExpenses(); } catch {}
  };

  const ef = (k: keyof typeof empEmpty, v: string) => setEmpForm(p=>({...p,[k]:v}));
  const af = (k: keyof typeof attEmpty, v: string) => setAttForm(p=>({...p,[k]:v}));
  const pf = (k: keyof typeof payEmpty, v: string) => setPayForm(p=>({...p,[k]:v}));
  const lf = (k: keyof typeof leaveEmpty, v: string) => setLeaveForm(p=>({...p,[k]:v}));

  // Managers see all tabs; non-managers (STAFF with HR access) only see Leaves + Expenses
  const TABS: Array<{id:Tab;label:string;icon:React.ReactNode}> = [
    ...(isHRManager ? [
      {id:"overview"    as Tab, label:"Overview",    icon:<TrendingUp size={14}/>},
      {id:"employees"   as Tab, label:"Employees",   icon:<Users size={14}/>},
      {id:"attendance"  as Tab, label:"Attendance",  icon:<Calendar size={14}/>},
      // Payroll is disabled for White Band Associates
      ...(wbaOrg ? [] : [{id:"payroll" as Tab, label:"Payroll", icon:<DollarSign size={14}/>}]),
    ] : []),
    {id:"leaves"      as Tab, label:"Leaves",      icon:<Clock size={14}/>},
    // Performance & Expenses are disabled for White Band Associates
    ...(isHRManager && !wbaOrg ? [
      {id:"performance" as Tab, label:"Performance", icon:<Target size={14}/>},
    ] : []),
    ...(wbaOrg ? [] : [{id:"expenses" as Tab, label:"Expenses", icon:<Receipt size={14}/>}]),
  ];

  return (
    <div className="page-pad">
      {/* Header */}
      <div className="page-hdr" style={{marginBottom:20}}>
        <div>
          <h1 style={S.title}>{ t('page_hr') }</h1>
          <p style={S.subtitle}>
            {isHRManager ? t('page_hr_sub') : "View your leaves, expenses and payslip"}
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          {isHRManager && tab==="employees" && <button style={S.btn} onClick={openAdd}><Plus size={15}/> Add Employee</button>}
          {isHRManager && tab==="attendance" && <button style={S.btn} onClick={()=>{setAttForm({...attEmpty});setError("");setShowAttModal(true);}}><Plus size={15}/> Mark Attendance</button>}
          {isHRManager && tab==="payroll" && <button style={S.btn} onClick={()=>{setPayForm({...payEmpty,workingDays:String(orgHR.defaultWorkingDays)});setError("");setShowPayModal(true);}}><Plus size={15}/> Generate Payroll</button>}
          {tab==="leaves" && leaveSubTab==="requests" && <button style={S.btn} onClick={()=>{setLeaveForm({...leaveEmpty});setError("");setShowLeaveModal(true);}}><Plus size={15}/> Apply Leave</button>}
          {isHRManager && tab==="leaves" && leaveSubTab==="balances" && <button style={S.btn} onClick={()=>{setLbForm({...balanceEmpty});setError("");setShowLbModal(true);}}><Plus size={15}/> Allocate Balance</button>}
          {isHRManager && tab==="performance" && perfSubTab==="goals" && <button style={S.btn} onClick={()=>{setEditGoalId(null);setGoalForm({...goalEmpty});setError("");setShowGoalModal(true);}}><Plus size={15}/> Add Goal</button>}
          {isHRManager && tab==="performance" && perfSubTab==="reviews" && <button style={S.btn} onClick={()=>{setEditReviewId(null);setReviewForm({...reviewEmpty});setError("");setShowReviewModal(true);}}><Plus size={15}/> Add Review</button>}
          {tab==="expenses" && <button style={S.btn} onClick={()=>{setExpForm({...expenseEmpty});setError("");setShowExpModal(true);}}><Plus size={15}/> Add Expense</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t=>(
          <button key={t.id} style={{...S.tab(tab===t.id),display:"flex",alignItems:"center",gap:6}} onClick={()=>setTab(t.id)}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ════════════════ OVERVIEW ════════════════ */}
      {isHRManager && tab==="overview" && (
        <div>
          {/* KPI row */}
          <div className="kpi-grid" style={{marginBottom:20}}>
            {[
              {label:"Total Employees",value:summary?.total??0,icon:<Users size={18}/>,color:"#6366f1"},
              {label:"Active",value:summary?.active??0,icon:<UserCheck size={18}/>,color:"#10b981"},
              {label:"On Leave Today",value:summary?.onLeave??0,icon:<Calendar size={18}/>,color:"#f59e0b"},
              {label:"Departments",value:summary?.departments?.length??0,icon:<Briefcase size={18}/>,color:"#8b5cf6"},
            ].map(k=>(
              <div key={k.label} style={S.kpi}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={S.kpiL}>{k.label}</span>
                  <div style={{padding:6,borderRadius:8,background:k.color+"20",color:k.color}}>{k.icon}</div>
                </div>
                <div style={S.kpiV}>{k.value}</div>
              </div>
            ))}
          </div>

          <div className="grid-r2" style={{ gap:16 }}>
            {/* Dept breakdown */}
            <div style={S.card}>
              <div style={{fontSize:14,fontWeight:700,color:"var(--text-primary)",marginBottom:14}}>Department Headcount</div>
              {loading ? <div style={S.empty}>Loading...</div> : (
                (summary?.departments||[]).length===0
                  ? <div style={S.empty}>No departments yet</div>
                  : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {(summary?.departments||[]).sort((a,b)=>b._count-a._count).map(d=>{
                      const pct = summary?.active ? Math.round((d._count/summary.active)*100) : 0;
                      return (
                        <div key={d.department||"none"}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{fontSize:13,color:"var(--text-sec)"}}>{d.department||"Unassigned"}</span>
                            <span style={{fontSize:12,color:"#818CF8",fontWeight:600}}>{d._count}</span>
                          </div>
                          <ProgBar pct={pct}/>
                        </div>
                      );
                    })}
                  </div>
              )}
            </div>

            {/* Shifts overview */}
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>Shifts</div>
                <button style={S.btnSm} onClick={()=>{setEditShiftId(null);setShiftForm({...shiftEmpty});setError("");setShowShiftModal(true);}}>
                  <Plus size={12}/> Add Shift
                </button>
              </div>
              {shifts.length===0
                ? <div style={S.empty}>No shifts defined</div>
                : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {shifts.map(s=>(
                    <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--bg-hover)",borderRadius:8,padding:"10px 14px"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>{s.name}</div>
                        <div style={{fontSize:11,color:"var(--text-ghost)"}}>{s.startTime} – {s.endTime} · {s.workingHours}h · Grace {s.graceMins}m</div>
                      </div>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{fontSize:11,color:"#818CF8"}}>{s._count?.employees||0} emp</span>
                        <button style={{...S.btnSm,padding:"3px 8px"}} onClick={()=>{setEditShiftId(s.id);setShiftForm({name:s.name,startTime:s.startTime,endTime:s.endTime,workingHours:String(s.workingHours),graceMins:String(s.graceMins)});setShowShiftModal(true);}}>Edit</button>
                        <button style={{...S.btnDanger,padding:"3px 8px"}} onClick={()=>deleteShift(s.id)}>Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ EMPLOYEES ════════════════ */}
      {isHRManager && tab==="employees" && (
        <div style={S.card}>
          <div style={S.toolbar}>
            <div style={S.sw}><Search size={14} style={S.sIcon}/><input style={S.si} placeholder="Search employees..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          </div>
          {loading ? <div style={S.empty}>Loading...</div> : (
            <div className="table-wrap"><table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Code","Name","Designation / Dept","Type","Salary","Shift","Joined","Status",""].map(h=><th key={h} style={{...S.th,whiteSpace:"nowrap" as const}}>{h}</th>)}</tr></thead>
              <tbody>
                {employees.length===0
                  ? <tr><td colSpan={9} style={S.empty}>No employees yet.</td></tr>
                  : employees.map(e=>(
                    <tr key={e.id} onClick={()=>openDetail(e)} style={{cursor:"pointer"}}>
                      <td style={{...S.td,color:"#818CF8",fontWeight:600}}>{e.employeeCode}</td>
                      <td style={{...S.td,color:"var(--text-primary)",fontWeight:500}}>{e.name}</td>
                      <td style={S.td}><div style={{fontSize:13}}>{e.designation||"—"}</div><div style={{fontSize:11,color:"var(--text-ghost)"}}>{e.department||""}</div></td>
                      <td style={S.td}><Badge text={e.employmentType} color="#6366f1"/></td>
                      <td style={S.td}><div>{e.salaryType==="DAILY"?`₹${(e.dailyRate||0).toLocaleString("en-IN")}/day`:`${fmt(e.basicSalary)}/mo`}</div>{(e.hra>0||e.allowances>0)&&<div style={{fontSize:11,color:"var(--text-ghost)"}}>+HRA/Allow: {fmt(e.hra+e.allowances)}</div>}</td>
                      <td style={{...S.td,fontSize:12,color:"var(--text-ghost)"}}>{shifts.find(s=>s.id===e.shiftId)?.name||"—"}</td>
                      <td style={S.td}>{fmtDate(e.joiningDate)}</td>
                      <td style={S.td}><Badge text={e.status} color={e.status==="ACTIVE"?"#10b981":"#ef4444"}/></td>
                      <td style={S.td}>
                        <div style={{display:"flex",gap:4}}>
                          <button onClick={ev=>{ev.stopPropagation();openEdit(e);}} style={{...S.btnSm,padding:"3px 8px"}}>Edit</button>
                          {e.status==="ACTIVE" && <button onClick={ev=>{ev.stopPropagation();terminateEmployee(e);}} style={{...S.btnDanger,padding:"3px 8px"}}>Terminate</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* ════════════════ ATTENDANCE ════════════════ */}
      {isHRManager && tab==="attendance" && (
        <div style={S.card}>
          <div style={S.toolbar}>
            <span style={{fontSize:13,color:"var(--text-sec)",fontWeight:600}}>Filter:</span>
            <select style={S.fSel} value={attMonth} onChange={e=>setAttMonth(parseInt(e.target.value))}>{MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select>
            <select style={S.fSel} value={attYear} onChange={e=>setAttYear(parseInt(e.target.value))}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select>
            <span style={{marginLeft:"auto",fontSize:12,color:"var(--text-ghost)"}}>{attRecords.length} records</span>
          </div>
          {attLoading ? <div style={S.empty}>Loading...</div> : (
            <div className="table-wrap"><table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Employee","Code","Date","Status","Check-In","Check-Out","Notes"].map(h=><th key={h} style={{...S.th,whiteSpace:"nowrap" as const}}>{h}</th>)}</tr></thead>
              <tbody>
                {attRecords.length===0
                  ? <tr><td colSpan={7} style={S.empty}>No attendance records for {MONTHS[attMonth-1]} {attYear}.</td></tr>
                  : attRecords.map(r=>(
                    <tr key={r.id}>
                      <td style={{...S.td,color:"var(--text-primary)",fontWeight:500}}>{r.employee.name}</td>
                      <td style={{...S.td,color:"#818CF8",fontSize:12}}>{r.employee.employeeCode}</td>
                      <td style={S.td}>{fmtDate(r.date)}</td>
                      <td style={S.td}><Badge text={r.status} color={ATT_COLORS[r.status]||"var(--text-sec)"}/></td>
                      <td style={S.td}>{r.checkIn?new Date(r.checkIn).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"—"}</td>
                      <td style={S.td}>{r.checkOut?new Date(r.checkOut).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"—"}</td>
                      <td style={{...S.td,fontSize:12,color:"var(--text-ghost)"}}>{r.notes||"—"}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* ════════════════ PAYROLL ════════════════ */}
      {isHRManager && tab==="payroll" && (
        <div style={S.card}>
          <div style={S.toolbar}>
            <span style={{fontSize:13,color:"var(--text-sec)",fontWeight:600}}>Filter:</span>
            <select style={S.fSel} value={payMonth} onChange={e=>setPayMonth(parseInt(e.target.value))}>{MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select>
            <select style={S.fSel} value={payYear} onChange={e=>setPayYear(parseInt(e.target.value))}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select>
            <span style={{fontSize:12,color:"var(--text-ghost)"}}>{payrolls.length} payslips · Total Net: {fmt(payrolls.reduce((s,p)=>s+p.netSalary,0))} <span title="Professional Tax (PT) is deducted additionally in the payslip" style={{color:"#f59e0b",cursor:"help"}}>*pre-PT</span></span>
            <button onClick={()=>{setAutoPayForm({month:String(payMonth),year:String(payYear),workingDays:String(orgHR.defaultWorkingDays)});setAutoPayResult(null);setShowAutoPayModal(true);}} style={{...S.btn,marginLeft:"auto",background:"linear-gradient(135deg,#10b981,#059669)",fontSize:12,padding:"6px 14px"}}>
              Auto-Generate All
            </button>
          </div>
          {payLoading ? <div style={S.empty}>Loading...</div> : (
            <div className="table-wrap"><table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                {["Employee","Days","Basic",
                  ...(orgHR.enableHRA||orgHR.enableAllowances ? ["HRA+Allow"] : []),
                  ...(orgHR.enablePF||orgHR.enableESI ? ["PF+ESI"] : []),
                  "Net Salary","Status",""].map(h=><th key={h} style={{...S.th,whiteSpace:"nowrap" as const}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {payrolls.length===0
                  ? <tr><td colSpan={8} style={S.empty}>No payrolls. Click "Auto-Generate All" to compute from attendance.</td></tr>
                  : payrolls.map(p=>(
                    <tr key={p.id}>
                      <td style={{...S.td,color:"var(--text-primary)",fontWeight:500}}><div>{p.employee.name}</div><div style={{fontSize:11,color:"var(--text-ghost)"}}>{p.employee.employeeCode}{p.employee.designation?` · ${p.employee.designation}`:""}</div></td>
                      <td style={S.td}>{p.presentDays}/{p.workingDays}</td>
                      <td style={S.td}>{fmt(p.basicSalary)}</td>
                      {(orgHR.enableHRA||orgHR.enableAllowances) && <td style={{...S.td,color:"#10b981"}}>{fmt(p.hra+p.allowances)}</td>}
                      {(orgHR.enablePF||orgHR.enableESI) && <td style={{...S.td,color:"#ef4444"}}>{fmt(p.pfDeduction+p.esiDeduction)}</td>}
                      <td style={{...S.td,color:"var(--text-primary)",fontWeight:700}}>{fmt(p.netSalary)}</td>
                      <td style={S.td}>{p.isPaid?<Badge text="PAID" color="#10b981"/>:<Badge text="PENDING" color="#f59e0b"/>}</td>
                      <td style={S.td}>
                        <div style={{display:"flex",gap:6}}>
                          {!p.isPaid && <button onClick={()=>markPaid(p.id)} style={{...S.btnGreen,padding:"3px 8px",fontSize:11}}>Mark Paid</button>}
                          <button onClick={()=>viewPayslip(p)} style={{...S.btnSm,padding:"3px 8px",fontSize:11,display:"flex",alignItems:"center",gap:3}}><Download size={10}/> Payslip</button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* ════════════════ LEAVES ════════════════ */}
      {tab==="leaves" && (
        <div>
          <div style={{display:"flex",gap:4,marginBottom:16}}>
            {(["requests","balances"] as const).map(st=>(
              <button key={st} style={{...S.tab(leaveSubTab===st),fontSize:12}} onClick={()=>setLeaveSubTab(st)}>
                {st==="requests"?"Leave Requests":"Leave Balances"}
              </button>
            ))}
          </div>

          {leaveSubTab==="requests" && (
            <div style={S.card}>
              <div style={S.toolbar}>
                {["","PENDING","APPROVED","REJECTED"].map(s=>(
                  <button key={s||"ALL"} onClick={()=>setLeaveFilter(s)} style={{...S.btnSm,background:leaveFilter===s?"rgba(99,102,241,0.2)":"transparent",color:leaveFilter===s?"#818CF8":"var(--text-ghost)",border:"1px solid "+(leaveFilter===s?"#6366f130":"transparent")}}>
                    {s||"All"}
                  </button>
                ))}
                <span style={{marginLeft:"auto",fontSize:12,color:"var(--text-ghost)"}}>{leaves.length} requests</span>
              </div>
              {leaveLoading ? <div style={S.empty}>Loading...</div> : (
                <div className="table-wrap"><table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["Employee","Type","From","To","Days","Reason","Status","Actions"].map(h=><th key={h} style={{...S.th,whiteSpace:"nowrap" as const}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {leaves.length===0
                      ? <tr><td colSpan={8} style={S.empty}>No leave requests{leaveFilter?` with status ${leaveFilter}`:""}</td></tr>
                      : leaves.map(l=>(
                        <tr key={l.id}>
                          <td style={{...S.td,color:"var(--text-primary)",fontWeight:500}}><div>{l.employee.name}</div><div style={{fontSize:11,color:"var(--text-ghost)"}}>{l.employee.employeeCode}</div></td>
                          <td style={S.td}>{l.leaveType}</td>
                          <td style={S.td}>{fmtDate(l.fromDate)}</td>
                          <td style={S.td}>{fmtDate(l.toDate)}</td>
                          <td style={{...S.td,color:"var(--text-primary)",fontWeight:600}}>{l.days}</td>
                          <td style={{...S.td,fontSize:12,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{l.reason||"—"}</td>
                          <td style={S.td}><Badge text={l.status} color={LEAVE_STATUS_C[l.status]||"var(--text-sec)"}/></td>
                          <td style={S.td}>
                            {l.status==="PENDING"&&(
                              <div style={{display:"flex",gap:6}}>
                                <button onClick={()=>updateLeaveStatus(l.id,"APPROVED")} style={{...S.btnGreen,padding:"3px 8px",fontSize:11,display:"flex",alignItems:"center",gap:3}}><Check size={10}/> Approve</button>
                                <button onClick={()=>updateLeaveStatus(l.id,"REJECTED")} style={{...S.btnDanger,padding:"3px 8px",fontSize:11,display:"flex",alignItems:"center",gap:3}}><XCircle size={10}/> Reject</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table></div>
              )}
            </div>
          )}

          {leaveSubTab==="balances" && (
            <div style={S.card}>
              {lbLoading ? <div style={S.empty}>Loading...</div> : (
                <div className="table-wrap"><table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["Employee","Leave Type","Year","Allocated","Carried","Used","Pending","Available"].map(h=><th key={h} style={{...S.th,whiteSpace:"nowrap" as const}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {leaveBalances.length===0
                      ? <tr><td colSpan={8} style={S.empty}>No leave balances. Click "Allocate Balance" to add.</td></tr>
                      : leaveBalances.map(b=>{
                        const avail = b.allocated + b.carried - b.used - b.pending;
                        return (
                          <tr key={b.id}>
                            <td style={{...S.td,color:"var(--text-primary)",fontWeight:500}}>{b.employee.name}<div style={{fontSize:11,color:"var(--text-ghost)"}}>{b.employee.employeeCode}</div></td>
                            <td style={S.td}>{b.leaveType}</td>
                            <td style={S.td}>{b.year}</td>
                            <td style={{...S.td,color:"#818CF8",fontWeight:600}}>{b.allocated}</td>
                            <td style={S.td}>{b.carried}</td>
                            <td style={{...S.td,color:"#ef4444"}}>{b.used}</td>
                            <td style={{...S.td,color:"#f59e0b"}}>{b.pending}</td>
                            <td style={{...S.td,color:"#10b981",fontWeight:700}}>{avail.toFixed(1)}</td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ PERFORMANCE ════════════════ */}
      {isHRManager && tab==="performance" && (
        <div>
          <div style={{display:"flex",gap:4,marginBottom:16}}>
            {(["goals","reviews"] as const).map(st=>(
              <button key={st} style={{...S.tab(perfSubTab===st),fontSize:12}} onClick={()=>setPerfSubTab(st)}>
                {st==="goals"?"Goals & OKRs":"Performance Reviews"}
              </button>
            ))}
          </div>

          {perfSubTab==="goals" && (
            <div style={S.card}>
              {perfLoading ? <div style={S.empty}>Loading...</div> : (
                goals.length===0
                  ? <div style={S.empty}>No goals yet. Add performance goals for employees.</div>
                  : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {goals.map(g=>(
                      <div key={g.id} style={{background:"var(--bg-hover)",borderRadius:10,padding:"14px 16px",display:"flex",gap:14,alignItems:"flex-start"}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                            <span style={{fontSize:14,fontWeight:600,color:"var(--text-primary)"}}>{g.title}</span>
                            <Badge text={g.status} color={GOAL_STATUS_C[g.status]||"#818CF8"}/>
                            <span style={{fontSize:11,color:"var(--text-ghost)"}}>{g.category}</span>
                            {g.quarter&&<span style={{fontSize:11,color:"var(--text-ghost)"}}>Q{g.quarter} {g.year}</span>}
                          </div>
                          {g.description&&<div style={{fontSize:12,color:"var(--text-ghost)",marginBottom:8}}>{g.description}</div>}
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{flex:1,maxWidth:200}}><ProgBar pct={g.progress} color={g.status==="COMPLETED"?"#10b981":"#6366f1"}/></div>
                            <span style={{fontSize:12,color:"#818CF8",fontWeight:600}}>{g.progress}%</span>
                          </div>
                          <div style={{fontSize:11,color:"var(--text-ghost)",marginTop:6}}>{g.employee.name} · {g.employee.designation||"—"}{g.targetDate&&` · Due ${fmtDate(g.targetDate)}`}</div>
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <button style={{...S.btnSm,padding:"4px 8px",fontSize:11}} onClick={()=>{setEditGoalId(g.id);setGoalForm({employeeId:g.employeeId,title:g.title,description:g.description||"",category:g.category,targetDate:g.targetDate?g.targetDate.slice(0,10):"",progress:String(g.progress),status:g.status,year:String(g.year),quarter:String(g.quarter||"")});setShowGoalModal(true);}}>Edit</button>
                          <button style={{...S.btnDanger,padding:"4px 8px",fontSize:11}} onClick={()=>deleteGoal(g.id)}>Del</button>
                        </div>
                      </div>
                    ))}
                  </div>
              )}
            </div>
          )}

          {perfSubTab==="reviews" && (
            <div style={S.card}>
              {perfLoading ? <div style={S.empty}>Loading...</div> : (
                <div className="table-wrap"><table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["Employee","Review Type","Period","Self Rating","Manager Rating","Status","Strengths","Actions"].map(h=><th key={h} style={{...S.th,whiteSpace:"nowrap" as const}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {reviews.length===0
                      ? <tr><td colSpan={8} style={S.empty}>No performance reviews yet.</td></tr>
                      : reviews.map(r=>(
                        <tr key={r.id}>
                          <td style={{...S.td,color:"var(--text-primary)",fontWeight:500}}><div>{r.employee.name}</div><div style={{fontSize:11,color:"var(--text-ghost)"}}>{r.employee.department||""}</div></td>
                          <td style={S.td}><Badge text={r.reviewType} color="#6366f1"/></td>
                          <td style={S.td}>{r.reviewPeriod}</td>
                          <td style={S.td}><Stars value={r.selfRating}/></td>
                          <td style={S.td}><Stars value={r.rating}/></td>
                          <td style={S.td}><Badge text={r.status} color={r.status==="COMPLETED"?"#10b981":r.status==="IN_REVIEW"?"#f59e0b":"var(--text-ghost)"}/></td>
                          <td style={{...S.td,fontSize:12,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{r.strengths||"—"}</td>
                          <td style={S.td}><button style={{...S.btnSm,padding:"3px 8px",fontSize:11}} onClick={()=>{setEditReviewId(r.id);setReviewForm({employeeId:r.employeeId,reviewType:r.reviewType,reviewPeriod:r.reviewPeriod,rating:r.rating?String(r.rating):"",selfRating:r.selfRating?String(r.selfRating):"",status:r.status,strengths:r.strengths||"",improvements:r.improvements||"",comments:r.comments||""});setShowReviewModal(true);}}>Edit</button></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ EXPENSES ════════════════ */}
      {tab==="expenses" && (
        <div style={S.card}>
          <div style={S.toolbar}>
            {["","PENDING","APPROVED","REJECTED","PAID"].map(s=>(
              <button key={s||"ALL"} onClick={()=>setExpFilter(s)} style={{...S.btnSm,background:expFilter===s?"rgba(99,102,241,0.2)":"transparent",color:expFilter===s?"#818CF8":"var(--text-ghost)",border:"1px solid "+(expFilter===s?"#6366f130":"transparent")}}>
                {s||"All"}
              </button>
            ))}
            <span style={{marginLeft:"auto",fontSize:12,color:"var(--text-ghost)"}}>{expenses.length} expenses · Total: {fmt(expenses.reduce((s,e)=>s+e.amount,0))}</span>
          </div>
          {expLoading ? <div style={S.empty}>Loading...</div> : (
            <div className="table-wrap"><table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Employee","Date","Category","Title","Amount","Status","Actions"].map(h=><th key={h} style={{...S.th,whiteSpace:"nowrap" as const}}>{h}</th>)}</tr></thead>
              <tbody>
                {expenses.length===0
                  ? <tr><td colSpan={7} style={S.empty}>No expenses{expFilter?` with status ${expFilter}`:""}</td></tr>
                  : expenses.map(e=>(
                    <tr key={e.id}>
                      <td style={{...S.td,color:"var(--text-primary)",fontWeight:500}}><div>{e.employee.name}</div><div style={{fontSize:11,color:"var(--text-ghost)"}}>{e.employee.department||""}</div></td>
                      <td style={S.td}>{fmtDate(e.expenseDate)}</td>
                      <td style={S.td}><Badge text={e.category} color="#6366f1"/></td>
                      <td style={S.td}>{e.title}</td>
                      <td style={{...S.td,color:"var(--text-primary)",fontWeight:600}}>{fmt(e.amount)}</td>
                      <td style={S.td}><Badge text={e.status} color={EXP_STATUS_C[e.status]||"var(--text-sec)"}/></td>
                      <td style={S.td}>
                        <div style={{display:"flex",gap:5}}>
                          {e.status==="PENDING"&&<><button style={{...S.btnGreen,padding:"3px 8px",fontSize:11}} onClick={()=>expAction(e.id,"approve")}>Approve</button><button style={{...S.btnDanger,padding:"3px 8px",fontSize:11}} onClick={()=>expAction(e.id,"reject")}>Reject</button></>}
                          {e.status==="APPROVED"&&<button style={{...S.btnSm,padding:"3px 8px",fontSize:11}} onClick={()=>expAction(e.id,"paid")}>Mark Paid</button>}
                          {e.receiptUrl&&<a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" style={{...S.btnSm,padding:"3px 8px",fontSize:11,textDecoration:"none"}}>Receipt</a>}
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* ════════ MODALS ════════ */}

      {/* Employee Modal */}
      {showEmpModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowEmpModal(false)}>
          <div className="modal-inner">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"var(--text-primary)",margin:0,fontSize:16,fontWeight:700}}>{editId?"Edit Employee":"Add Employee"}</h3>
              <button onClick={()=>setShowEmpModal(false)} style={{background:"none",border:"none",color:"var(--text-ghost)",cursor:"pointer"}}><X size={18}/></button>
            </div>
            {error&&<div style={S.err}>{error}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="grid-r2">
                <div><label style={S.label}>Employee Code</label><input style={S.input} value={empForm.employeeCode} onChange={e=>ef("employeeCode",e.target.value)} placeholder={editId ? "EMP-001" : `Auto: ${nextEmployeeCode()}`} onKeyDown={kAlphaNum} maxLength={20}/>{!editId && <div style={{fontSize:11,color:"var(--text-ghost)",marginTop:3}}>Leave blank to auto-generate</div>}</div>
                <div><label style={S.label}>Full Name *</label><input style={S.input} value={empForm.name} onChange={e=>ef("name",e.target.value)} onKeyDown={kName} maxLength={100}/></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Email</label><input type="email" style={S.input} value={empForm.email} onChange={e=>ef("email",e.target.value)}/></div>
                <div><label style={S.label}>Phone</label><input style={S.input} value={empForm.phone} onChange={e=>ef("phone",e.target.value)} onKeyDown={kPhone} maxLength={15}/></div>
              </div>
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Designation / Post *</label>
                  <select style={S.select} value={empForm.designation} onChange={e=>ef("designation",e.target.value)}>
                    <option value="">Select post...</option>
                    {designationOpts.map(d=><option key={d} value={d}>{d}</option>)}
                    {empForm.designation && !designationOpts.includes(empForm.designation) && <option value={empForm.designation}>{empForm.designation}</option>}
                  </select>
                </div>
                <div><label style={S.label}>Department</label>{wbaOrg
                  ? <select style={S.select} value={empForm.department} onChange={e=>ef("department",e.target.value)}>
                      <option value="">Select department...</option>
                      {WBA_DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
                      {empForm.department && !(WBA_DEPARTMENTS as readonly string[]).includes(empForm.department) && <option value={empForm.department}>{empForm.department}</option>}
                    </select>
                  : <input style={S.input} value={empForm.department} onChange={e=>ef("department",e.target.value)} maxLength={100}/>}</div>
              </div>
              <div className="grid-r2">
                <div>
                  <label style={S.label}>Org Role (Access Level)</label>
                  <select style={S.select} value={empForm.orgRole} onChange={e=>ef("orgRole",e.target.value)}>
                    {ORG_ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Employment Type</label><select style={S.select} value={empForm.employmentType} onChange={e=>ef("employmentType",e.target.value)}>{["FULL_TIME","PART_TIME","CONTRACT","INTERN"].map(t=><option key={t} value={t}>{t.replace("_"," ")}</option>)}</select></div>
              </div>
              <div>
                <label style={S.label}>Joining Date *</label>
                <input type="date" style={S.input} value={empForm.joiningDate} onChange={e=>ef("joiningDate",e.target.value)}/>
              </div>
              <div style={{background:"var(--bg-hover)",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text-ghost)",textTransform:"uppercase" as const,letterSpacing:"0.05em",marginBottom:10}}>Salary Structure</div>
                <div className="grid-r2" style={{marginBottom:10}}>
                  <div><label style={S.label}>Salary Type</label><select style={S.select} value={empForm.salaryType} onChange={e=>ef("salaryType",e.target.value)}>
                    {wbaOrg
                      ? <>{WBA_SALARY_TYPES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                          {empForm.salaryType && !WBA_SALARY_TYPES.some(s=>s.value===empForm.salaryType) && <option value={empForm.salaryType}>{empForm.salaryType}</option>}</>
                      : <><option value="MONTHLY">Monthly (Fixed)</option><option value="DAILY">Daily Rate</option></>}
                  </select></div>
                  {wbaOrg
                    ? (empForm.salaryType!=="UNPAID" && <div><label style={S.label}>Amount (₹)</label><input type="number" style={S.input} value={empForm.basicSalary} onChange={e=>ef("basicSalary",e.target.value)} onKeyDown={kDecimal} placeholder="e.g. 25000"/></div>)
                    : (empForm.salaryType==="MONTHLY"
                      ? <div><label style={S.label}>Monthly CTC (₹)</label><input type="number" style={S.input} value={empForm.basicSalary} onChange={e=>ef("basicSalary",e.target.value)} onKeyDown={kDecimal} placeholder="e.g. 25000"/></div>
                      : <div><label style={S.label}>Daily Rate (₹/day)</label><input type="number" style={S.input} value={empForm.dailyRate} onChange={e=>ef("dailyRate",e.target.value)} onKeyDown={kDecimal}/></div>)
                  }
                </div>
                {!wbaOrg && (orgHR.enableHRA || orgHR.enableAllowances) && (
                  <div className="grid-r2">
                    {orgHR.enableHRA && (
                      <div><label style={S.label}>HRA (₹/month)</label><input type="number" style={S.input} value={empForm.hra} onChange={e=>ef("hra",e.target.value)} onKeyDown={kDecimal} placeholder="0"/></div>
                    )}
                    {orgHR.enableAllowances && (
                      <div><label style={S.label}>Other Allowances (₹/month)</label><input type="number" style={S.input} value={empForm.allowances} onChange={e=>ef("allowances",e.target.value)} onKeyDown={kDecimal} placeholder="0"/></div>
                    )}
                  </div>
                )}
                {/* Per-employee PF / ESI override */}
                <div style={{marginTop:10,display:"flex",gap:16,flexWrap:"wrap" as const}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text-sec)",cursor:"pointer"}}>
                    <span style={S.label}>PF (12% basic)</span>
                    <select style={{...S.select,width:"auto",padding:"5px 10px",fontSize:12}} value={empForm.pfEnabled} onChange={e=>ef("pfEnabled",e.target.value)}>
                      <option value="">Use org default ({orgHR.enablePF?"ON":"OFF"})</option>
                      <option value="true">Force ON</option>
                      <option value="false">Force OFF</option>
                    </select>
                  </label>
                  <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text-sec)",cursor:"pointer"}}>
                    <span style={S.label}>ESIC (0.75%)</span>
                    <select style={{...S.select,width:"auto",padding:"5px 10px",fontSize:12}} value={empForm.esiEnabled} onChange={e=>ef("esiEnabled",e.target.value)}>
                      <option value="">Use org default ({orgHR.enableESI?"ON":"OFF"})</option>
                      <option value="true">Force ON</option>
                      <option value="false">Force OFF</option>
                    </select>
                  </label>
                </div>
                {/* Salary preview */}
                {!wbaOrg && (parseFloat(empForm.basicSalary)||0) > 0 && (
                  <div style={{marginTop:12,background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:8,padding:"10px 14px"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#818CF8",textTransform:"uppercase" as const,letterSpacing:"0.05em",marginBottom:8}}>Salary Preview (full month)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        {l:"Gross",v:salaryPreview.gross,c:"#10b981"},
                        {l:"PF",   v:salaryPreview.pf,   c:"#ef4444"},
                        {l:"ESIC", v:salaryPreview.esi,  c:"#ef4444"},
                        {l:"Net Take-Home", v:salaryPreview.net, c:"var(--text-primary)"},
                      ].map(r=>(
                        <div key={r.l} style={{textAlign:"center" as const}}>
                          <div style={{fontSize:10,color:"var(--text-ghost)"}}>{r.l}</div>
                          <div style={{fontSize:14,fontWeight:700,color:r.c}}>₹{Math.round(r.v).toLocaleString("en-IN")}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>PAN Number</label><input style={S.input} value={empForm.panNumber} onChange={e=>ef("panNumber",e.target.value.toUpperCase())} placeholder="ABCDE1234F" onKeyDown={kPAN} maxLength={10}/></div>
                <div><label style={S.label}>PF Number</label><input style={S.input} value={empForm.pfNumber} onChange={e=>ef("pfNumber",e.target.value.toUpperCase())} maxLength={22}/></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Bank Account</label><input style={S.input} value={empForm.bankAccount} onChange={e=>ef("bankAccount",e.target.value)} onKeyDown={kDigits} maxLength={18}/></div>
                <div><label style={S.label}>IFSC Code</label><input style={S.input} value={empForm.bankIfsc} onChange={e=>ef("bankIfsc",e.target.value.toUpperCase())} onKeyDown={kIFSC} maxLength={11}/></div>
              </div>

              {/* Optional: create a login account for this employee (Owner/Admin only, new employees only) */}
              {!editId && isOrgAdmin && (
                <div style={{background:"var(--bg-hover)",borderRadius:8,padding:"12px 14px"}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:600,color:"var(--text-primary)",cursor:"pointer"}}>
                    <input type="checkbox" checked={loginForm.create} onChange={e=>setLoginForm(p=>({...p,create:e.target.checked}))}/>
                    Create a login account for this employee
                  </label>
                  {loginForm.create && (
                    <>
                      <div style={{fontSize:11,color:"var(--text-ghost)",margin:"8px 0 10px"}}>
                        They can sign in immediately with this email + temporary password, then reset it via the link sent to their email. The job role sets their default module access (adjust per-person under Admin → Module Access).
                      </div>
                      <div className="grid-r2">
                        <div><label style={S.label}>Login Email *</label><input type="email" style={S.input} value={loginForm.email} onChange={e=>setLoginForm(p=>({...p,email:e.target.value}))} placeholder={empForm.email||"name@company.com"}/></div>
                        <div><label style={S.label}>Temporary Password *</label><input style={S.input} value={loginForm.password} onChange={e=>setLoginForm(p=>({...p,password:e.target.value}))} placeholder="Min 8 chars, mixed case + number"/></div>
                      </div>
                      <div style={{marginTop:10}}>
                        <label style={S.label}>Job Role (default module access)</label>
                        <select style={S.select} value={loginForm.jobRole} onChange={e=>setLoginForm(p=>({...p,jobRole:e.target.value}))}>
                          {LOGIN_JOB_ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {editId&&<div style={{marginTop:20,paddingTop:16,borderTop:"1px solid var(--border)"}}><DocumentsPanel entityType="EMPLOYEE" entityId={editId} compact/></div>}
            <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowEmpModal(false)} style={{...S.btn,background:"var(--border)",color:"var(--text-sec)"}}>Cancel</button>
              <button onClick={saveEmployee} style={S.btn} disabled={saving}>{saving?"Saving...":editId?"Update":"Add Employee"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowAttModal(false)}>
          <div className="modal-inner" style={{maxWidth:460}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"var(--text-primary)",margin:0,fontSize:16,fontWeight:700}}>Mark Attendance</h3>
              <button onClick={()=>setShowAttModal(false)} style={{background:"none",border:"none",color:"var(--text-ghost)",cursor:"pointer"}}><X size={18}/></button>
            </div>
            {error&&<div style={S.err}>{error}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={S.label}>Employee *</label><select style={S.select} value={attForm.employeeId} onChange={e=>af("employeeId",e.target.value)}><option value="">Select...</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>)}</select></div>
              <div className="grid-r2">
                <div><label style={S.label}>Date *</label><input type="date" style={S.input} value={attForm.date} onChange={e=>af("date",e.target.value)}/></div>
                <div><label style={S.label}>Status *</label><select style={S.select} value={attForm.status} onChange={e=>af("status",e.target.value)}>{["PRESENT","ABSENT","HALF_DAY","LEAVE","HOLIDAY"].map(s=><option key={s} value={s}>{s.replace("_"," ")}</option>)}</select></div>
              </div>
              {(attForm.status==="PRESENT"||attForm.status==="HALF_DAY")&&(
                <div className="grid-r2">
                  <div><label style={S.label}>Check-In</label><input type="time" style={S.input} value={attForm.checkIn} onChange={e=>af("checkIn",e.target.value)}/></div>
                  <div><label style={S.label}>Check-Out</label><input type="time" style={S.input} value={attForm.checkOut} onChange={e=>af("checkOut",e.target.value)}/></div>
                </div>
              )}
              <div><label style={S.label}>Notes</label><input style={S.input} value={attForm.notes} onChange={e=>af("notes",e.target.value)}/></div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowAttModal(false)} style={{...S.btn,background:"var(--border)",color:"var(--text-sec)"}}>Cancel</button>
              <button onClick={saveAttendance} style={S.btn} disabled={saving||!attForm.employeeId}>{saving?"Saving...":"Mark Attendance"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Payroll Modal */}
      {showPayModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowPayModal(false)}>
          <div className="modal-inner" style={{maxWidth:500}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"var(--text-primary)",margin:0,fontSize:16,fontWeight:700}}>Generate Payroll</h3>
              <button onClick={()=>setShowPayModal(false)} style={{background:"none",border:"none",color:"var(--text-ghost)",cursor:"pointer"}}><X size={18}/></button>
            </div>
            {error&&<div style={S.err}>{error}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={S.label}>Employee *</label><select style={S.select} value={payForm.employeeId} onChange={e=>pf("employeeId",e.target.value)}><option value="">Select...</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>)}</select></div>
              <div className="grid-r2">
                <div><label style={S.label}>Month *</label><select style={S.select} value={payForm.month} onChange={e=>pf("month",e.target.value)}>{MONTHS.map((m,i)=><option key={i} value={String(i+1)}>{m}</option>)}</select></div>
                <div><label style={S.label}>Year *</label><select style={S.select} value={payForm.year} onChange={e=>pf("year",e.target.value)}>{years.map(y=><option key={y} value={String(y)}>{y}</option>)}</select></div>
              </div>
              {/* Working days — pill selector */}
              <div>
                <label style={S.label}>Working Days</label>
                <div style={{display:"flex",gap:8}}>
                  {[26,30,31].map(d=>(
                    <button key={d} type="button" onClick={()=>pf("workingDays",String(d))}
                      style={{padding:"7px 18px",borderRadius:8,border:"1px solid",cursor:"pointer",fontWeight:700,fontSize:13,
                        borderColor:payForm.workingDays===String(d)?"#6366f1":"var(--border-input)",
                        background:payForm.workingDays===String(d)?"#6366f120":"var(--bg-hover)",
                        color:payForm.workingDays===String(d)?"#818cf8":"var(--text-sec)"}}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div><label style={S.label}>Days Present * (max {payForm.workingDays})</label><input type="number" style={S.input} value={payForm.presentDays} onChange={e=>pf("presentDays",e.target.value)} placeholder="e.g. 24" min="0" max={payForm.workingDays} step="0.5"/></div>
              {(orgHR.enableHRA||orgHR.enableAllowances) && (
                <div className="grid-r2">
                  {orgHR.enableHRA && <div><label style={S.label}>HRA Override (₹)</label><input type="number" style={S.input} value={payForm.hra} onChange={e=>pf("hra",e.target.value)}/></div>}
                  {orgHR.enableAllowances && <div><label style={S.label}>Allowances Override (₹)</label><input type="number" style={S.input} value={payForm.allowances} onChange={e=>pf("allowances",e.target.value)}/></div>}
                </div>
              )}
              <div><label style={S.label}>Other Deductions (₹)</label><input type="number" style={S.input} value={payForm.deductions} onChange={e=>pf("deductions",e.target.value)}/></div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowPayModal(false)} style={{...S.btn,background:"var(--border)",color:"var(--text-sec)"}}>Cancel</button>
              <button onClick={savePayroll} style={S.btn} disabled={saving||!payForm.employeeId}>{saving?"Generating...":"Generate Payroll"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Generate Modal */}
      {showAutoPayModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowAutoPayModal(false)}>
          <div className="modal-inner" style={{maxWidth:480}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"var(--text-primary)",margin:0,fontSize:16,fontWeight:700}}>Auto-Generate Payroll</h3>
              <button onClick={()=>setShowAutoPayModal(false)} style={{background:"none",border:"none",color:"var(--text-ghost)",cursor:"pointer"}}><X size={18}/></button>
            </div>
            {!autoPayResult ? (
              <>
                <div style={{background:"var(--bg-hover)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#818CF8"}}>
                  Calculates salary for <strong style={{color:"var(--text-primary)"}}>all active employees</strong> based on attendance.
                  {(orgHR.enablePF||orgHR.enableESI) && <> {[orgHR.enablePF&&"PF",orgHR.enableESI&&"ESI"].filter(Boolean).join(" & ")} auto-deducted.</>}
                  {(!orgHR.enablePF&&!orgHR.enableESI) && <> No statutory deductions (PF/ESI disabled in HR Settings).</>}
                </div>
                {error&&<div style={S.err}>{error}</div>}
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div className="grid-r2">
                    <div><label style={S.label}>Month *</label><select style={S.select} value={autoPayForm.month} onChange={e=>setAutoPayForm(p=>({...p,month:e.target.value}))}>{MONTHS.map((m,i)=><option key={i} value={String(i+1)}>{m}</option>)}</select></div>
                    <div><label style={S.label}>Year *</label><select style={S.select} value={autoPayForm.year} onChange={e=>setAutoPayForm(p=>({...p,year:e.target.value}))}>{years.map(y=><option key={y} value={String(y)}>{y}</option>)}</select></div>
                  </div>
                  {/* Working days — pill selector */}
                  <div>
                    <label style={S.label}>Working Days (month basis)</label>
                    <div style={{display:"flex",gap:8}}>
                      {[26,30,31].map(d=>(
                        <button key={d} type="button" onClick={()=>setAutoPayForm(p=>({...p,workingDays:String(d)}))}
                          style={{padding:"7px 18px",borderRadius:8,border:"1px solid",cursor:"pointer",fontWeight:700,fontSize:13,
                            borderColor:autoPayForm.workingDays===String(d)?"#10b981":"var(--border-input)",
                            background:autoPayForm.workingDays===String(d)?"#10b98120":"var(--bg-hover)",
                            color:autoPayForm.workingDays===String(d)?"#10b981":"var(--text-sec)"}}>
                          {d}
                        </button>
                      ))}
                    </div>
                    <div style={{fontSize:11,color:"var(--text-ghost)",marginTop:6}}>
                      Net = Basic ÷ {autoPayForm.workingDays} × Days Present{orgHR.enableHRA?" + HRA":""}{orgHR.enableAllowances?" + Allowances":""}
                      {orgHR.enablePF?" − PF 12%":""}{orgHR.enableESI?" − ESI 0.75%":""}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
                  <button onClick={()=>setShowAutoPayModal(false)} style={{...S.btn,background:"var(--border)",color:"var(--text-sec)"}}>Cancel</button>
                  <button onClick={autoGeneratePayroll} style={{...S.btn,background:"linear-gradient(135deg,#10b981,#059669)"}} disabled={saving}>{saving?"Generating...":"Generate"}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{background:"#10b98120",border:"1px solid #10b98140",borderRadius:8,padding:"14px 16px",marginBottom:16}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#10b981",marginBottom:4}}>✓ Payroll Generated</div>
                  <div style={{fontSize:13,color:"var(--text-sec)"}}>{autoPayResult.generated} employees · {MONTHS[autoPayResult.month-1]} {autoPayResult.year}</div>
                  <div style={{fontSize:20,fontWeight:700,color:"var(--text-primary)",marginTop:8}}>Total Payout: {fmt(autoPayResult.totalNetSalary)}</div>
                </div>
                <div style={{display:"flex",justifyContent:"flex-end"}}>
                  <button onClick={()=>setShowAutoPayModal(false)} style={S.btn}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Apply Leave Modal */}
      {showLeaveModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowLeaveModal(false)}>
          <div className="modal-inner" style={{maxWidth:460}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"var(--text-primary)",margin:0,fontSize:16,fontWeight:700}}>Apply for Leave</h3>
              <button onClick={()=>setShowLeaveModal(false)} style={{background:"none",border:"none",color:"var(--text-ghost)",cursor:"pointer"}}><X size={18}/></button>
            </div>
            {error&&<div style={S.err}>{error}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={S.label}>Employee *</label><select style={S.select} value={leaveForm.employeeId} onChange={e=>lf("employeeId",e.target.value)}><option value="">Select...</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>)}</select></div>
              <div><label style={S.label}>Leave Type</label><select style={S.select} value={leaveForm.leaveType} onChange={e=>lf("leaveType",e.target.value)}>{leaveTypeOpts.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
              <div className="grid-r2">
                <div><label style={S.label}>From *</label><input type="date" style={S.input} value={leaveForm.fromDate} onChange={e=>lf("fromDate",e.target.value)}/></div>
                <div><label style={S.label}>To *</label><input type="date" style={S.input} value={leaveForm.toDate} onChange={e=>lf("toDate",e.target.value)}/></div>
              </div>
              <div><label style={S.label}>Reason</label><textarea style={{...S.input,height:70,resize:"none" as const}} value={leaveForm.reason} onChange={e=>lf("reason",e.target.value)}/></div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowLeaveModal(false)} style={{...S.btn,background:"var(--border)",color:"var(--text-sec)"}}>Cancel</button>
              <button onClick={saveLeave} style={S.btn} disabled={saving||!leaveForm.employeeId||!leaveForm.fromDate}>{saving?"Submitting...":"Submit"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Balance Modal */}
      {showLbModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowLbModal(false)}>
          <div className="modal-inner" style={{maxWidth:420}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"var(--text-primary)",margin:0,fontSize:16,fontWeight:700}}>Allocate Leave Balance</h3>
              <button onClick={()=>setShowLbModal(false)} style={{background:"none",border:"none",color:"var(--text-ghost)",cursor:"pointer"}}><X size={18}/></button>
            </div>
            {error&&<div style={S.err}>{error}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={S.label}>Employee *</label><select style={S.select} value={lbForm.employeeId} onChange={e=>setLbForm(p=>({...p,employeeId:e.target.value}))}><option value="">Select...</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>)}</select></div>
              <div className="grid-r2">
                <div><label style={S.label}>Leave Type</label><select style={S.select} value={lbForm.leaveType} onChange={e=>setLbForm(p=>({...p,leaveType:e.target.value}))}>{leaveTypeOpts.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                <div><label style={S.label}>Year</label><select style={S.select} value={lbForm.year} onChange={e=>setLbForm(p=>({...p,year:e.target.value}))}>{years.map(y=><option key={y} value={String(y)}>{y}</option>)}</select></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Allocated Days</label><input type="number" style={S.input} value={lbForm.allocated} onChange={e=>setLbForm(p=>({...p,allocated:e.target.value}))} min="0"/></div>
                <div><label style={S.label}>Carried Forward</label><input type="number" style={S.input} value={lbForm.carried} onChange={e=>setLbForm(p=>({...p,carried:e.target.value}))} min="0"/></div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowLbModal(false)} style={{...S.btn,background:"var(--border)",color:"var(--text-sec)"}}>Cancel</button>
              <button onClick={saveLeaveBalance} style={S.btn} disabled={saving||!lbForm.employeeId}>{saving?"Saving...":"Allocate"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Modal */}
      {showShiftModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowShiftModal(false)}>
          <div className="modal-inner" style={{maxWidth:420}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"var(--text-primary)",margin:0,fontSize:16,fontWeight:700}}>{editShiftId?"Edit Shift":"Add Shift"}</h3>
              <button onClick={()=>setShowShiftModal(false)} style={{background:"none",border:"none",color:"var(--text-ghost)",cursor:"pointer"}}><X size={18}/></button>
            </div>
            {error&&<div style={S.err}>{error}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={S.label}>Shift Name *</label><input style={S.input} value={shiftForm.name} onChange={e=>setShiftForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Morning Shift"/></div>
              <div className="grid-r2">
                <div><label style={S.label}>Start Time *</label><input type="time" style={S.input} value={shiftForm.startTime} onChange={e=>setShiftForm(p=>({...p,startTime:e.target.value}))}/></div>
                <div><label style={S.label}>End Time *</label><input type="time" style={S.input} value={shiftForm.endTime} onChange={e=>setShiftForm(p=>({...p,endTime:e.target.value}))}/></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Working Hours</label><input type="number" style={S.input} value={shiftForm.workingHours} onChange={e=>setShiftForm(p=>({...p,workingHours:e.target.value}))} min="0" max="24" step="0.5"/></div>
                <div><label style={S.label}>Grace Minutes</label><input type="number" style={S.input} value={shiftForm.graceMins} onChange={e=>setShiftForm(p=>({...p,graceMins:e.target.value}))} min="0" max="60"/></div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowShiftModal(false)} style={{...S.btn,background:"var(--border)",color:"var(--text-sec)"}}>Cancel</button>
              <button onClick={saveShift} style={S.btn} disabled={saving||!shiftForm.name}>{saving?"Saving...":editShiftId?"Update Shift":"Add Shift"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {showGoalModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowGoalModal(false)}>
          <div className="modal-inner" style={{maxWidth:520}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"var(--text-primary)",margin:0,fontSize:16,fontWeight:700}}>{editGoalId?"Edit Goal":"Add Performance Goal"}</h3>
              <button onClick={()=>setShowGoalModal(false)} style={{background:"none",border:"none",color:"var(--text-ghost)",cursor:"pointer"}}><X size={18}/></button>
            </div>
            {error&&<div style={S.err}>{error}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={S.label}>Employee *</label><select style={S.select} value={goalForm.employeeId} onChange={e=>setGoalForm(p=>({...p,employeeId:e.target.value}))}><option value="">Select...</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.designation||e.department||e.employeeCode})</option>)}</select></div>
              <div><label style={S.label}>Goal Title *</label><input style={S.input} value={goalForm.title} onChange={e=>setGoalForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Increase sales by 20%"/></div>
              <div><label style={S.label}>Description</label><textarea style={{...S.input,height:60,resize:"none" as const}} value={goalForm.description} onChange={e=>setGoalForm(p=>({...p,description:e.target.value}))}/></div>
              <div className="grid-r2">
                <div><label style={S.label}>Category</label><select style={S.select} value={goalForm.category} onChange={e=>setGoalForm(p=>({...p,category:e.target.value}))}>{["Individual","Team","Department","Company"].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div><label style={S.label}>Status</label><select style={S.select} value={goalForm.status} onChange={e=>setGoalForm(p=>({...p,status:e.target.value}))}>{["IN_PROGRESS","COMPLETED","ON_HOLD","CANCELLED"].map(s=><option key={s} value={s}>{s.replace("_"," ")}</option>)}</select></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Year</label><select style={S.select} value={goalForm.year} onChange={e=>setGoalForm(p=>({...p,year:e.target.value}))}>{years.map(y=><option key={y} value={String(y)}>{y}</option>)}</select></div>
                <div><label style={S.label}>Quarter (optional)</label><select style={S.select} value={goalForm.quarter} onChange={e=>setGoalForm(p=>({...p,quarter:e.target.value}))}><option value="">Full Year</option>{[1,2,3,4].map(q=><option key={q} value={String(q)}>Q{q}</option>)}</select></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Progress ({goalForm.progress}%)</label><input type="range" min="0" max="100" style={{width:"100%",accentColor:"#6366f1"}} value={goalForm.progress} onChange={e=>setGoalForm(p=>({...p,progress:e.target.value}))}/></div>
                <div><label style={S.label}>Target Date</label><input type="date" style={S.input} value={goalForm.targetDate} onChange={e=>setGoalForm(p=>({...p,targetDate:e.target.value}))}/></div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowGoalModal(false)} style={{...S.btn,background:"var(--border)",color:"var(--text-sec)"}}>Cancel</button>
              <button onClick={saveGoal} style={S.btn} disabled={saving||!goalForm.employeeId||!goalForm.title}>{saving?"Saving...":editGoalId?"Update":"Add Goal"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowReviewModal(false)}>
          <div className="modal-inner" style={{maxWidth:540}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"var(--text-primary)",margin:0,fontSize:16,fontWeight:700}}>{editReviewId?"Edit Review":"Add Performance Review"}</h3>
              <button onClick={()=>setShowReviewModal(false)} style={{background:"none",border:"none",color:"var(--text-ghost)",cursor:"pointer"}}><X size={18}/></button>
            </div>
            {error&&<div style={S.err}>{error}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={S.label}>Employee *</label><select style={S.select} value={reviewForm.employeeId} onChange={e=>setReviewForm(p=>({...p,employeeId:e.target.value}))}><option value="">Select...</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.department||e.employeeCode})</option>)}</select></div>
              <div className="grid-r2">
                <div><label style={S.label}>Review Type</label><select style={S.select} value={reviewForm.reviewType} onChange={e=>setReviewForm(p=>({...p,reviewType:e.target.value}))}>{["ANNUAL","QUARTERLY","PROBATION","MID_YEAR"].map(t=><option key={t} value={t}>{t.replace("_"," ")}</option>)}</select></div>
                <div><label style={S.label}>Review Period *</label><input style={S.input} value={reviewForm.reviewPeriod} onChange={e=>setReviewForm(p=>({...p,reviewPeriod:e.target.value}))} placeholder="e.g. Jan–Jun 2026"/></div>
              </div>
              <div className="grid-r2">
                <div><label style={S.label}>Self Rating (0–5)</label><input type="number" style={S.input} value={reviewForm.selfRating} onChange={e=>setReviewForm(p=>({...p,selfRating:e.target.value}))} min="0" max="5" step="0.5"/></div>
                <div><label style={S.label}>Manager Rating (0–5)</label><input type="number" style={S.input} value={reviewForm.rating} onChange={e=>setReviewForm(p=>({...p,rating:e.target.value}))} min="0" max="5" step="0.5"/></div>
              </div>
              <div><label style={S.label}>Status</label><select style={S.select} value={reviewForm.status} onChange={e=>setReviewForm(p=>({...p,status:e.target.value}))}>{["DRAFT","IN_REVIEW","COMPLETED"].map(s=><option key={s} value={s}>{s.replace("_"," ")}</option>)}</select></div>
              <div><label style={S.label}>Strengths</label><textarea style={{...S.input,height:60,resize:"none" as const}} value={reviewForm.strengths} onChange={e=>setReviewForm(p=>({...p,strengths:e.target.value}))}/></div>
              <div><label style={S.label}>Areas for Improvement</label><textarea style={{...S.input,height:60,resize:"none" as const}} value={reviewForm.improvements} onChange={e=>setReviewForm(p=>({...p,improvements:e.target.value}))}/></div>
              <div><label style={S.label}>Comments</label><textarea style={{...S.input,height:60,resize:"none" as const}} value={reviewForm.comments} onChange={e=>setReviewForm(p=>({...p,comments:e.target.value}))}/></div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowReviewModal(false)} style={{...S.btn,background:"var(--border)",color:"var(--text-sec)"}}>Cancel</button>
              <button onClick={saveReview} style={S.btn} disabled={saving||!reviewForm.employeeId||!reviewForm.reviewPeriod}>{saving?"Saving...":editReviewId?"Update":"Add Review"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpModal && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowExpModal(false)}>
          <div className="modal-inner" style={{maxWidth:460}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"var(--text-primary)",margin:0,fontSize:16,fontWeight:700}}>Add Expense Claim</h3>
              <button onClick={()=>setShowExpModal(false)} style={{background:"none",border:"none",color:"var(--text-ghost)",cursor:"pointer"}}><X size={18}/></button>
            </div>
            {error&&<div style={S.err}>{error}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={S.label}>Employee *</label><select style={S.select} value={expForm.employeeId} onChange={e=>setExpForm(p=>({...p,employeeId:e.target.value}))}><option value="">Select...</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.department||e.employeeCode})</option>)}</select></div>
              <div className="grid-r2">
                <div><label style={S.label}>Category</label><select style={S.select} value={expForm.category} onChange={e=>setExpForm(p=>({...p,category:e.target.value}))}>{EXP_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div><label style={S.label}>Expense Date *</label><input type="date" style={S.input} value={expForm.expenseDate} onChange={e=>setExpForm(p=>({...p,expenseDate:e.target.value}))}/></div>
              </div>
              <div><label style={S.label}>Title / Description *</label><input style={S.input} value={expForm.title} onChange={e=>setExpForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Flight to Mumbai for client meeting"/></div>
              <div className="grid-r2">
                <div><label style={S.label}>Amount (₹) *</label><input type="number" style={S.input} value={expForm.amount} onChange={e=>setExpForm(p=>({...p,amount:e.target.value}))} min="0" step="0.01"/></div>
                <div><label style={S.label}>Receipt URL</label><input style={S.input} value={expForm.receiptUrl} onChange={e=>setExpForm(p=>({...p,receiptUrl:e.target.value}))} placeholder="https://..."/></div>
              </div>
              <div><label style={S.label}>Notes</label><textarea style={{...S.input,height:60,resize:"none" as const}} value={expForm.notes} onChange={e=>setExpForm(p=>({...p,notes:e.target.value}))}/></div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowExpModal(false)} style={{...S.btn,background:"var(--border)",color:"var(--text-sec)"}}>Cancel</button>
              <button onClick={saveExpense} style={S.btn} disabled={saving||!expForm.employeeId||!expForm.title||!expForm.amount}>{saving?"Submitting...":"Submit Claim"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Payslip Modal */}
      {showPayslip && payslip && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowPayslip(false)}>
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:16,padding:28,width:"min(640px,96vw)",maxHeight:"92vh",overflowY:"auto" as const}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"var(--text-primary)",margin:0,fontSize:16,fontWeight:700}}>Payslip — {payslip.period.label}</h3>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>window.print()} style={{...S.btnSm,display:"flex",alignItems:"center",gap:4}}><Download size={13}/> Print</button>
                <button onClick={()=>setShowPayslip(false)} style={{background:"none",border:"none",color:"var(--text-ghost)",cursor:"pointer"}}><X size={18}/></button>
              </div>
            </div>
            {/* Company Header */}
            <div style={{background:"linear-gradient(135deg,var(--bg-hover),var(--border))",borderRadius:10,padding:"16px 20px",marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:700,color:"var(--text-primary)"}}>{payslip.org.name}</div>
              <div style={{fontSize:12,color:"#818CF8",marginTop:2}}>{payslip.org.address}{payslip.org.city?`, ${payslip.org.city}`:""}{payslip.org.pan?` · PAN: ${payslip.org.pan}`:""}</div>
            </div>
            {/* Employee Info */}
            <div className="grid-r2" style={{ gap:10, marginBottom:16 }}>
              {[
                {label:"Employee Name",value:payslip.employee.name},
                {label:"Employee Code",value:payslip.employee.code},
                {label:"Designation",value:payslip.employee.designation||"—"},
                {label:"Department",value:payslip.employee.department||"—"},
                {label:"PAN",value:payslip.employee.pan||"—"},
                {label:"PF Number",value:payslip.employee.pf||"—"},
                {label:"Bank Account",value:payslip.employee.bankAccount||"—"},
                {label:"IFSC Code",value:payslip.employee.bankIfsc||"—"},
              ].map(row=>(
                <div key={row.label} style={{background:"var(--bg-hover)",borderRadius:6,padding:"8px 10px"}}>
                  <div style={{fontSize:10,color:"var(--text-ghost)",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.05em"}}>{row.label}</div>
                  <div style={{fontSize:13,color:"var(--text-primary)",marginTop:2}}>{row.value}</div>
                </div>
              ))}
            </div>
            {/* Attendance */}
            <div style={{display:"flex",gap:10,marginBottom:16}}>
              {[{label:"Working Days",value:payslip.attendance.workingDays},{label:"Days Present",value:payslip.attendance.presentDays}].map(r=>(
                <div key={r.label} style={{flex:1,background:"var(--bg-hover)",borderRadius:6,padding:"8px 10px",textAlign:"center" as const}}>
                  <div style={{fontSize:10,color:"var(--text-ghost)",fontWeight:700,textTransform:"uppercase" as const}}>{r.label}</div>
                  <div style={{fontSize:18,fontWeight:700,color:"var(--text-primary)",marginTop:2}}>{r.value}</div>
                </div>
              ))}
            </div>
            {/* Earnings + Deductions */}
            <div className="grid-r2" style={{ gap:12, marginBottom:16 }}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"#10b981",marginBottom:8}}>EARNINGS</div>
                {[{l:"Basic Salary",v:payslip.earnings.basic},{l:"HRA",v:payslip.earnings.hra},{l:"Allowances",v:payslip.earnings.allowances}].map(r=>(
                  <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--bg-hover)",fontSize:13}}>
                    <span style={{color:"var(--text-sec)"}}>{r.l}</span><span style={{color:"var(--text-primary)",fontWeight:500}}>{fmt(r.v)}</span>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",fontSize:13,fontWeight:700}}>
                  <span style={{color:"#10b981"}}>Gross Salary</span><span style={{color:"#10b981"}}>{fmt(payslip.earnings.gross)}</span>
                </div>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"#ef4444",marginBottom:8}}>DEDUCTIONS</div>
                {[{l:"PF (Employee 12%)",v:payslip.deductions.pf},{l:"ESI (0.75%)",v:payslip.deductions.esi},{l:"Prof. Tax",v:payslip.deductions.pt},{l:"TDS",v:payslip.deductions.tds},{l:"Other",v:payslip.deductions.other}].filter(r=>r.v>0).map(r=>(
                  <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--bg-hover)",fontSize:13}}>
                    <span style={{color:"var(--text-sec)"}}>{r.l}</span><span style={{color:"#ef4444",fontWeight:500}}>− {fmt(r.v)}</span>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",fontSize:13,fontWeight:700}}>
                  <span style={{color:"#ef4444"}}>Total Deductions</span><span style={{color:"#ef4444"}}>− {fmt(payslip.deductions.total)}</span>
                </div>
              </div>
            </div>
            {/* Net Salary */}
            <div style={{background:"linear-gradient(135deg,#6366f120,#8b5cf620)",border:"1px solid #6366f130",borderRadius:10,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:12,color:"#818CF8",fontWeight:700,textTransform:"uppercase" as const}}>Net Take-Home Salary</div>
                <div style={{fontSize:11,color:"var(--text-ghost)",marginTop:2}}>{payslip.period.label} · {payslip.isPaid?`Paid on ${payslip.paidAt?fmtDate(payslip.paidAt):"—"}`:"Pending Payment"}</div>
              </div>
              <div style={{fontSize:28,fontWeight:700,color:"var(--text-primary)"}}>{fmt(payslip.netSalary)}</div>
            </div>
            <div style={{marginTop:16,display:"flex",alignItems:"center",gap:6}}>
              <ChevronRight size={12} color="var(--text-ghost)"/>
              <span style={{fontSize:11,color:"var(--text-ghost)"}}>This is a computer-generated payslip and does not require a signature.</span>
            </div>
          </div>
        </div>
      )}

      {/* Employee Detail Modal */}
      {showEmpDetail && (
        <div style={S.modal} onClick={e=>e.target===e.currentTarget&&setShowEmpDetail(false)}>
          <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:16,padding:28,width:"min(760px,96vw)",maxHeight:"90vh",overflowY:"auto" as const}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{color:"var(--text-primary)",margin:0,fontSize:16,fontWeight:700}}>Employee Profile</h3>
              <div style={{display:"flex",gap:8}}>
                {detailEmp&&<button onClick={()=>{setShowEmpDetail(false);openEdit(detailEmp as Employee);}} style={S.btnSm}>Edit</button>}
                <button onClick={()=>setShowEmpDetail(false)} style={{background:"none",border:"none",color:"var(--text-ghost)",cursor:"pointer"}}><X size={18}/></button>
              </div>
            </div>
            {detailLoading&&<div style={{padding:40,textAlign:"center" as const,color:"var(--text-ghost)"}}>Loading...</div>}
            {!detailLoading&&detailEmp&&(()=>{
              const emp=detailEmp;
              const atts:AttRecord[]=emp.attendances||[];
              const pays:Payroll[]=emp.payrolls||[];
              const lvs:LeaveReq[]=emp.leaveRequests||[];
              return (
                <>
                  <div style={{display:"flex",gap:16,marginBottom:20,flexWrap:"wrap" as const}}>
                    <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"white",flexShrink:0}}>
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:18,fontWeight:700,color:"var(--text-primary)"}}>{emp.name}</div>
                      <div style={{fontSize:13,color:"#818CF8"}}>{emp.employeeCode} · {emp.designation||"—"} · {emp.department||"—"}</div>
                      <div style={{fontSize:12,color:"var(--text-ghost)",marginTop:2}}>Joined {fmtDate(emp.joiningDate)} · <Badge text={emp.status} color={emp.status==="ACTIVE"?"#10b981":"#ef4444"}/></div>
                    </div>
                    <div style={{textAlign:"right" as const}}>
                      <div style={{fontSize:20,fontWeight:700,color:"var(--text-primary)"}}>{emp.salaryType==="DAILY"?`₹${(emp.dailyRate||0).toLocaleString("en-IN")}/day`:`${fmt(emp.basicSalary)}/mo`}</div>
                      <div style={{fontSize:11,color:"var(--text-ghost)"}}>{emp.salaryType==="MONTHLY"?"Monthly CTC":"Daily Rate"}{(emp.hra>0||emp.allowances>0)?` + ₹${(emp.hra+emp.allowances).toLocaleString("en-IN")} HRA/Allow`:""}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                    {[{label:"Present (this month)",value:emp.thisMonthPresent??0,color:"#10b981"},{label:"Absences",value:atts.filter((a:AttRecord)=>a.status==="ABSENT").length,color:"#ef4444"},{label:"Payrolls",value:pays.length,color:"#6366f1"},{label:"Leave Requests",value:lvs.length,color:"#f59e0b"}].map(k=>(
                      <div key={k.label} style={{background:"var(--bg-hover)",borderRadius:8,padding:"12px 14px"}}>
                        <div style={{fontSize:11,color:"var(--text-ghost)"}}>{k.label}</div>
                        <div style={{fontSize:22,fontWeight:700,color:k.color,marginTop:2}}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:8}}>Recent Attendance</div>
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:4}}>
                      {atts.slice(0,30).map((a:AttRecord)=>(
                        <div key={a.id} title={`${fmtDate(a.date)} — ${a.status}`} style={{width:30,height:30,borderRadius:5,background:ATT_COLORS[a.status]+"30",border:`1px solid ${ATT_COLORS[a.status]}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:600,color:ATT_COLORS[a.status]}}>
                          {new Date(a.date).getDate()}
                        </div>
                      ))}
                      {atts.length===0&&<span style={{fontSize:12,color:"var(--text-ghost)"}}>No records yet.</span>}
                    </div>
                  </div>
                  {pays.length>0&&(
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:8}}>Payroll History</div>
                      <div className="overflow-x-auto">
                        <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12}}>
                        <thead><tr>{["Month","Days","Gross","Deductions","Net","Status"].map(h=><th key={h} style={{...S.th,fontSize:10}}>{h}</th>)}</tr></thead>
                        <tbody>
                          {pays.slice(0,6).map((p:Payroll)=>(
                            <tr key={p.id}>
                              <td style={S.td}>{MONTHS[p.month-1]} {p.year}</td>
                              <td style={S.td}>{p.presentDays}/{p.workingDays}</td>
                              <td style={S.td}>{fmt(p.grossSalary)}</td>
                              <td style={{...S.td,color:"#ef4444"}}>{fmt(p.pfDeduction+p.esiDeduction+p.deductions)}</td>
                              <td style={{...S.td,fontWeight:700,color:"var(--text-primary)"}}>{fmt(p.netSalary)}</td>
                              <td style={S.td}>{p.isPaid?<Badge text="PAID" color="#10b981"/>:<Badge text="PENDING" color="#f59e0b"/>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
