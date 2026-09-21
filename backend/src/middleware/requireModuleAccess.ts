import { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { OrgRequest } from "./orgContext";
import { MemberRole } from "@prisma/client";
import { forbidden } from "../utils/response";

/**
 * Middleware that enforces module-level access control on the backend.
 * OWNER and ADMIN always pass through.
 * For all other roles the user must have an approved UserModuleAccess record
 * for the given moduleKey in the active organisation.
 */
export function requireModuleAccess(moduleKey: string) {
  return async (req: OrgRequest, res: Response, next: NextFunction): Promise<void> => {
    const role = req.memberRole;

    // OWNER / ADMIN bypass module checks — they can see everything
    if (role === MemberRole.OWNER || role === MemberRole.ADMIN) {
      next(); return;
    }

    // Everyone else must have an explicit module grant
    try {
      const grant = await prisma.userModuleAccess.findUnique({
        where: {
          userId_organizationId_moduleKey: {
            userId: req.userId!,
            organizationId: req.organizationId!,
            moduleKey,
          },
        },
      });

      if (!grant) {
        forbidden(res, `You do not have access to the ${moduleKey} module.`);
        return;
      }
      next();
    } catch {
      forbidden(res, "Access check failed.");
    }
  };
}
