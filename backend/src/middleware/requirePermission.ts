import { Response, NextFunction } from "express";
import { OrgRequest } from "./orgContext";
import { forbidden } from "../utils/response";
import { can, isKnownPermission } from "../config/permissions";
import { writeAuditLog, getIp } from "../utils/auditLog";

/**
 * Route-level RBAC check against the permission matrix in src/config/permissions.ts.
 *
 *   router.post("/", requirePermission("finance:create"), addPayment);
 *
 * MUST run after `requireOrgContext` (it reads `req.memberRole`).
 *
 * Rollout safety: enforcement is OFF by default. Set `RBAC_ENFORCE=true` to make
 * denials return 403. While off, a would-be denial is logged (console + audit
 * log action `RBAC_WOULD_BLOCK`) and the request proceeds — deploy, watch the
 * logs for false positives, then flip the flag.
 */
const ENFORCING = process.env.RBAC_ENFORCE === "true";

export function requirePermission(permission: string) {
  if (!isKnownPermission(permission)) {
    // Surface wiring mistakes loudly at startup rather than at request time.
    console.error(`[rbac] requirePermission("${permission}") — unknown permission key (see src/config/permissions.ts)`);
  }

  return (req: OrgRequest, res: Response, next: NextFunction): void => {
    const role = req.memberRole;

    if (!role) {
      // requirePermission used without requireOrgContext — misconfiguration.
      forbidden(res, "Organization context required.");
      return;
    }

    if (can(role, permission)) {
      next();
      return;
    }

    if (ENFORCING) {
      writeAuditLog({
        organizationId: req.organizationId,
        userId: req.userId,
        userEmail: req.userEmail,
        action: "RBAC_DENIED",
        resource: "Permission",
        resourceId: permission,
        description: `Role ${role} denied ${permission}`,
        ipAddress: getIp(req as any),
      });
      forbidden(res, "Your role does not permit this action.");
      return;
    }

    // Report-only mode.
    console.warn(`[rbac] would block: role=${role} permission=${permission} path=${req.method} ${req.originalUrl}`);
    writeAuditLog({
      organizationId: req.organizationId,
      userId: req.userId,
      userEmail: req.userEmail,
      action: "RBAC_WOULD_BLOCK",
      resource: "Permission",
      resourceId: permission,
      description: `Role ${role} would be denied ${permission} (enforcement off)`,
      ipAddress: getIp(req as any),
    });
    next();
  };
}
