/**
 * Deployra Demo Seed
 *
 * Creates a BRAND NEW organisation "Deployra" with a complete HR/PM hierarchy:
 *
 *   Org Owner  : Vikram Nair        (admin@deployra.com)
 *   HR Manager : Priya Sharma       (hr@deployra.com)
 *   PM         : Arjun Mehta        (pm@deployra.com)
 *   TL Backend : Rahul Verma        (tl.rahul@deployra.com)
 *   TL Frontend: Sneha Kapoor       (tl.sneha@deployra.com)
 *   5 Backend devs + 5 Frontend devs
 *
 * Hierarchy: Employee → TL → PM → Admin/Management
 *            HR manages all employee profiles
 *
 * Run:
 *   cd backend && npx ts-node --transpile-only src/prisma/seedDemo.ts
 */

import { PrismaClient, MemberRole, ProjectMemberRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();
const PW_HASH = bcrypt.hashSync("Demo@1234", 10);

// ── helpers ──────────────────────────────────────────────────────────────────

async function upsertUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: { email, name, password: PW_HASH, isEmailVerified: true },
  });
}

async function addMember(orgId: string, userId: string, role: MemberRole) {
  return prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId, organizationId: orgId } },
    create: { userId, organizationId: orgId, role },
    update: { role },
  });
}

async function grantModule(orgId: string, userId: string, moduleKey: string) {
  return prisma.userModuleAccess.upsert({
    where: { userId_organizationId_moduleKey: { userId, organizationId: orgId, moduleKey } },
    create: { userId, organizationId: orgId, moduleKey },
    update: {},
  });
}

let empSeq = 1;
function nextCode() { return `DPL${String(empSeq++).padStart(3, "0")}`; }

async function makeEmployee(args: {
  orgId: string; userId: string; name: string; email: string;
  designation: string; department: string; orgRole: string;
  basicSalary: number; hra?: number; allowances?: number;
  pfEnabled?: boolean; esiEnabled?: boolean;
  joiningDate?: string;
}) {
  const sharedData = {
    organizationId: args.orgId,
    userId: args.userId,
    name: args.name,
    designation: args.designation,
    department: args.department,
    orgRole: args.orgRole,
    basicSalary: args.basicSalary,
    hra: args.hra ?? Math.round(args.basicSalary * 0.4),
    allowances: args.allowances ?? 2500,
    salaryType: "MONTHLY" as const,
    employmentType: "FULL_TIME" as const,
    status: "ACTIVE" as const,
    pfEnabled: args.pfEnabled ?? true,
    esiEnabled: args.esiEnabled ?? false,
    joiningDate: new Date(args.joiningDate ?? "2025-03-01"),
  };
  const existing = await prisma.employee.findFirst({
    where: { organizationId: args.orgId, email: args.email },
  });
  if (existing) {
    return prisma.employee.update({ where: { id: existing.id }, data: sharedData });
  }
  return prisma.employee.create({
    data: { ...sharedData, email: args.email, employeeCode: nextCode() },
  });
}

async function addProjectMember(projectId: string, employeeId: string, role: ProjectMemberRole) {
  return prisma.projectMember.upsert({
    where: { projectId_employeeId: { projectId, employeeId } },
    create: { projectId, employeeId, role },
    update: { role },
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(65));
  console.log(" 🌱  Deployra Demo Seed");
  console.log("═".repeat(65) + "\n");

  // ── 0. Organisation ────────────────────────────────────────────────────────
  let org = await prisma.organization.findFirst({ where: { slug: "deployra" } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Deployra",
        slug: "deployra",
        businessType: "IT_SOFTWARE",
        email: "admin@deployra.com",
        phone: "9800000001",
        city: "Bangalore",
        state: "Karnataka",
        country: "IN",
        currency: "INR",
        enabledModules: ["HR", "PROJECTS", "CRM"],
        plan: "PRO",
        complianceConfig: {
          hrSettings: {
            enableHRA: true,
            enableAllowances: true,
            enablePF: true,
            enableESI: false,
            defaultWorkingDays: 26,
          },
        },
      },
    });
    console.log(`✅  Created organisation: "${org.name}" (${org.id})`);
  } else {
    console.log(`ℹ️   Organisation exists: "${org.name}" (${org.id})`);
    // ensure modules are enabled
    await prisma.organization.update({
      where: { id: org.id },
      data: { enabledModules: ["HR", "PROJECTS", "CRM"] },
    });
  }
  const orgId = org.id;

  // ── 1. Admin / Owner ───────────────────────────────────────────────────────
  console.log("\n── Creating People ─────────────────────────────────────────");
  const adminUser = await upsertUser("admin@deployra.com", "Vikram Nair");
  await addMember(orgId, adminUser.id, MemberRole.OWNER);
  const adminEmp = await makeEmployee({
    orgId, userId: adminUser.id,
    name: "Vikram Nair", email: "admin@deployra.com",
    designation: "CEO", department: "Management",
    orgRole: "MANAGEMENT", basicSalary: 150000, hra: 60000, allowances: 10000,
    joiningDate: "2024-01-01",
  });
  console.log(`  [OWNER] ${adminEmp.name} (${adminEmp.employeeCode})  →  admin@deployra.com / Demo@1234`);

  // ── 2. HR Manager ──────────────────────────────────────────────────────────
  const hrUser = await upsertUser("hr@deployra.com", "Priya Sharma");
  await addMember(orgId, hrUser.id, MemberRole.MANAGER);
  await grantModule(orgId, hrUser.id, "HR");
  await grantModule(orgId, hrUser.id, "PROJECTS");
  const hrEmp = await makeEmployee({
    orgId, userId: hrUser.id,
    name: "Priya Sharma", email: "hr@deployra.com",
    designation: "HR Manager", department: "Human Resources",
    orgRole: "HR", basicSalary: 70000, hra: 28000, allowances: 3000,
    joiningDate: "2024-03-01",
  });
  console.log(`  [HR]    ${hrEmp.name} (${hrEmp.employeeCode})  →  hr@deployra.com / Demo@1234`);

  // ── 3. Project Manager ─────────────────────────────────────────────────────
  const pmUser = await upsertUser("pm@deployra.com", "Arjun Mehta");
  await addMember(orgId, pmUser.id, MemberRole.STAFF);
  await grantModule(orgId, pmUser.id, "PROJECTS");
  const pmEmp = await makeEmployee({
    orgId, userId: pmUser.id,
    name: "Arjun Mehta", email: "pm@deployra.com",
    designation: "Project Manager", department: "Engineering",
    orgRole: "PROJECT_MANAGER", basicSalary: 95000, hra: 38000, allowances: 4000,
    joiningDate: "2024-06-01",
  });
  console.log(`  [PM]    ${pmEmp.name} (${pmEmp.employeeCode})  →  pm@deployra.com / Demo@1234`);

  // ── 4. Team Lead — Backend ─────────────────────────────────────────────────
  const tl1User = await upsertUser("tl.rahul@deployra.com", "Rahul Verma");
  await addMember(orgId, tl1User.id, MemberRole.STAFF);
  await grantModule(orgId, tl1User.id, "PROJECTS");
  const tl1Emp = await makeEmployee({
    orgId, userId: tl1User.id,
    name: "Rahul Verma", email: "tl.rahul@deployra.com",
    designation: "Tech Lead", department: "Backend",
    orgRole: "TEAM_LEAD", basicSalary: 80000, hra: 32000, allowances: 3500,
    joiningDate: "2024-07-01",
  });
  console.log(`  [TL-BE] ${tl1Emp.name} (${tl1Emp.employeeCode})  →  tl.rahul@deployra.com / Demo@1234`);

  // ── 5. Team Lead — Frontend ────────────────────────────────────────────────
  const tl2User = await upsertUser("tl.sneha@deployra.com", "Sneha Kapoor");
  await addMember(orgId, tl2User.id, MemberRole.STAFF);
  await grantModule(orgId, tl2User.id, "PROJECTS");
  const tl2Emp = await makeEmployee({
    orgId, userId: tl2User.id,
    name: "Sneha Kapoor", email: "tl.sneha@deployra.com",
    designation: "Tech Lead", department: "Frontend",
    orgRole: "TEAM_LEAD", basicSalary: 78000, hra: 31200, allowances: 3500,
    joiningDate: "2024-07-15",
  });
  console.log(`  [TL-FE] ${tl2Emp.name} (${tl2Emp.employeeCode})  →  tl.sneha@deployra.com / Demo@1234`);

  // ── 6. Backend Team (5 devs under TL1) ────────────────────────────────────
  console.log("\n  ── Backend Team (reports to Rahul Verma) ───────────────");
  type DevSpec = { name: string; email: string; desig: string; dept: string; salary: number; role: ProjectMemberRole; };
  const backendSpecs: DevSpec[] = [
    { name: "Karan Singh",   email: "karan@deployra.com",   desig: "Senior Developer",    dept: "Backend",  salary: 62000, role: "BACKEND_DEV"    },
    { name: "Meena Patel",   email: "meena@deployra.com",   desig: "Backend Developer",   dept: "Backend",  salary: 52000, role: "BACKEND_DEV"    },
    { name: "Ravi Joshi",    email: "ravi@deployra.com",    desig: "Full Stack Developer", dept: "Backend",  salary: 58000, role: "FULLSTACK_DEV"  },
    { name: "Anjali Nair",   email: "anjali@deployra.com",  desig: "DevOps Engineer",     dept: "Backend",  salary: 60000, role: "DEVOPS_ENGINEER" },
    { name: "Vikas Kumar",   email: "vikas@deployra.com",   desig: "QA Engineer",         dept: "Backend",  salary: 48000, role: "QA_ENGINEER"    },
  ];
  const backendEmps: Awaited<ReturnType<typeof makeEmployee>>[] = [];
  for (const s of backendSpecs) {
    const u = await upsertUser(s.email, s.name);
    await addMember(orgId, u.id, MemberRole.STAFF);
    await grantModule(orgId, u.id, "PROJECTS");
    const e = await makeEmployee({
      orgId, userId: u.id, name: s.name, email: s.email,
      designation: s.desig, department: s.dept,
      orgRole: "EMPLOYEE", basicSalary: s.salary,
      joiningDate: "2025-01-15",
    });
    backendEmps.push(e);
    console.log(`    ${e.name} (${e.employeeCode})  →  ${s.email}`);
  }

  // ── 7. Frontend Team (5 devs under TL2) ───────────────────────────────────
  console.log("\n  ── Frontend Team (reports to Sneha Kapoor) ─────────────");
  const frontendSpecs: DevSpec[] = [
    { name: "Pooja Reddy",    email: "pooja@deployra.com",   desig: "Frontend Developer",  dept: "Frontend", salary: 52000, role: "FRONTEND_DEV"  },
    { name: "Aditya Shah",    email: "aditya@deployra.com",  desig: "UI/UX Designer",      dept: "Frontend", salary: 55000, role: "UI_UX_DESIGNER" },
    { name: "Nisha Gupta",    email: "nisha@deployra.com",   desig: "React Developer",     dept: "Frontend", salary: 50000, role: "FRONTEND_DEV"   },
    { name: "Suresh Yadav",   email: "suresh@deployra.com",  desig: "Full Stack Developer", dept: "Frontend", salary: 56000, role: "FULLSTACK_DEV" },
    { name: "Divya Malhotra", email: "divya@deployra.com",   desig: "QA Engineer",         dept: "Frontend", salary: 46000, role: "QA_ENGINEER"   },
  ];
  const frontendEmps: Awaited<ReturnType<typeof makeEmployee>>[] = [];
  for (const s of frontendSpecs) {
    const u = await upsertUser(s.email, s.name);
    await addMember(orgId, u.id, MemberRole.STAFF);
    await grantModule(orgId, u.id, "PROJECTS");
    const e = await makeEmployee({
      orgId, userId: u.id, name: s.name, email: s.email,
      designation: s.desig, department: s.dept,
      orgRole: "EMPLOYEE", basicSalary: s.salary,
      joiningDate: "2025-01-15",
    });
    frontendEmps.push(e);
    console.log(`    ${e.name} (${e.employeeCode})  →  ${s.email}`);
  }

  // ── 8. Project: Deployra Cloud Platform ───────────────────────────────────
  console.log("\n── Creating Project ─────────────────────────────────────────");
  let project = await prisma.project.findFirst({
    where: { organizationId: orgId, name: "Deployra Cloud Platform v1.0" },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        organizationId: orgId,
        name: "Deployra Cloud Platform v1.0",
        description:
          "End-to-end SaaS platform with multi-tenant architecture, real-time dashboards, " +
          "REST APIs, and a React frontend. Target launch: Q4 2026.",
        status: "ACTIVE",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-12-31"),
        budget: 3500000,
      },
    });
  }
  console.log(`  ✅  "${project.name}"`);
  console.log(`      Status: ACTIVE  |  Deadline: 31 Dec 2026  |  Budget: ₹35,00,000`);

  // ── 9. Project Members ────────────────────────────────────────────────────
  console.log("\n── Assigning Project Members ────────────────────────────────");
  await addProjectMember(project.id, pmEmp.id,  "PROJECT_MANAGER");
  await addProjectMember(project.id, tl1Emp.id, "TECH_LEAD");
  await addProjectMember(project.id, tl2Emp.id, "TECH_LEAD");

  for (let i = 0; i < backendEmps.length; i++) {
    await addProjectMember(project.id, backendEmps[i].id, backendSpecs[i].role);
  }
  for (let i = 0; i < frontendEmps.length; i++) {
    await addProjectMember(project.id, frontendEmps[i].id, frontendSpecs[i].role);
  }
  console.log("  ✅  PM + 2 Tech Leads + 10 developers assigned");

  // ── 10. Tasks (realistic spread — ~43% done) ─────────────────────────────
  console.log("\n── Creating Tasks ───────────────────────────────────────────");

  const today = new Date();
  const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
  const daysFromNow = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };

  type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
  type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

  interface TaskDef {
    title: string; assignedToId: string; status: TaskStatus;
    priority: TaskPriority; dueDate: Date; notes?: string;
  }

  const taskDefs: TaskDef[] = [
    // ─── Backend tasks (Backend TL coordinates) ───────────────────────────
    { title: "Architecture design & tech stack selection",
      assignedToId: tl1Emp.id,       status: "DONE",        priority: "URGENT", dueDate: daysAgo(60) },
    { title: "PostgreSQL schema design & Prisma setup",
      assignedToId: backendEmps[0].id, status: "DONE",      priority: "HIGH",   dueDate: daysAgo(45) },
    { title: "User authentication & JWT service",
      assignedToId: backendEmps[0].id, status: "DONE",      priority: "HIGH",   dueDate: daysAgo(30) },
    { title: "Multi-tenant organisation management API",
      assignedToId: backendEmps[1].id, status: "DONE",      priority: "HIGH",   dueDate: daysAgo(20) },
    { title: "REST API for HR module",
      assignedToId: backendEmps[2].id, status: "IN_PROGRESS", priority: "HIGH", dueDate: daysFromNow(14) },
    { title: "CI/CD pipeline with GitHub Actions",
      assignedToId: backendEmps[3].id, status: "DONE",      priority: "MEDIUM", dueDate: daysAgo(10) },
    { title: "Containerisation with Docker & K8s config",
      assignedToId: backendEmps[3].id, status: "IN_PROGRESS", priority: "HIGH", dueDate: daysFromNow(21) },
    { title: "REST API load & performance testing",
      assignedToId: backendEmps[4].id, status: "IN_REVIEW", priority: "MEDIUM", dueDate: daysFromNow(7) },
    { title: "Project management module backend APIs",
      assignedToId: backendEmps[0].id, status: "TODO",      priority: "HIGH",   dueDate: daysFromNow(30) },
    { title: "Payroll & HR computation engine",
      assignedToId: backendEmps[1].id, status: "TODO",      priority: "MEDIUM", dueDate: daysFromNow(40) },
    { title: "WebSocket real-time notifications",
      assignedToId: backendEmps[2].id, status: "TODO",      priority: "MEDIUM", dueDate: daysFromNow(50) },
    { title: "API gateway rate-limiting & security hardening",
      assignedToId: tl1Emp.id,       status: "TODO",        priority: "HIGH",   dueDate: daysFromNow(35) },

    // ─── Frontend tasks (Frontend TL coordinates) ──────────────────────────
    { title: "Design system & component library (Figma)",
      assignedToId: frontendEmps[1].id, status: "DONE",     priority: "HIGH",   dueDate: daysAgo(50) },
    { title: "Vite + React + Tailwind project scaffold",
      assignedToId: tl2Emp.id,         status: "DONE",      priority: "URGENT", dueDate: daysAgo(55) },
    { title: "Auth pages — Login, Register, Forgot Password",
      assignedToId: frontendEmps[0].id, status: "DONE",     priority: "HIGH",   dueDate: daysAgo(35) },
    { title: "Organisation dashboard UI",
      assignedToId: frontendEmps[2].id, status: "DONE",     priority: "HIGH",   dueDate: daysAgo(25) },
    { title: "HR module frontend screens",
      assignedToId: frontendEmps[0].id, status: "IN_PROGRESS", priority: "HIGH", dueDate: daysFromNow(10) },
    { title: "PM dashboard & project tracker screens",
      assignedToId: frontendEmps[3].id, status: "IN_PROGRESS", priority: "HIGH", dueDate: daysFromNow(18) },
    { title: "Mobile-responsive layouts across all pages",
      assignedToId: frontendEmps[2].id, status: "TODO",     priority: "MEDIUM", dueDate: daysFromNow(45) },
    { title: "E2E test suite (Playwright)",
      assignedToId: frontendEmps[4].id, status: "IN_REVIEW", priority: "MEDIUM", dueDate: daysFromNow(12) },
    { title: "CRM module UI — party, contacts, deals",
      assignedToId: frontendEmps[0].id, status: "TODO",     priority: "MEDIUM", dueDate: daysFromNow(55) },
    { title: "Dark / light theme & branding system",
      assignedToId: frontendEmps[1].id, status: "TODO",     priority: "LOW",    dueDate: daysFromNow(60) },
    { title: "Reports & analytics charts (Recharts)",
      assignedToId: frontendEmps[3].id, status: "TODO",     priority: "MEDIUM", dueDate: daysFromNow(65) },
    { title: "Accessibility (a11y) audit & fixes",
      assignedToId: tl2Emp.id,         status: "TODO",      priority: "LOW",    dueDate: daysFromNow(70) },
  ];

  // Only insert tasks that don't exist yet
  const existingTasks = await prisma.task.findMany({ where: { projectId: project.id }, select: { title: true } });
  const existingTitles = new Set(existingTasks.map((t) => t.title));

  let created = 0;
  for (const t of taskDefs) {
    if (existingTitles.has(t.title)) continue;
    await prisma.task.create({
      data: {
        organizationId: orgId,
        projectId: project.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignedToId: t.assignedToId,
        dueDate: t.dueDate,
        ...(t.status === "DONE" && { completedAt: t.dueDate }),
      },
    });
    created++;
  }
  const totalTasks = taskDefs.length;
  const doneTasks  = taskDefs.filter((t) => t.status === "DONE").length;
  const progress   = Math.round((doneTasks / totalTasks) * 100);
  console.log(`  ✅  ${created} tasks created  (${totalTasks} total · ${doneTasks} DONE · ${progress}% complete)`);

  // ── 11. Leave balances for each employee ──────────────────────────────────
  console.log("\n── Setting Leave Balances ────────────────────────────────────");
  const allEmps = [hrEmp, pmEmp, tl1Emp, tl2Emp, ...backendEmps, ...frontendEmps];
  const year = new Date().getFullYear();
  for (const emp of allEmps) {
    for (const { type, allocated } of [
      { type: "ANNUAL",   allocated: 18 },
      { type: "SICK",     allocated: 7 },
      { type: "CASUAL",   allocated: 6 },
    ]) {
      await prisma.leaveBalance.upsert({
        where: { employeeId_year_leaveType: { employeeId: emp.id, year, leaveType: type } },
        create: { organizationId: orgId, employeeId: emp.id, leaveType: type, year, allocated, used: 0 },
        update: {},
      });
    }
  }
  console.log(`  ✅  Annual / Sick / Casual leave balances set for ${allEmps.length} employees`);

  // ── 12. Sample attendance for this month ─────────────────────────────────
  console.log("\n── Seeding Attendance (current month) ───────────────────────");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const today2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let attCount = 0;

  for (const emp of allEmps) {
    for (let d = new Date(monthStart); d <= today2; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

      // Create separate immutable date objects to avoid mutation bugs
      const dateOnly   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const checkInDt  = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0, 0);
      const checkOutDt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 30, 0, 0);

      const existing = await prisma.attendance.findFirst({
        where: { employeeId: emp.id, date: dateOnly },
      });
      if (existing) continue;

      const roll = Math.random();
      const status = roll < 0.05 ? "LEAVE" : roll < 0.10 ? "HALF_DAY" : "PRESENT";
      await prisma.attendance.create({
        data: {
          organizationId: orgId,
          employeeId: emp.id,
          date: dateOnly,
          status,
          checkIn:  status === "LEAVE" ? undefined : checkInDt,
          checkOut: status === "LEAVE" ? undefined : checkOutDt,
        },
      });
      attCount++;
    }
  }
  console.log(`  ✅  ${attCount} attendance records created`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(65));
  console.log(" 🎉  DEPLOYRA DEMO SEEDED SUCCESSFULLY");
  console.log("═".repeat(65));
  console.log(`
  Organisation  : Deployra
  Login URL     : http://localhost:5173
  Password      : Demo@1234  (all accounts)

  ┌─────────────────┬──────────────────┬──────────────────────────┐
  │ Role            │ Name             │ Email                    │
  ├─────────────────┼──────────────────┼──────────────────────────┤
  │ Admin / Owner   │ Vikram Nair      │ admin@deployra.com       │
  │ HR Manager      │ Priya Sharma     │ hr@deployra.com          │
  │ Project Manager │ Arjun Mehta      │ pm@deployra.com          │
  │ TL — Backend    │ Rahul Verma      │ tl.rahul@deployra.com    │
  │ TL — Frontend   │ Sneha Kapoor     │ tl.sneha@deployra.com    │
  ├─────────────────┼──────────────────┼──────────────────────────┤
  │ Backend Dev     │ Karan Singh      │ karan@deployra.com       │
  │ Backend Dev     │ Meena Patel      │ meena@deployra.com       │
  │ Full Stack      │ Ravi Joshi       │ ravi@deployra.com        │
  │ DevOps          │ Anjali Nair      │ anjali@deployra.com      │
  │ QA              │ Vikas Kumar      │ vikas@deployra.com       │
  ├─────────────────┼──────────────────┼──────────────────────────┤
  │ Frontend Dev    │ Pooja Reddy      │ pooja@deployra.com       │
  │ UI/UX Designer  │ Aditya Shah      │ aditya@deployra.com      │
  │ React Dev       │ Nisha Gupta      │ nisha@deployra.com       │
  │ Full Stack      │ Suresh Yadav     │ suresh@deployra.com      │
  │ QA              │ Divya Malhotra   │ divya@deployra.com       │
  └─────────────────┴──────────────────┴──────────────────────────┘

  Project   : "Deployra Cloud Platform v1.0"
  Status    : ACTIVE   Deadline: 31 Dec 2026
  Progress  : ${progress}% (${doneTasks}/${totalTasks} tasks done)

  Hierarchy :  Employee → TL → PM → Admin
               HR manages all profiles & payroll
`);
}

main()
  .catch((e) => { console.error("\n❌  Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
