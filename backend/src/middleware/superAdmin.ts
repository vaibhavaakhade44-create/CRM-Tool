import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { forbidden } from "../utils/response";

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.isSuperAdmin) {
    forbidden(res, "Super admin access required");
    return;
  }
  next();
}
