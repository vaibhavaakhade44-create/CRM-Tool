import { prisma } from "./prisma";
import { sendEmail } from "../utils/email";
import { createNotification } from "../controllers/notifications.controller";
import { sendPushToUser } from "./webPush";

interface AlertParams {
  organizationId: string;
  // A specific user to notify, or null/undefined to broadcast to every
  // active member of the org (used when a lead/customer has no owner yet).
  userId?: string | null;
  type: string;
  title: string;
  message: string;
  link: string;
}

// Fires an alert across all three channels: in-app notification bell,
// browser push (if the recipient has subscribed), and email. If userId
// is unset, every active member of the org gets it — this is what makes
// "an unassigned lead is everyone's responsibility" actually work.
export async function dispatchAlert(params: AlertParams): Promise<void> {
  const { organizationId, userId, type, title, message, link } = params;

  await createNotification({ organizationId, userId: userId ?? undefined, type, title, message, link });
  await sendPushToUser(organizationId, userId, { title, message, link });

  let recipients: { email: string; name: string }[] = [];
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (user) recipients = [user];
  } else {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId, isActive: true },
      include: { user: { select: { email: true, name: true } } },
    });
    recipients = members.map((m) => m.user);
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  const appUrl = (process.env.FRONTEND_URL || "").split(",")[0].trim().replace(/\/$/, "");

  for (const r of recipients) {
    try {
      await sendEmail({
        to: r.email,
        subject: title,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px">
            <h2 style="color:#f59e0b;margin:0 0 8px">${title}</h2>
            <p style="color:#555;margin:0 0 16px">Hi ${r.name},</p>
            <p style="color:#555">${message}</p>
            ${appUrl ? `<p style="margin-top:24px"><a href="${appUrl}${link}" style="background:#6366f1;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open in BusinessOS</a></p>` : ""}
            <p style="color:#888;font-size:13px;margin-top:24px">— ${org?.name ?? "BusinessOS"}</p>
          </div>
        `,
      });
    } catch (e) {
      console.error(`[Alert] Email failed for ${r.email}:`, e);
    }
  }
}
