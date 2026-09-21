import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok, badRequest, serverError } from "../utils/response";
import { isPushConfigured } from "../lib/webPush";

export async function getPushPublicKey(_req: OrgRequest, res: Response): Promise<void> {
  ok(res, { publicKey: process.env.VAPID_PUBLIC_KEY || null, enabled: isPushConfigured() });
}

export async function subscribePush(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { endpoint, keys } = req.body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      badRequest(res, "endpoint and keys.p256dh/auth are required");
      return;
    }
    await prisma.webPushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.userId!, organizationId: req.organizationId! },
      create: { userId: req.userId!, organizationId: req.organizationId!, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    ok(res, null, "Subscribed to push notifications");
  } catch (err) { serverError(res, err); }
}

export async function unsubscribePush(req: OrgRequest, res: Response): Promise<void> {
  try {
    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) { badRequest(res, "endpoint is required"); return; }
    await prisma.webPushSubscription.deleteMany({ where: { endpoint, userId: req.userId! } });
    ok(res, null, "Unsubscribed");
  } catch (err) { serverError(res, err); }
}
