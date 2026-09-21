import { prisma } from "../lib/prisma";

interface AuditParams {
  organizationId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  action: string;        // e.g. "LOGIN_FAILED", "PASSWORD_CHANGED", "MEMBER_REMOVED"
  resource?: string;     // e.g. "User", "OrganizationMember"
  resourceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await (prisma as any).auditLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        userId:         params.userId         ?? null,
        userEmail:      params.userEmail       ?? "",
        userName:       params.userName        ?? "",
        action:         params.action,
        resource:       params.resource        ?? "",
        resourceId:     params.resourceId      ?? null,
        description:    params.description     ?? "",
        metadata:       (params.metadata as any) ?? {},
        ipAddress:      params.ipAddress       ?? "",
        userAgent:      params.userAgent       ?? "",
      },
    });
  } catch {
    // Never let audit failures break the main flow — just swallow silently
  }
}

export function getIp(req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }): string {
  return ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim()
    || req.socket.remoteAddress
    || "unknown";
}
