import { Response } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "../middleware/orgContext";
import { ok } from "../utils/response";

export async function listNotifications(req: OrgRequest, res: Response) {
  const orgId = req.organizationId!;
  const userId = req.userId!;
  const limit = Math.min(Number(req.query.limit) || 30, 100);

  const notifications = await prisma.notification.findMany({
    where: { organizationId: orgId, OR: [{ userId }, { userId: null }] },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const unreadCount = await prisma.notification.count({
    where: { organizationId: orgId, OR: [{ userId }, { userId: null }], isRead: false },
  });

  return ok(res, { notifications, unreadCount });
}

export async function markRead(req: OrgRequest, res: Response) {
  const orgId = req.organizationId!;
  const userId = req.userId!;
  const rawIds = req.body.ids;
  const ids: string[] = Array.isArray(rawIds) ? rawIds.map(String) : [];

  if (ids.length > 0) {
    await prisma.notification.updateMany({
      where: { organizationId: orgId, id: { in: ids } },
      data: { isRead: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { organizationId: orgId, OR: [{ userId }, { userId: null }] },
      data: { isRead: true },
    });
  }

  return ok(res, { message: "Marked as read" });
}

export async function deleteNotification(req: OrgRequest, res: Response) {
  const orgId = req.organizationId!;
  const id = req.params.id as string;
  await prisma.notification.deleteMany({ where: { id, organizationId: orgId } });
  return ok(res, { message: "Deleted" });
}

// Internal helper — call from anywhere to push a notification
export async function createNotification(params: {
  organizationId: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  return prisma.notification.create({ data: params });
}
