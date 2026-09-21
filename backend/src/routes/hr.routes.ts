import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext, requireRole } from "../middleware/orgContext";
import { requireModuleAccess } from "../middleware/requireModuleAccess";
import {
  listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee, createEmployeeLogin,
  markAttendance, listAttendance, bulkMarkAttendance,
  generatePayroll, listPayrolls, autoGeneratePayroll, markPayrollPaid,
  createLeaveRequest, updateLeaveStatus, listLeaveRequests,
  getHRSummary,
  listShifts, createShift, updateShift, deleteShift, assignShift,
  listLeaveBalances, upsertLeaveBalance,
  listPerformanceGoals, createPerformanceGoal, updatePerformanceGoal, deletePerformanceGoal,
  listPerformanceReviews, createPerformanceReview, updatePerformanceReview,
  listExpenses, createExpense, updateExpense, approveExpense, rejectExpense, markExpensePaid,
  getPayslip, getMyProfile, getDesignations,
} from "../controllers/hr.controller";

const router = Router();

// ── Auth + org context (no module access required) — accessible to all org members ──
router.use(authenticate, requireOrgContext);
router.get("/my-profile",   getMyProfile);
router.get("/designations", getDesignations);

// All remaining HR routes require HR module access
router.use(requireModuleAccess("HR"));

// ── READ-ONLY routes — STAFF and above with HR module access ──────────────
router.get("/summary",    requireRole("MANAGER"), getHRSummary);
router.get("/payslip",    getPayslip);
router.get("/shifts",     listShifts);
router.get("/attendance", listAttendance);
router.get("/payroll",    requireRole("MANAGER"), listPayrolls);
router.get("/leaves",     listLeaveRequests);        // all HR members can view leave list
router.get("/leave-balances", requireRole("MANAGER"), listLeaveBalances);
router.get("/goals",      listPerformanceGoals);
router.get("/reviews",    listPerformanceReviews);
router.get("/expenses",   listExpenses);

// ── WRITE routes — MANAGER and above only ─────────────────────────────────

// Shifts (HR Managers manage shifts)
router.post("/shifts",          requireRole("MANAGER"), createShift);
router.patch("/shifts/:id",     requireRole("MANAGER"), updateShift);
router.delete("/shifts/:id",    requireRole("MANAGER"), deleteShift);
router.post("/shifts/assign",   requireRole("MANAGER"), assignShift);

// Attendance (HR Managers mark / bulk-mark attendance)
router.post("/attendance",       requireRole("MANAGER"), markAttendance);
router.post("/attendance/bulk",  requireRole("MANAGER"), bulkMarkAttendance);

// Payroll (MANAGER+ can generate; OWNER/ADMIN can mark paid)
router.post("/payroll",               requireRole("MANAGER"), generatePayroll);
router.post("/payroll/auto-generate", requireRole("MANAGER"), autoGeneratePayroll);
router.patch("/payroll/:id/paid",     requireRole("MANAGER"), markPayrollPaid);

// Leaves (any HR member can apply; MANAGER+ can approve/reject)
router.post("/leaves",              createLeaveRequest);
router.patch("/leaves/:id/status",  requireRole("MANAGER"), updateLeaveStatus);

// Leave Balances (MANAGER+ only)
router.post("/leave-balances", requireRole("MANAGER"), upsertLeaveBalance);

// Performance Goals
router.post("/goals",       requireRole("MANAGER"), createPerformanceGoal);
router.patch("/goals/:id",  requireRole("MANAGER"), updatePerformanceGoal);
router.delete("/goals/:id", requireRole("MANAGER"), deletePerformanceGoal);

// Performance Reviews
router.post("/reviews",       requireRole("MANAGER"), createPerformanceReview);
router.patch("/reviews/:id",  requireRole("MANAGER"), updatePerformanceReview);

// Expenses (any HR member can submit; MANAGER+ can approve/reject/mark paid)
router.post("/expenses",              createExpense);
router.patch("/expenses/:id",         updateExpense);
router.patch("/expenses/:id/approve", requireRole("MANAGER"), approveExpense);
router.patch("/expenses/:id/reject",  requireRole("MANAGER"), rejectExpense);
router.patch("/expenses/:id/paid",    requireRole("MANAGER"), markExpensePaid);

// Employees (MANAGER+ to create/update; OWNER/ADMIN already bypass via requireModuleAccess)
router.get("/",        requireRole("MANAGER"), listEmployees);
router.post("/",       requireRole("MANAGER"), createEmployee);
router.post("/:id/login", requireRole("MANAGER"), createEmployeeLogin); // controller further restricts to OWNER/ADMIN
router.get("/:id",     requireRole("MANAGER"), getEmployee);
router.patch("/:id",   requireRole("MANAGER"), updateEmployee);
router.delete("/:id",  requireRole("MANAGER"), deleteEmployee);

export default router;
