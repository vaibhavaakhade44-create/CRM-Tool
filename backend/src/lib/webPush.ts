import webpush from "web-push";
import { prisma } from "./prisma";

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@busiinessos.co.in";

export function isPushConfigured(): boolean {
  return !!(PUBLIC_KEY && PRIVATE_KEY);
}

if (isPushConfigured()) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY!, PRIVATE_KEY!);
}

interface PushPayload {
  title: string;
  message: string;
  link?: string;
}

// Sends a browser push notification to every device a user has subscribed
// on. If userId is omitted, sends to every subscription in the org
// (used for "unassigned — visible to everyone" alerts).
export async function sendPushToUser(
  organizationId: string,
  userId: string | null | undefined,
  payload: PushPayload
): Promise<void> {
  if (!isPushConfigured()) return;

  const subs = await prisma.webPushSubscription.findMany({
    where: { organizationId, ...(userId ? { userId } : {}) },
  });
  if (subs.length === 0) return;

  const body = JSON.stringify({ title: payload.title, body: payload.message, link: payload.link });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err: any) {
        // 404/410 = subscription is gone (user revoked permission, browser data cleared, etc.) — clean it up
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.webPushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("[WebPush] Send failed:", err?.message || err);
        }
      }
    })
  );
}
