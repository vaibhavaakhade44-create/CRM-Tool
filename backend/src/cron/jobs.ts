import cron from "node-cron";
import https from "https";
import http from "http";
import { prisma } from "../lib/prisma";
import { sendEmail } from "../utils/email";
import { createNotification } from "../controllers/notifications.controller";
import { dispatchAlert } from "../lib/alertDispatch";

// ── Payment Reminders ─────────────────────────────────────────
// Runs daily at 9:00 AM — finds overdue invoices and sends email reminders
async function runPaymentReminders() {
  console.log("[CRON] Running payment reminders…");
  try {
    const now = new Date();
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["SENT", "PARTIAL"] },
        dueDate: { lt: now },
        balanceDue: { gt: 0 },
      },
      include: {
        organization: true,
        party: true,
      },
      take: 200,
    });

    for (const inv of overdueInvoices) {
      if (!inv.party?.email) continue;

      const daysOverdue = Math.floor((now.getTime() - inv.dueDate!.getTime()) / 86400000);
      // Send reminders at 3, 7, 15, 30 days overdue
      if (![3, 7, 15, 30].includes(daysOverdue)) continue;

      try {
        await sendEmail({
          to: inv.party.email,
          subject: `Payment Reminder — Invoice ${inv.invoiceNumber} is ${daysOverdue} days overdue`,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px">
              <h2 style="color:#ef4444;margin:0 0 8px">Payment Overdue</h2>
              <p style="color:#555;margin:0 0 16px">Dear ${inv.party.name},</p>
              <p style="color:#555">This is a reminder that invoice <strong>${inv.invoiceNumber}</strong>
              from <strong>${inv.organization.name}</strong> is <strong>${daysOverdue} days overdue</strong>.</p>
              <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:20px 0">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                  <span style="color:#888">Invoice #</span>
                  <strong>${inv.invoiceNumber}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                  <span style="color:#888">Due Date</span>
                  <strong>${inv.dueDate?.toLocaleDateString("en-IN")}</strong>
                </div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:#888">Balance Due</span>
                  <strong style="color:#ef4444">₹${inv.balanceDue.toLocaleString("en-IN")}</strong>
                </div>
              </div>
              <p style="color:#555">Please arrange payment at the earliest to avoid any disruption.</p>
              <p style="color:#888;font-size:13px">— ${inv.organization.name}</p>
            </div>
          `,
        });

        // Create in-app notification for org owner
        await createNotification({
          organizationId: inv.organizationId,
          type: "INVOICE_OVERDUE",
          title: `Invoice ${inv.invoiceNumber} overdue`,
          message: `${inv.party.name} — ₹${inv.balanceDue.toLocaleString("en-IN")} due (${daysOverdue}d overdue)`,
          link: "/accounts",
        });
      } catch (e) {
        console.error(`[CRON] Failed reminder for invoice ${inv.invoiceNumber}:`, e);
      }
    }

    console.log(`[CRON] Payment reminders done. Checked ${overdueInvoices.length} overdue invoices.`);
  } catch (e) {
    console.error("[CRON] Payment reminders failed:", e);
  }
}

// ── Recurring Invoices ────────────────────────────────────────
// Runs daily at 8:00 AM — auto-generates invoices from recurring templates
async function runRecurringInvoices() {
  console.log("[CRON] Running recurring invoices…");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = await prisma.recurringInvoice.findMany({
      where: { isActive: true, nextRunDate: { lte: today } },
      include: { organization: true },
    });

    for (const rec of due) {
      try {
        const items = rec.items as Array<{ description: string; quantity: number; unitPrice: number; taxRate: number; taxAmount: number; total: number }>;

        // Generate invoice number
        const count = await prisma.invoice.count({ where: { organizationId: rec.organizationId } });
        const invoiceNumber = `INV-${String(count + 1).padStart(5, "0")}`;

        await prisma.invoice.create({
          data: {
            organizationId: rec.organizationId,
            partyId: rec.partyId,
            invoiceNumber,
            invoiceDate: new Date(),
            dueDate: new Date(Date.now() + 15 * 86400000),
            subtotal: rec.subtotal,
            taxAmount: rec.taxAmount,
            total: rec.total,
            balanceDue: rec.total,
            notes: rec.notes,
            status: rec.autoSend ? "SENT" : "DRAFT",
            items: {
              create: items.map(i => ({
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                taxRate: i.taxRate,
                taxAmount: i.taxAmount,
                total: i.total,
              })),
            },
          },
        });

        // Advance the next run date
        const next = new Date(rec.nextRunDate);
        switch (rec.frequency) {
          case "WEEKLY":    next.setDate(next.getDate() + 7); break;
          case "MONTHLY":   next.setMonth(next.getMonth() + 1); break;
          case "QUARTERLY": next.setMonth(next.getMonth() + 3); break;
          case "YEARLY":    next.setFullYear(next.getFullYear() + 1); break;
        }
        await prisma.recurringInvoice.update({ where: { id: rec.id }, data: { nextRunDate: next } });

        await createNotification({
          organizationId: rec.organizationId,
          type: "RECURRING_INVOICE",
          title: "Recurring invoice generated",
          message: `Invoice ${invoiceNumber} auto-created from recurring template`,
          link: "/accounts",
        });
      } catch (e) {
        console.error(`[CRON] Failed recurring invoice ${rec.id}:`, e);
      }
    }

    console.log(`[CRON] Recurring invoices done. Processed ${due.length} templates.`);
  } catch (e) {
    console.error("[CRON] Recurring invoices failed:", e);
  }
}

// ── Stock Alerts ──────────────────────────────────────────────
// Runs every 6 hours — notifies when stock hits reorder level
async function runStockAlerts() {
  try {
    // Use raw query to compare currentStock <= reorderLevel on the same row
    const lowStock = await prisma.$queryRaw<Array<{
      id: string; name: string; unit: string; currentStock: number;
      reorderLevel: number; organizationId: string;
    }>>`
      SELECT id, name, unit, "currentStock", "reorderLevel", "organizationId"
      FROM "Product"
      WHERE status = 'ACTIVE' AND "currentStock" <= "reorderLevel"
      LIMIT 100
    `;

    for (const p of lowStock) {
      // Skip if already notified in last 24h
      const existing = await prisma.notification.findFirst({
        where: {
          organizationId: p.organizationId,
          type: "LOW_STOCK",
          link: `/inventory?product=${p.id}`,
          createdAt: { gt: new Date(Date.now() - 24 * 3600000) },
        },
      });
      if (existing) continue;

      await createNotification({
        organizationId: p.organizationId,
        type: "LOW_STOCK",
        title: "Low stock alert",
        message: `${p.name} — only ${p.currentStock} ${p.unit} left (reorder at ${p.reorderLevel})`,
        link: `/inventory?product=${p.id}`,
      });
    }
  } catch (e) {
    console.error("[CRON] Stock alerts failed:", e);
  }
}

// ── Expiry Alerts ─────────────────────────────────────────────
// Runs daily at 7:00 AM — notifies when product batches are expiring within 30 days
async function runExpiryAlerts() {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 30);

    const batches = await (prisma as any).productBatch.findMany({
      where: {
        isActive: true,
        quantity: { gt: 0 },
        expiryDate: { lte: cutoff, not: null },
      },
      include: { product: { select: { id: true, name: true } } },
    });

    for (const batch of batches) {
      const daysLeft = Math.floor((new Date(batch.expiryDate).getTime() - Date.now()) / 86400000);
      if (daysLeft < 0) continue;

      const existing = await prisma.notification.findFirst({
        where: {
          organizationId: batch.organizationId,
          type: "EXPIRY_ALERT",
          link: `/inventory?product=${batch.productId}`,
          createdAt: { gt: new Date(Date.now() - 24 * 3600000) },
        },
      });
      if (existing) continue;

      await createNotification({
        organizationId: batch.organizationId,
        type: "EXPIRY_ALERT",
        title: "Batch expiring soon",
        message: `${batch.product.name} — Batch ${batch.batchNumber} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (qty: ${batch.quantity})`,
        link: `/inventory?product=${batch.productId}`,
      });
    }
  } catch (e) {
    console.error("[CRON] Expiry alerts failed:", e);
  }
}

// ── Lead Follow-up Reminders ──────────────────────────────────
// Runs every 5 min, alerting on a tight (10-min) lookahead window so the
// alert lands close to the actual scheduled time rather than up to an
// hour early. Assigned lead -> only the assignee is alerted; unassigned
// ("fresh") lead -> every active team member is, across all three
// channels (in-app, browser push, email).
async function runLeadFollowUpReminders() {
  try {
    const db = prisma as any;
    const now = new Date();
    const window = new Date(now.getTime() + 10 * 60000); // next 10 min

    const leads = await db.lead.findMany({
      where: {
        nextFollowUpDate: { gte: now, lte: window },
        status: { notIn: ["WON", "LOST"] },
      },
      take: 100,
    });

    for (const lead of leads) {
      // Deduplicate — skip if already notified in last hour
      const existing = await prisma.notification.findFirst({
        where: {
          organizationId: lead.organizationId,
          type: "FOLLOW_UP_DUE",
          link: `/marketing?lead=${lead.id}`,
          createdAt: { gt: new Date(Date.now() - 3600000) },
        },
      });
      if (existing) continue;

      await dispatchAlert({
        organizationId: lead.organizationId,
        userId: lead.assignedToId,
        type: "FOLLOW_UP_DUE",
        title: "Follow-up due",
        message: `${lead.name}${lead.company ? ` (${lead.company})` : ""} — follow up scheduled now`,
        link: `/marketing?lead=${lead.id}`,
      });
    }

    // Overdue follow-ups — notify once daily at 9 AM (check hour)
    if (now.getHours() === 9 && now.getMinutes() < 5) {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const overdue = await db.lead.findMany({
        where: {
          nextFollowUpDate: { lt: startOfDay },
          status: { notIn: ["WON", "LOST"] },
        },
        take: 50,
      });

      for (const lead of overdue) {
        const existing = await prisma.notification.findFirst({
          where: {
            organizationId: lead.organizationId,
            type: "FOLLOW_UP_OVERDUE",
            link: `/marketing?lead=${lead.id}`,
            createdAt: { gt: new Date(Date.now() - 24 * 3600000) },
          },
        });
        if (existing) continue;
        await dispatchAlert({
          organizationId: lead.organizationId,
          userId: lead.assignedToId,
          type: "FOLLOW_UP_OVERDUE",
          title: "Overdue follow-up",
          message: `${lead.name} — follow-up was missed! Update status or reschedule.`,
          link: `/marketing?lead=${lead.id}`,
        });
      }
    }
  } catch (e) {
    console.error("[CRON] Lead follow-up reminders failed:", e);
  }
}

// ── CRM Contact Follow-up Reminders ─────────────────────────────
// Runs every 5 min on a tight 10-min lookahead (mirrors the Lead job
// above). Alerts the customer's assigned owner if one is set; otherwise
// — a "fresh"/unowned customer — every active team member is alerted,
// since nobody specifically owns following up with them yet.
async function runPartyFollowUpReminders() {
  try {
    const now = new Date();
    const window = new Date(now.getTime() + 10 * 60000); // next 10 min

    const due = await prisma.communication.findMany({
      where: { followUpDate: { gte: now, lte: window } },
      include: { party: { select: { name: true, assignedToId: true } } },
      take: 100,
    });

    for (const comm of due) {
      const existing = await prisma.notification.findFirst({
        where: {
          organizationId: comm.organizationId,
          type: "PARTY_FOLLOW_UP_DUE",
          link: `/crm/${comm.partyId}`,
          createdAt: { gt: new Date(Date.now() - 3600000) },
        },
      });
      if (existing) continue;

      await dispatchAlert({
        organizationId: comm.organizationId,
        userId: comm.party.assignedToId,
        type: "PARTY_FOLLOW_UP_DUE",
        title: "Follow-up due",
        message: `${comm.party.name} — follow up scheduled now`,
        link: `/crm/${comm.partyId}`,
      });
    }

    // Overdue follow-ups — notify once daily at 9 AM (check hour)
    if (now.getHours() === 9 && now.getMinutes() < 5) {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const overdue = await prisma.communication.findMany({
        where: { followUpDate: { lt: startOfDay, not: null } },
        include: { party: { select: { name: true, assignedToId: true } } },
        take: 50,
      });

      for (const comm of overdue) {
        const existing = await prisma.notification.findFirst({
          where: {
            organizationId: comm.organizationId,
            type: "PARTY_FOLLOW_UP_OVERDUE",
            link: `/crm/${comm.partyId}`,
            createdAt: { gt: new Date(Date.now() - 24 * 3600000) },
          },
        });
        if (existing) continue;
        await dispatchAlert({
          organizationId: comm.organizationId,
          userId: comm.party.assignedToId,
          type: "PARTY_FOLLOW_UP_OVERDUE",
          title: "Overdue follow-up",
          message: `${comm.party.name} — follow-up was missed! Log a new one to reschedule.`,
          link: `/crm/${comm.partyId}`,
        });
      }
    }
  } catch (e) {
    console.error("[CRON] Party follow-up reminders failed:", e);
  }
}

// ── Appointment Reminders ─────────────────────────────────────
// Runs every 15 min — sends reminders 30 min before appointments
async function runAppointmentReminders() {
  try {
    const db = prisma as any;
    const now = new Date();
    const window = new Date(now.getTime() + 35 * 60000); // 35 min ahead

    const appointments = await db.appointment.findMany({
      where: {
        remindAt: { gte: now, lte: window },
        reminderSent: false,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
      },
      take: 50,
    });

    for (const appt of appointments) {
      try {
        const minutesAway = Math.round((new Date(appt.scheduledAt).getTime() - now.getTime()) / 60000);
        await createNotification({
          organizationId: appt.organizationId,
          type: "APPOINTMENT_REMINDER",
          title: `Appointment in ${minutesAway} min`,
          message: `${appt.title}${appt.location ? ` — ${appt.location}` : ""}${appt.meetingLink ? ` | ${appt.meetingLink}` : ""}`,
          link: `/appointments`,
          userId: appt.assignedToId ?? undefined,
        });
        await db.appointment.update({ where: { id: appt.id }, data: { reminderSent: true } });
      } catch {}
    }
  } catch (e) {
    console.error("[CRON] Appointment reminders failed:", e);
  }
}

// ── Keep-alive ping ───────────────────────────────────────────
// Render free tier spins a service down after ~15 min with no inbound HTTP
// traffic. Hitting our own PUBLIC url (RENDER_EXTERNAL_URL) sends a request out
// to the internet and back in as real inbound traffic, which resets that idle
// timer. Runs every 5 min so there's always fresh activity well before the
// cutoff. NOTE: this only works while the process is alive — after a deploy or
// crash the server is already asleep and can't ping itself. The external
// pinger in .github/workflows/keep-alive.yml covers that case.
function runKeepAlive() {
  const base = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 10000}`;
  const url  = `${base}/api/health`;
  const mod  = url.startsWith("https") ? https : http;
  mod.get(url, (res) => {
    res.resume(); // drain so socket is released
    console.log(`[CRON] Keep-alive ping → ${res.statusCode}`);
  }).on("error", (e) => {
    console.warn("[CRON] Keep-alive ping failed:", e.message);
  });
}

// ── Register all cron jobs ────────────────────────────────────
export function startCronJobs() {
  // Keep-alive — every 5 min to prevent Render free tier sleep (15 min idle cutoff)
  cron.schedule("*/5 * * * *", runKeepAlive);
  runKeepAlive(); // fire once on boot so the idle timer starts fresh immediately

  // Payment reminders — daily at 9:00 AM
  cron.schedule("0 9 * * *", runPaymentReminders, { timezone: "Asia/Kolkata" });

  // Recurring invoices — daily at 8:00 AM
  cron.schedule("0 8 * * *", runRecurringInvoices, { timezone: "Asia/Kolkata" });

  // Stock alerts — every 6 hours
  cron.schedule("0 */6 * * *", runStockAlerts, { timezone: "Asia/Kolkata" });

  // Expiry alerts — daily at 7:00 AM
  cron.schedule("0 7 * * *", runExpiryAlerts, { timezone: "Asia/Kolkata" });

  // Lead follow-up reminders — every 5 min (tight window so alerts land close to the actual scheduled time)
  cron.schedule("*/5 * * * *", runLeadFollowUpReminders, { timezone: "Asia/Kolkata" });

  // CRM contact (customer/supplier) follow-up reminders — every 5 min
  cron.schedule("*/5 * * * *", runPartyFollowUpReminders, { timezone: "Asia/Kolkata" });

  // Appointment reminders — every 15 min
  cron.schedule("*/15 * * * *", runAppointmentReminders, { timezone: "Asia/Kolkata" });

  console.log("[CRON] Jobs registered: payment reminders, recurring invoices, stock alerts, expiry alerts, lead follow-ups, party follow-ups, appointment reminders, keep-alive");
}
