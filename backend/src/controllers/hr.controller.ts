import { Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { z } from "zod";
import { MemberRole } from "@prisma/client";
import { ok, created, badRequest, notFound, serverError, conflict, forbidden } from "../utils/response";
import { isWBAOrg } from "../utils/wbaOrg";
import { JOB_ROLES } from "./org.controller";
import { isStrongPassword } from "./auth.controller";

const DESIGNATION_OPTIONS = [
  "Developer", "Senior Developer", "Frontend Developer", "Backend Developer", "Full Stack Developer",
  "Project Manager", "Team Lead", "Scrum Master", "Tech Lead",
  "HR Manager", "HR Executive", "HR Assistant",
  "Accountant", "Senior Accountant", "Finance Executive", "Finance Manager",
  "Sales Executive", "Business Development Manager", "Business Analyst",
  "Operations Manager", "Admin Executive", "Office Manager",
  "UI/UX Designer", "QA Engineer", "DevOps Engineer",
  "Marketing Executive", "Marketing Manager",
  "Director", "CEO", "CTO", "CFO",
  "Other",
];

// White Band Associates uses a fixed, service-line designation list
const WBA_DESIGNATION_OPTIONS = [
  "VAPT Intern", "GRC Intern", "Sales Intern", "Cyber Security Analyst",
  "Sales Manager", "Sales Executive", "Networking Tutor", "Linux Tutor",
  "CS Tutor", "Ethical Hacking Tutor",
];

// Next EMP-#### code for an org — scans every employee (any status) so codes never collide
async function generateEmployeeCode(organizationId: string): Promise<string> {
  const rows = await prisma.employee.findMany({
    where: { organizationId },
    select: { employeeCode: true },
  });
  const taken = new Set(rows.map((r) => r.employeeCode));
  let max = 0;
  for (const r of rows) {
    const m = /^EMP-(\d+)$/i.exec(r.employeeCode.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  let n = max + 1;
  while (taken.has(`EMP-${String(n).padStart(4, "0")}`)) n += 1;
  return `EMP-${String(n).padStart(4, "0")}`;
}

const employeeSchema = z.object({
  employeeCode:  z.string().min(1).max(20).optional(), // blank → auto-generated (EMP-####)
  name:          z.string().min(1),
  email:         z.string().email().optional(),
  phone:         z.string().optional(),
  designation:   z.string().optional(),
  department:    z.string().optional(),
  employmentType:z.enum(["FULL_TIME","PART_TIME","CONTRACT","INTERN"]).default("FULL_TIME"),
  joiningDate:   z.string(),
  salaryType:    z.enum(["MONTHLY","DAILY","FIXED","UNPAID","INCENTIVE"]).default("MONTHLY"),
  basicSalary:   z.number().min(0).default(0),
  dailyRate:     z.number().min(0).optional(),
  hra:           z.number().min(0).default(0),
  allowances:    z.number().min(0).default(0),
  pfEnabled:     z.boolean().optional(),
  esiEnabled:    z.boolean().optional(),
  orgRole:       z.string().optional(), // MANAGEMENT | HR | PROJECT_MANAGER | TEAM_LEAD | EMPLOYEE
  userId:        z.string().optional(),
  bankAccount:   z.string().optional(),
  bankIfsc:      z.string().optional(),
  panNumber:     z.string().optional(),
  pfNumber:      z.string().optional(),
  esiNumber:     z.string().optional(),
  address:       z.string().optional(),
  notes:         z.string().optional(),
});

const attendanceSchema = z.object({
  employeeId: z.string(),
  date:       z.string(),
  status:     z.enum(["PRESENT","ABSENT","HALF_DAY","LEAVE","HOLIDAY"]).default("PRESENT"),
  checkIn:    z.string().optional(),
  checkOut:   z.string().optional(),
  notes:      z.string().optional(),
});

const payrollSchema = z.object({
  employeeId:  z.string(),
  month:       z.number().int().min(1).max(12),
  year:        z.number().int().min(2020),
  workingDays: z.number().int().default(26),
  presentDays: z.number().default(0),
  hra:         z.number().min(0).optional(),
  allowances:  z.number().min(0).optional(),
  deductions:  z.number().min(0).default(0),
  notes:       z.string().optional(),
});

const leaveSchema = z.object({
  employeeId: z.string(),
  leaveType:  z.string().default("Annual"),
  fromDate:   z.string(),
  toDate:     z.string(),
  reason:     z.string().optional(),
});

// ── Salary calculation helper ────────────────────────────────
function calcPayroll(emp: {
  salaryType: string; basicSalary: number; dailyRate: number | null;
  hra: number; allowances: number;
  pfEnabled?: boolean | null; esiEnabled?: boolean | null;
}, presentDays: number, workingDays: number, extraDeductions = 0,
  hrSettings?: { enableHRA?: boolean; enableAllowances?: boolean; enablePF?: boolean; enableESI?: boolean }
) {
  const useHRA        = hrSettings?.enableHRA        !== false;
  const useAllowances = hrSettings?.enableAllowances !== false;
  // Per-employee override: null/undefined → use org default; true/false → explicit
  const usePF  = emp.pfEnabled  != null ? emp.pfEnabled  : (hrSettings?.enablePF  !== false);
  const useESI = emp.esiEnabled != null ? emp.esiEnabled : (hrSettings?.enableESI !== false);

  const clampedDays  = Math.min(presentDays, workingDays);
  let basicEarned: number;
  if (emp.salaryType === "DAILY") {
    const rate = emp.dailyRate ?? emp.basicSalary;
    basicEarned = rate * clampedDays;
  } else {
    // MONTHLY — prorate by attendance
    const perDay = workingDays > 0 ? emp.basicSalary / workingDays : 0;
    basicEarned = perDay * clampedDays;
  }
  const ratio        = clampedDays / Math.max(workingDays, 1);
  const hraEarned    = useHRA        ? emp.hra        * ratio : 0;
  const allowEarned  = useAllowances ? emp.allowances * ratio : 0;
  const grossSalary  = basicEarned + hraEarned + allowEarned;
  const pfDeduction  = usePF  ? basicEarned * 0.12  : 0;
  const esiDeduction = useESI ? (grossSalary <= 21000 ? grossSalary * 0.0075 : 0) : 0;
  const netSalary    = grossSalary - pfDeduction - esiDeduction - extraDeductions;
  return { basicEarned, hraEarned, allowEarned, grossSalary, pfDeduction, esiDeduction, netSalary };
}

// ── Count attendance days for a month ────────────────────────
async function countAttendanceDays(employeeId: string, month: number, year: number) {
  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month, 0, 23, 59, 59);
  const rows = await prisma.attendance.findMany({
    where: { employeeId, date: { gte: from, lte: to } },
    select: { status: true },
  });
  let present = 0;
  for (const r of rows) {
    if (r.status === "PRESENT") present += 1;
    else if (r.status === "HALF_DAY") present += 0.5;
    else if (r.status === "LEAVE" || r.status === "HOLIDAY") present += 1; // paid leave/holiday count as present
  }
  return { presentDays: present, totalMarked: rows.length };
}

export async function listEmployees(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { search, department, status = "ACTIVE", page = "1", limit = "50" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { organizationId: req.organizationId!, status };
    if (department) where.department = department;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { employeeCode: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { designation: { contains: search, mode: "insensitive" } },
      ];
    }
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({ where, skip, take: parseInt(limit), orderBy: { name: "asc" } }),
      prisma.employee.count({ where }),
    ]);
    ok(res, { employees, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { serverError(res, e); }
}

export async function getEmployee(req: OrgRequest, res: Response): Promise<void> {
  try {
    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id as string, organizationId: req.organizationId! },
      include: {
        attendances:   { orderBy: { date: "desc" }, take: 60 },
        payrolls:      { orderBy: [{ year: "desc" }, { month: "desc" }], take: 24 },
        leaveRequests: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!emp) { notFound(res, "Employee not found"); return; }

    // Compute this-month attendance summary
    const now = new Date();
    const { presentDays, totalMarked } = await countAttendanceDays(emp.id, now.getMonth() + 1, now.getFullYear());

    ok(res, { ...emp, thisMonthPresent: presentDays, thisMonthMarked: totalMarked });
  } catch (e) { serverError(res, e); }
}

export async function createEmployee(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = employeeSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    // Employee code is auto-generated (EMP-####) when the client doesn't supply one
    const employeeCode = data.data.employeeCode?.trim()
      || await generateEmployeeCode(req.organizationId!);

    const exists = await prisma.employee.findUnique({
      where: { organizationId_employeeCode: { organizationId: req.organizationId!, employeeCode } },
    });
    if (exists) { badRequest(res, "Employee code already exists"); return; }

    const emp = await prisma.employee.create({
      data: { ...data.data, employeeCode, joiningDate: new Date(data.data.joiningDate), organizationId: req.organizationId! },
    });
    created(res, emp);
  } catch (e) { serverError(res, e); }
}

export async function updateEmployee(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = employeeSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const existing = await prisma.employee.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Employee not found"); return; }
    const emp = await prisma.employee.update({
      where: { id: req.params.id as string },
      data: { ...data.data, ...(data.data.joiningDate && { joiningDate: new Date(data.data.joiningDate) }) },
    });
    ok(res, emp);
  } catch (e) { serverError(res, e); }
}

const employeeLoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  jobRole:  z.string().min(1),
  modules:  z.array(z.string()).optional(),
});

// ── Create a login account for an existing employee (Owner/Admin only) ──
// Provisions User + OrganizationMember + module access, mirroring the
// admin "add employee" flow, and links it to this employee record.
export async function createEmployeeLogin(req: OrgRequest, res: Response): Promise<void> {
  try {
    if (req.memberRole !== MemberRole.OWNER && req.memberRole !== MemberRole.ADMIN) {
      forbidden(res, "Only the Owner or an Admin can create login accounts"); return;
    }
    const parsed = employeeLoginSchema.safeParse(req.body);
    if (!parsed.success) { badRequest(res, "Invalid data", parsed.error.flatten()); return; }
    const { email, password, jobRole, modules } = parsed.data;

    const preset = JOB_ROLES[jobRole];
    if (!preset) { badRequest(res, "A valid job role is required"); return; }
    const strength = isStrongPassword(password);
    if (!strength.ok) { badRequest(res, strength.reason || "Password is too weak"); return; }

    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id as string, organizationId: req.organizationId! },
    });
    if (!employee) { notFound(res, "Employee not found"); return; }
    if (employee.userId) { badRequest(res, "This employee already has a login account"); return; }

    const normalizedEmail = email.trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
      conflict(res, "A user with this email already exists"); return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! }, select: { enabledModules: true },
    });
    const orgModules = org?.enabledModules ?? [];
    let moduleKeys: string[] = preset.defaultModules === "ALL_ENABLED"
      ? orgModules
      : (modules && modules.length > 0 ? modules.filter((m) => orgModules.includes(m)) : [...preset.defaultModules]);
    if ((jobRole === "PROJECT_MANAGER" || jobRole === "EXECUTIVE") && orgModules.includes("WBA") && !moduleKeys.includes("WBA")) {
      moduleKeys = [...moduleKeys, "WBA"];
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: employee.name, email: normalizedEmail, password: hash, isActive: true, isEmailVerified: true },
      });
      await tx.organizationMember.create({
        data: { userId: user.id, organizationId: req.organizationId!, role: preset.memberRole },
      });
      if (moduleKeys.length > 0) {
        await tx.userModuleAccess.createMany({
          data: moduleKeys.map((moduleKey) => ({ userId: user.id, organizationId: req.organizationId!, moduleKey, grantedById: req.userId! })),
        });
      }
      await tx.employee.update({
        where: { id: employee.id },
        data: { userId: user.id, orgRole: jobRole, email: employee.email || normalizedEmail },
      });
      return user;
    });

    created(res, {
      userId: result.id, email: result.email, role: preset.memberRole, modules: moduleKeys,
    }, "Login account created");
  } catch (e) { serverError(res, e); }
}

export async function markAttendance(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = attendanceSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const emp = await prisma.employee.findFirst({ where: { id: data.data.employeeId, organizationId: req.organizationId! } });
    if (!emp) { notFound(res, "Employee not found"); return; }

    const date = new Date(data.data.date);
    const att  = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: data.data.employeeId, date } },
      create: {
        organizationId: req.organizationId!,
        employeeId: data.data.employeeId, date,
        status: data.data.status,
        checkIn:  data.data.checkIn  ? new Date(`${data.data.date}T${data.data.checkIn}`)  : undefined,
        checkOut: data.data.checkOut ? new Date(`${data.data.date}T${data.data.checkOut}`) : undefined,
        notes: data.data.notes,
      },
      update: {
        status: data.data.status,
        checkIn:  data.data.checkIn  ? new Date(`${data.data.date}T${data.data.checkIn}`)  : undefined,
        checkOut: data.data.checkOut ? new Date(`${data.data.date}T${data.data.checkOut}`) : undefined,
        notes: data.data.notes,
      },
    });
    ok(res, att);
  } catch (e) { serverError(res, e); }
}

export async function listAttendance(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { employeeId, month, year } = req.query as Record<string, string>;
    const where: any = { organizationId: req.organizationId! };
    if (employeeId) where.employeeId = employeeId;
    if (month && year) {
      const from = new Date(parseInt(year), parseInt(month) - 1, 1);
      const to   = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      where.date = { gte: from, lte: to };
    }
    const records = await prisma.attendance.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true } } },
      orderBy: { date: "desc" },
    });
    ok(res, records);
  } catch (e) { serverError(res, e); }
}

// ── Mark attendance in bulk (all employees, one date) ───────
export async function bulkMarkAttendance(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { date, records } = req.body as {
      date: string;
      records: Array<{ employeeId: string; status: string; checkIn?: string; checkOut?: string }>;
    };
    if (!date || !Array.isArray(records) || records.length === 0) {
      badRequest(res, "date and records[] are required"); return;
    }
    const results = await Promise.all(records.map(async (r) => {
      const emp = await prisma.employee.findFirst({ where: { id: r.employeeId, organizationId: req.organizationId! } });
      if (!emp) return null;
      return prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: r.employeeId, date: new Date(date) } },
        create: {
          organizationId: req.organizationId!, employeeId: r.employeeId, date: new Date(date),
          status: r.status as any,
          checkIn:  r.checkIn  ? new Date(`${date}T${r.checkIn}`)  : undefined,
          checkOut: r.checkOut ? new Date(`${date}T${r.checkOut}`) : undefined,
        },
        update: {
          status: r.status as any,
          checkIn:  r.checkIn  ? new Date(`${date}T${r.checkIn}`)  : undefined,
          checkOut: r.checkOut ? new Date(`${date}T${r.checkOut}`) : undefined,
        },
      });
    }));
    ok(res, { marked: results.filter(Boolean).length });
  } catch (e) { serverError(res, e); }
}

export async function generatePayroll(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = payrollSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }

    const emp = await prisma.employee.findFirst({ where: { id: data.data.employeeId, organizationId: req.organizationId! } });
    if (!emp) { notFound(res, "Employee not found"); return; }

    // Load org HR settings
    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! }, select: { complianceConfig: true } });
    const hrSettings = ((org?.complianceConfig as Record<string, any>)?.hrSettings) ?? {};

    const hraToUse        = data.data.hra        ?? emp.hra;
    const allowancesToUse = data.data.allowances ?? emp.allowances;
    const { basicEarned, grossSalary, pfDeduction, esiDeduction, netSalary } = calcPayroll(
      { salaryType: emp.salaryType, basicSalary: emp.basicSalary, dailyRate: emp.dailyRate, hra: hraToUse, allowances: allowancesToUse },
      data.data.presentDays, data.data.workingDays, data.data.deductions, hrSettings,
    );

    const payroll = await prisma.payroll.upsert({
      where: { employeeId_month_year: { employeeId: data.data.employeeId, month: data.data.month, year: data.data.year } },
      create: {
        organizationId: req.organizationId!,
        employeeId: data.data.employeeId,
        month: data.data.month, year: data.data.year,
        workingDays: data.data.workingDays, presentDays: data.data.presentDays,
        basicSalary: basicEarned, hra: hraToUse, allowances: allowancesToUse,
        deductions: data.data.deductions, pfDeduction, esiDeduction,
        grossSalary, netSalary, notes: data.data.notes,
      },
      update: {
        workingDays: data.data.workingDays, presentDays: data.data.presentDays,
        basicSalary: basicEarned, hra: hraToUse, allowances: allowancesToUse,
        deductions: data.data.deductions, pfDeduction, esiDeduction,
        grossSalary, netSalary, notes: data.data.notes,
      },
    });
    ok(res, payroll);
  } catch (e) { serverError(res, e); }
}

// ── Auto-generate payroll for ALL active employees ───────────
export async function autoGeneratePayroll(req: OrgRequest, res: Response): Promise<void> {
  try {
    const body = req.body as { month: number | string; year: number | string; workingDays?: number | string };
    const month = Number(body.month);
    const year  = Number(body.year);
    if (!month || !year) { badRequest(res, "month and year are required"); return; }

    // Load org HR settings — default working days from settings, override by request
    const org = await prisma.organization.findUnique({ where: { id: req.organizationId! }, select: { complianceConfig: true } });
    const hrSettings = ((org?.complianceConfig as Record<string, any>)?.hrSettings) ?? {};
    const defaultWD = Number(hrSettings.defaultWorkingDays) || 26;
    const workingDays = body.workingDays != null ? Number(body.workingDays) || defaultWD : defaultWD;

    // Fetch ALL employees — no status filter so we always show the count correctly
    const employees = await prisma.employee.findMany({
      where: { organizationId: req.organizationId!, status: "ACTIVE" },
    });

    if (employees.length === 0) {
      ok(res, { generated: 0, month, year, totalNetSalary: 0, payrolls: [] },
        "No active employees found. Make sure employees have status ACTIVE.");
      return;
    }

    const results = await Promise.all(employees.map(async (emp) => {
      const { presentDays } = await countAttendanceDays(emp.id, month, year);
      const { basicEarned, grossSalary, pfDeduction, esiDeduction, netSalary } = calcPayroll(
        { salaryType: emp.salaryType, basicSalary: emp.basicSalary, dailyRate: emp.dailyRate, hra: emp.hra, allowances: emp.allowances },
        presentDays, workingDays, 0, hrSettings,
      );
      return prisma.payroll.upsert({
        where: { employeeId_month_year: { employeeId: emp.id, month, year } },
        create: {
          organizationId: req.organizationId!, employeeId: emp.id,
          month, year, workingDays, presentDays,
          basicSalary: basicEarned, hra: emp.hra, allowances: emp.allowances,
          deductions: 0, pfDeduction, esiDeduction, grossSalary, netSalary,
        },
        update: {
          workingDays, presentDays,
          basicSalary: basicEarned, hra: emp.hra, allowances: emp.allowances,
          deductions: 0, pfDeduction, esiDeduction, grossSalary, netSalary,
        },
      });
    }));

    const totalNetSalary = results.reduce((s, p) => s + p.netSalary, 0);
    ok(res, {
      generated: results.length,
      month, year,
      totalNetSalary,
      payrolls: results,
    }, `Payroll auto-generated for ${results.length} employees`);
  } catch (e) { serverError(res, e); }
}

export async function listPayrolls(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { month, year, employeeId } = req.query as Record<string, string>;
    const where: any = { organizationId: req.organizationId! };
    if (month) where.month = parseInt(month);
    if (year)  where.year  = parseInt(year);
    if (employeeId) where.employeeId = employeeId;
    const payrolls = await prisma.payroll.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true, designation: true, salaryType: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    ok(res, payrolls);
  } catch (e) { serverError(res, e); }
}

export async function markPayrollPaid(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const payroll = await prisma.payroll.findFirst({ where: { id, organizationId: req.organizationId! } });
    if (!payroll) { notFound(res, "Payroll not found"); return; }
    const updated = await prisma.payroll.update({ where: { id }, data: { isPaid: true, paidAt: new Date() } });
    ok(res, updated, "Marked as paid");
  } catch (e) { serverError(res, e); }
}

export async function createLeaveRequest(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = leaveSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const from  = new Date(data.data.fromDate);
    const to    = new Date(data.data.toDate);
    const days  = Math.ceil((to.getTime() - from.getTime()) / (1000 * 86400)) + 1;
    const leave = await prisma.leaveRequest.create({
      data: {
        organizationId: req.organizationId!,
        employeeId: data.data.employeeId,
        leaveType: data.data.leaveType,
        fromDate: from, toDate: to, days,
        reason: data.data.reason,
      },
    });
    created(res, leave);
  } catch (e) { serverError(res, e); }
}

export async function updateLeaveStatus(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    const leave = await prisma.leaveRequest.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!leave) { notFound(res, "Leave request not found"); return; }
    const updated = await prisma.leaveRequest.update({ where: { id: req.params.id as string }, data: { status } });
    ok(res, updated);
  } catch (e) { serverError(res, e); }
}

export async function listLeaveRequests(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { employeeId, status } = req.query as Record<string, string>;
    const where: any = { organizationId: req.organizationId! };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true } } },
      orderBy: { createdAt: "desc" },
    });
    ok(res, leaves);
  } catch (e) { serverError(res, e); }
}

export async function getHRSummary(req: OrgRequest, res: Response): Promise<void> {
  try {
    const now = new Date();
    const [total, active, onLeave, depts, monthPayrollTotal] = await Promise.all([
      prisma.employee.count({ where: { organizationId: req.organizationId! } }),
      prisma.employee.count({ where: { organizationId: req.organizationId!, status: "ACTIVE" } }),
      prisma.leaveRequest.count({
        where: { organizationId: req.organizationId!, status: "APPROVED", fromDate: { lte: now }, toDate: { gte: now } },
      }),
      prisma.employee.groupBy({
        by: ["department"],
        where: { organizationId: req.organizationId!, status: "ACTIVE" },
        _count: true,
      }),
      prisma.payroll.aggregate({
        where: { organizationId: req.organizationId!, month: now.getMonth() + 1, year: now.getFullYear() },
        _sum: { netSalary: true },
      }),
    ]);
    ok(res, { total, active, onLeave, departments: depts, monthSalaryTotal: monthPayrollTotal._sum.netSalary || 0 });
  } catch (e) { serverError(res, e); }
}

// ─────────────────────────────────────────────────────────────
//  SHIFTS
// ─────────────────────────────────────────────────────────────

const shiftSchema = z.object({
  name:         z.string().min(1),
  startTime:    z.string(),
  endTime:      z.string(),
  workingHours: z.number().min(0).max(24).default(8),
  graceMins:    z.number().int().min(0).default(0),
  isActive:     z.boolean().default(true),
});

export async function listShifts(req: OrgRequest, res: Response): Promise<void> {
  try {
    const shifts = await prisma.shift.findMany({
      where: { organizationId: req.organizationId! },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: "asc" },
    });
    ok(res, shifts);
  } catch (e) { serverError(res, e); }
}

export async function createShift(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = shiftSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const shift = await prisma.shift.create({ data: { ...data.data, organizationId: req.organizationId! } });
    created(res, shift);
  } catch (e) { serverError(res, e); }
}

export async function updateShift(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = shiftSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const existing = await prisma.shift.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Shift not found"); return; }
    const shift = await prisma.shift.update({ where: { id: req.params.id as string }, data: data.data });
    ok(res, shift);
  } catch (e) { serverError(res, e); }
}

export async function deleteShift(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await prisma.shift.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Shift not found"); return; }
    await prisma.shift.delete({ where: { id: req.params.id as string } });
    ok(res, null, "Shift deleted");
  } catch (e) { serverError(res, e); }
}

export async function assignShift(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { employeeId, shiftId } = req.body as { employeeId: string; shiftId: string | null };
    const emp = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: req.organizationId! } });
    if (!emp) { notFound(res, "Employee not found"); return; }
    if (shiftId) {
      const shift = await prisma.shift.findFirst({ where: { id: shiftId, organizationId: req.organizationId! } });
      if (!shift) { notFound(res, "Shift not found"); return; }
    }
    const updated = await prisma.employee.update({ where: { id: employeeId }, data: { shiftId: shiftId ?? null } });
    ok(res, updated);
  } catch (e) { serverError(res, e); }
}

// ─────────────────────────────────────────────────────────────
//  LEAVE BALANCE
// ─────────────────────────────────────────────────────────────

const leaveBalanceSchema = z.object({
  employeeId: z.string(),
  year:       z.number().int(),
  leaveType:  z.string().min(1),
  allocated:  z.number().min(0).default(0),
  carried:    z.number().min(0).default(0),
});

export async function listLeaveBalances(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { employeeId, year } = req.query as Record<string, string>;
    const where: any = { organizationId: req.organizationId! };
    if (employeeId) where.employeeId = employeeId;
    if (year) where.year = parseInt(year);
    const balances = await prisma.leaveBalance.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true } } },
      orderBy: [{ employee: { name: "asc" } }, { leaveType: "asc" }],
    });
    ok(res, balances);
  } catch (e) { serverError(res, e); }
}

export async function upsertLeaveBalance(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = leaveBalanceSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const emp = await prisma.employee.findFirst({ where: { id: data.data.employeeId, organizationId: req.organizationId! } });
    if (!emp) { notFound(res, "Employee not found"); return; }
    const balance = await prisma.leaveBalance.upsert({
      where: { employeeId_year_leaveType: { employeeId: data.data.employeeId, year: data.data.year, leaveType: data.data.leaveType } },
      create: { ...data.data, organizationId: req.organizationId! },
      update: { allocated: data.data.allocated, carried: data.data.carried },
    });
    ok(res, balance);
  } catch (e) { serverError(res, e); }
}

// ─────────────────────────────────────────────────────────────
//  PERFORMANCE GOALS
// ─────────────────────────────────────────────────────────────

const goalSchema = z.object({
  employeeId:  z.string(),
  title:       z.string().min(1),
  description: z.string().optional(),
  category:    z.string().default("Individual"),
  targetDate:  z.string().optional(),
  progress:    z.number().int().min(0).max(100).default(0),
  status:      z.enum(["IN_PROGRESS","COMPLETED","ON_HOLD","CANCELLED"]).default("IN_PROGRESS"),
  year:        z.number().int(),
  quarter:     z.number().int().min(1).max(4).optional(),
});

export async function listPerformanceGoals(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { employeeId, year, quarter, status } = req.query as Record<string, string>;
    const where: any = { organizationId: req.organizationId! };
    if (employeeId) where.employeeId = employeeId;
    if (year) where.year = parseInt(year);
    if (quarter) where.quarter = parseInt(quarter);
    if (status) where.status = status;
    const goals = await prisma.performanceGoal.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true, designation: true } } },
      orderBy: { createdAt: "desc" },
    });
    ok(res, goals);
  } catch (e) { serverError(res, e); }
}

export async function createPerformanceGoal(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = goalSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const emp = await prisma.employee.findFirst({ where: { id: data.data.employeeId, organizationId: req.organizationId! } });
    if (!emp) { notFound(res, "Employee not found"); return; }
    const goal = await prisma.performanceGoal.create({
      data: {
        ...data.data,
        targetDate: data.data.targetDate ? new Date(data.data.targetDate) : undefined,
        organizationId: req.organizationId!,
      },
    });
    created(res, goal);
  } catch (e) { serverError(res, e); }
}

export async function updatePerformanceGoal(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = goalSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const existing = await prisma.performanceGoal.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Goal not found"); return; }
    const goal = await prisma.performanceGoal.update({
      where: { id: req.params.id as string },
      data: { ...data.data, ...(data.data.targetDate && { targetDate: new Date(data.data.targetDate) }) },
    });
    ok(res, goal);
  } catch (e) { serverError(res, e); }
}

export async function deletePerformanceGoal(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await prisma.performanceGoal.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Goal not found"); return; }
    await prisma.performanceGoal.delete({ where: { id: req.params.id as string } });
    ok(res, null, "Goal deleted");
  } catch (e) { serverError(res, e); }
}

// ─────────────────────────────────────────────────────────────
//  PERFORMANCE REVIEWS
// ─────────────────────────────────────────────────────────────

const reviewSchema = z.object({
  employeeId:   z.string(),
  reviewType:   z.enum(["ANNUAL","QUARTERLY","PROBATION","MID_YEAR"]).default("ANNUAL"),
  reviewPeriod: z.string(),
  rating:       z.number().min(0).max(5).optional(),
  selfRating:   z.number().min(0).max(5).optional(),
  status:       z.enum(["DRAFT","IN_REVIEW","COMPLETED"]).default("DRAFT"),
  strengths:    z.string().optional(),
  improvements: z.string().optional(),
  comments:     z.string().optional(),
  reviewDate:   z.string().optional(),
});

export async function listPerformanceReviews(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { employeeId, status, reviewType } = req.query as Record<string, string>;
    const where: any = { organizationId: req.organizationId! };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (reviewType) where.reviewType = reviewType;
    const reviews = await prisma.performanceReview.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true, designation: true, department: true } } },
      orderBy: { reviewDate: "desc" },
    });
    ok(res, reviews);
  } catch (e) { serverError(res, e); }
}

export async function createPerformanceReview(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = reviewSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const emp = await prisma.employee.findFirst({ where: { id: data.data.employeeId, organizationId: req.organizationId! } });
    if (!emp) { notFound(res, "Employee not found"); return; }
    const review = await prisma.performanceReview.create({
      data: {
        ...data.data,
        reviewDate: data.data.reviewDate ? new Date(data.data.reviewDate) : new Date(),
        organizationId: req.organizationId!,
      },
    });
    created(res, review);
  } catch (e) { serverError(res, e); }
}

export async function updatePerformanceReview(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = reviewSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const existing = await prisma.performanceReview.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Review not found"); return; }
    const review = await prisma.performanceReview.update({
      where: { id: req.params.id as string },
      data: { ...data.data, ...(data.data.reviewDate && { reviewDate: new Date(data.data.reviewDate) }) },
    });
    ok(res, review);
  } catch (e) { serverError(res, e); }
}

// ─────────────────────────────────────────────────────────────
//  EXPENSES
// ─────────────────────────────────────────────────────────────

const expenseSchema = z.object({
  employeeId:  z.string(),
  expenseDate: z.string(),
  category:    z.string().min(1),
  title:       z.string().min(1),
  amount:      z.number().min(0),
  currency:    z.string().default("INR"),
  receiptUrl:  z.string().optional(),
  notes:       z.string().optional(),
});

export async function listExpenses(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { employeeId, status, category } = req.query as Record<string, string>;
    const where: any = { organizationId: req.organizationId! };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (category) where.category = category;
    const expenses = await prisma.expense.findMany({
      where,
      include: { employee: { select: { id: true, name: true, employeeCode: true, department: true } } },
      orderBy: { createdAt: "desc" },
    });
    ok(res, expenses);
  } catch (e) { serverError(res, e); }
}

export async function createExpense(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = expenseSchema.safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const emp = await prisma.employee.findFirst({ where: { id: data.data.employeeId, organizationId: req.organizationId! } });
    if (!emp) { notFound(res, "Employee not found"); return; }
    const expense = await prisma.expense.create({
      data: { ...data.data, expenseDate: new Date(data.data.expenseDate), organizationId: req.organizationId! },
    });
    created(res, expense);
  } catch (e) { serverError(res, e); }
}

export async function updateExpense(req: OrgRequest, res: Response): Promise<void> {
  try {
    const data = expenseSchema.partial().safeParse(req.body);
    if (!data.success) { badRequest(res, "Invalid data", data.error.flatten()); return; }
    const existing = await prisma.expense.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Expense not found"); return; }
    if (existing.status !== "PENDING") { badRequest(res, "Only pending expenses can be edited"); return; }
    const expense = await prisma.expense.update({
      where: { id: req.params.id as string },
      data: { ...data.data, ...(data.data.expenseDate && { expenseDate: new Date(data.data.expenseDate) }) },
    });
    ok(res, expense);
  } catch (e) { serverError(res, e); }
}

export async function approveExpense(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await prisma.expense.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Expense not found"); return; }
    const expense = await prisma.expense.update({
      where: { id: req.params.id as string },
      data: { status: "APPROVED", approvedById: req.userId!, approvedAt: new Date() },
    });
    ok(res, expense, "Expense approved");
  } catch (e) { serverError(res, e); }
}

export async function rejectExpense(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await prisma.expense.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Expense not found"); return; }
    const expense = await prisma.expense.update({
      where: { id: req.params.id as string },
      data: { status: "REJECTED" },
    });
    ok(res, expense, "Expense rejected");
  } catch (e) { serverError(res, e); }
}

export async function markExpensePaid(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await prisma.expense.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Expense not found"); return; }
    if (existing.status !== "APPROVED") { badRequest(res, "Only approved expenses can be marked as paid"); return; }
    const expense = await prisma.expense.update({
      where: { id: req.params.id as string },
      data: { status: "PAID", paidAt: new Date() },
    });
    ok(res, expense, "Expense marked as paid");
  } catch (e) { serverError(res, e); }
}

// ─────────────────────────────────────────────────────────────
//  PAYSLIP (structured data for frontend PDF rendering)
// ─────────────────────────────────────────────────────────────

export async function getPayslip(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { employeeId, month, year } = req.query as Record<string, string>;
    if (!employeeId || !month || !year) { badRequest(res, "employeeId, month and year are required"); return; }

    const [emp, payroll, org] = await Promise.all([
      prisma.employee.findFirst({
        where: { id: employeeId, organizationId: req.organizationId! },
        include: { shift: true },
      }),
      prisma.payroll.findUnique({
        where: { employeeId_month_year: { employeeId, month: parseInt(month), year: parseInt(year) } },
      }),
      prisma.organization.findUnique({ where: { id: req.organizationId! } }),
    ]);

    if (!emp) { notFound(res, "Employee not found"); return; }
    if (!payroll) { notFound(res, "Payroll record not found for this period"); return; }

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const ptDeduction = payroll.grossSalary > 15000 ? 200 : payroll.grossSalary > 10000 ? 150 : 0;
    const tdsDeduction = 0; // simplified — no TDS calc here

    ok(res, {
      org: { name: org?.name, address: org?.address, city: org?.city, state: org?.state, pan: org?.panNumber },
      employee: {
        id: emp.id, name: emp.name, code: emp.employeeCode,
        designation: emp.designation, department: emp.department,
        email: emp.email, phone: emp.phone,
        pan: emp.panNumber, pf: emp.pfNumber, esi: emp.esiNumber,
        bankAccount: emp.bankAccount, bankIfsc: emp.bankIfsc,
        joinDate: emp.joiningDate,
      },
      period: { month: parseInt(month), year: parseInt(year), label: `${monthNames[parseInt(month) - 1]} ${year}` },
      attendance: { workingDays: payroll.workingDays, presentDays: payroll.presentDays },
      earnings: {
        basic: payroll.basicSalary,
        hra: payroll.hra,
        allowances: payroll.allowances,
        gross: payroll.grossSalary,
      },
      deductions: {
        pf: payroll.pfDeduction,
        esi: payroll.esiDeduction,
        pt: ptDeduction,
        tds: tdsDeduction,
        other: payroll.deductions,
        total: payroll.pfDeduction + payroll.esiDeduction + ptDeduction + tdsDeduction + payroll.deductions,
      },
      netSalary: payroll.netSalary - ptDeduction,
      isPaid: payroll.isPaid,
      paidAt: payroll.paidAt,
    });
  } catch (e) { serverError(res, e); }
}

// ── Get current user's employee profile (matched by email) ──
export async function getMyProfile(req: OrgRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } });
    if (!user) { notFound(res, "User not found"); return; }

    const emp = await prisma.employee.findFirst({
      where: {
        organizationId: req.organizationId!,
        OR: [{ email: user.email }, { userId: req.userId! }],
      },
      include: {
        projectMembers: {
          include: { project: { select: { id: true, name: true, status: true, endDate: true } } },
        },
      },
    });
    ok(res, emp ?? null);
  } catch (e) { serverError(res, e); }
}

// ── Return available designation options ────────────────────
export async function getDesignations(req: OrgRequest, res: Response): Promise<void> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: { id: true, slug: true, name: true },
    });
    ok(res, isWBAOrg(org) ? WBA_DESIGNATION_OPTIONS : DESIGNATION_OPTIONS);
  } catch (e) { serverError(res, e); }
}

// ── Delete employee ─────────────────────────────────────────
export async function deleteEmployee(req: OrgRequest, res: Response): Promise<void> {
  try {
    const existing = await prisma.employee.findFirst({ where: { id: req.params.id as string, organizationId: req.organizationId! } });
    if (!existing) { notFound(res, "Employee not found"); return; }
    await prisma.employee.update({ where: { id: req.params.id as string }, data: { status: "TERMINATED" } });
    ok(res, null, "Employee terminated");
  } catch (e) { serverError(res, e); }
}
