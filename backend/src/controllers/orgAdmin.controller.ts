import { LeaveStatus } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, serverError } from "../utils/response";

export async function getOrgAdminStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const [members, parties, invoices, orders, leads, tickets, products, tasks] = await Promise.all([
      prisma.organizationMember.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.party.count({ where: { organizationId: orgId } }),
      prisma.invoice.count({ where: { organizationId: orgId } }),
      prisma.salesOrder.count({ where: { organizationId: orgId } }),
      prisma.lead.count({ where: { organizationId: orgId } }),
      prisma.supportTicket.count({ where: { organizationId: orgId } }),
      prisma.product.count({ where: { organizationId: orgId } }),
      prisma.task.count({ where: { organizationId: orgId } }),
    ]);
    ok(res, { members, parties, invoices, orders, leads, tickets, products, tasks });
  } catch (e) { serverError(res, e); }
}

export async function getOrgActivity(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const limit = parseInt((req.query.limit as string) || "50");

    const [recentInvoices, recentOrders, recentLeads, recentTickets, recentParties] = await Promise.all([
      prisma.invoice.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, invoiceNumber: true, type: true, status: true, total: true, createdAt: true, party: { select: { name: true } } } }),
      prisma.salesOrder.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, soNumber: true, status: true, total: true, createdAt: true, party: { select: { name: true } } } }),
      prisma.lead.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, name: true, company: true, status: true, value: true, createdAt: true } }),
      prisma.supportTicket.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, ticketNumber: true, subject: true, status: true, priority: true, createdAt: true, party: { select: { name: true } } } }),
      prisma.party.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, name: true, type: true, createdAt: true } }),
    ]);

    const feed = [
      ...recentInvoices.map((i) => ({ type: "INVOICE", id: i.id, title: `Invoice ${i.invoiceNumber}`, subtitle: i.party?.name || "", meta: i.status, createdAt: i.createdAt })),
      ...recentOrders.map((o) => ({ type: "ORDER", id: o.id, title: `Order ${o.soNumber}`, subtitle: o.party?.name || "", meta: o.status, createdAt: o.createdAt })),
      ...recentLeads.map((l) => ({ type: "LEAD", id: l.id, title: l.name, subtitle: l.company || "", meta: l.status, createdAt: l.createdAt })),
      ...recentTickets.map((t) => ({ type: "TICKET", id: t.id, title: t.subject, subtitle: t.party?.name || "", meta: t.status, createdAt: t.createdAt })),
      ...recentParties.map((p) => ({ type: "PARTY", id: p.id, title: p.name, subtitle: p.type, meta: "ADDED", createdAt: p.createdAt })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);

    const auditLogs = await prisma.auditLog.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: limit });

    ok(res, { feed, auditLogs });
  } catch (e) { serverError(res, e); }
}

export async function getTeamActivity(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true, isActive: true } } },
      orderBy: { joinedAt: "desc" },
    });
    ok(res, { members });
  } catch (e) { serverError(res, e); }
}

export async function getAuditLogs(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "50");
    const search = (req.query.search as string) || "";
    const skip = (page - 1) * limit;
    const where: any = { organizationId: orgId };
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { resource: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { userName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      prisma.auditLog.count({ where }),
    ]);
    ok(res, { logs, total });
  } catch (e) { serverError(res, e); }
}

export async function getAlerts(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const now = new Date();

    const [overdueInvoices, pendingLeaves, pendingAccess, overdueTasks, urgentTickets] = await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId: orgId, status: "OVERDUE" },
        select: { id: true, invoiceNumber: true, total: true, balanceDue: true, dueDate: true, party: { select: { name: true } } },
        orderBy: { dueDate: "asc" }, take: 10,
      }),
      prisma.leaveRequest.findMany({
        where: { organizationId: orgId, status: "PENDING" },
        include: { employee: { select: { name: true } } },
        orderBy: { createdAt: "asc" }, take: 10,
      }),
      prisma.accessRequest.findMany({
        where: { organizationId: orgId, status: "PENDING" },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { requestedAt: "asc" }, take: 10,
      }),
      prisma.task.findMany({
        where: { organizationId: orgId, status: { notIn: ["DONE", "CANCELLED"] }, dueDate: { lt: now } },
        select: { id: true, title: true, priority: true, dueDate: true, projectId: true },
        orderBy: { dueDate: "asc" }, take: 10,
      }),
      prisma.supportTicket.findMany({
        where: { organizationId: orgId, status: { in: ["OPEN", "IN_PROGRESS"] }, priority: { in: ["HIGH", "URGENT"] } },
        select: { id: true, ticketNumber: true, subject: true, priority: true, createdAt: true },
        orderBy: { createdAt: "asc" }, take: 5,
      }),
    ]);

    const alerts = [
      ...overdueInvoices.map((i) => ({
        id: i.id, type: "INVOICE", severity: "critical",
        title: `Invoice ${i.invoiceNumber} overdue`,
        subtitle: `${i.party?.name || "Unknown"} — ₹${(i.balanceDue || i.total).toLocaleString("en-IN")} due`,
        link: "/accounts", createdAt: i.dueDate,
      })),
      ...urgentTickets.map((t) => ({
        id: t.id, type: "TICKET", severity: t.priority === "URGENT" ? "critical" : "warning",
        title: t.subject,
        subtitle: `Ticket ${t.ticketNumber} · ${t.priority}`,
        link: "/support", createdAt: t.createdAt,
      })),
      ...pendingLeaves.map((l) => ({
        id: l.id, type: "LEAVE", severity: "warning",
        title: `Leave request from ${l.employee.name}`,
        subtitle: `${l.leaveType} · ${l.days} day(s)`,
        link: "/hr", createdAt: l.createdAt,
      })),
      ...pendingAccess.map((a) => ({
        id: a.id, type: "ACCESS", severity: "info",
        title: `Module access request`,
        subtitle: `${a.user.name} requested ${a.moduleKey}`,
        link: "/admin/team", createdAt: a.requestedAt,
      })),
      ...overdueTasks.map((t) => ({
        id: t.id, type: "TASK", severity: t.priority === "URGENT" ? "critical" : "warning",
        title: `Task overdue: ${t.title}`,
        subtitle: `Due ${new Date(t.dueDate!).toLocaleDateString("en-IN")} · ${t.priority}`,
        link: "/projects", createdAt: t.dueDate,
      })),
    ].sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity as keyof typeof order] - order[b.severity as keyof typeof order];
    });

    ok(res, { alerts, total: alerts.length });
  } catch (e) { serverError(res, e); }
}

export async function getModuleStats(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const [invoiceStats, orderStats, purchaseStats, leadStats, ticketStats, projectStats] = await Promise.all([
      prisma.invoice.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: { _all: true }, _sum: { total: true } }),
      prisma.salesOrder.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: { _all: true } }),
      prisma.purchaseOrder.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: { _all: true } }),
      prisma.supportTicket.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: { _all: true } }),
      prisma.project.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: { _all: true } }),
    ]);
    ok(res, { invoiceStats, orderStats, purchaseStats, leadStats, ticketStats, projectStats });
  } catch (e) { serverError(res, e); }
}

export async function getChartData(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Build the 6-month label array in JS to guarantee all months appear
    const months: { key: string; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - 5 + i);
      d.setDate(1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-IN", { month: "short", year: "2-digit" });
      months.push({ key, label });
    }

    type RevenueRow = { month_key: string; revenue: bigint };
    type OrderRow   = { month_key: string; count: bigint };

    const [revenueRows, orderRows, leadsByStage] = await Promise.all([
      prisma.$queryRaw<RevenueRow[]>`
        SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month_key,
               COALESCE(SUM(total), 0) AS revenue
        FROM "Invoice"
        WHERE "organizationId" = ${orgId}
          AND status IN ('PAID', 'PARTIAL')
          AND "createdAt" >= ${sixMonthsAgo}
        GROUP BY DATE_TRUNC('month', "createdAt")
      `,
      prisma.$queryRaw<OrderRow[]>`
        SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month_key,
               COUNT(*) AS count
        FROM "SalesOrder"
        WHERE "organizationId" = ${orgId}
          AND "createdAt" >= ${sixMonthsAgo}
        GROUP BY DATE_TRUNC('month', "createdAt")
      `,
      prisma.lead.groupBy({
        by: ["status"],
        where: { organizationId: orgId },
        _count: { _all: true },
        _sum: { value: true },
      }),
    ]);

    const revenueMap = new Map(revenueRows.map(r => [r.month_key, Number(r.revenue)]));
    const orderMap   = new Map(orderRows.map(r => [r.month_key, Number(r.count)]));

    const chartData = months.map(m => ({
      month:   m.label,
      revenue: revenueMap.get(m.key) || 0,
      orders:  orderMap.get(m.key)   || 0,
    }));

    ok(res, {
      chartData,
      leadsByStage: leadsByStage.map(l => ({
        status: l.status,
        count:  l._count._all,
        value:  Number(l._sum.value || 0),
      })),
    });
  } catch (e) { serverError(res, e); }
}

// ── Admin: list ALL pending leave requests (including HR staff) ──────────────
export async function listPendingLeaves(req: OrgRequest, res: Response): Promise<void> {
  try {
    const orgId = req.organizationId!;
    const { status = "PENDING" } = req.query as Record<string, string>;
    const leaves = await prisma.leaveRequest.findMany({
      where: { organizationId: orgId, status: status as LeaveStatus },
      include: { employee: { select: { id: true, name: true, employeeCode: true, designation: true, department: true } } },
      orderBy: { createdAt: "desc" },
    });
    ok(res, leaves);
  } catch (e) { serverError(res, e); }
}

export async function approveLeave(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { status } = req.body as { status: string };
    if (!["APPROVED", "REJECTED"].includes(status)) {
      const { badRequest } = await import("../utils/response");
      badRequest(res, "status must be APPROVED or REJECTED"); return;
    }
    const orgId = req.organizationId!;
    const leave = await prisma.leaveRequest.findFirst({
      where: { id: req.params.id as string, organizationId: orgId },
    });
    if (!leave) {
      const { notFound } = await import("../utils/response");
      notFound(res, "Leave request not found"); return;
    }
    const updated = await prisma.leaveRequest.update({
      where: { id: req.params.id as string },
      data: { status: status as LeaveStatus },
      include: { employee: { select: { name: true } } },
    });
    ok(res, updated, `Leave ${status.toLowerCase()} successfully`);
  } catch (e) { serverError(res, e); }
}
