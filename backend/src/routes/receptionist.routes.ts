import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listVisitors, getVisitor, createVisitor, updateVisitor, checkOutVisitor,
  listCouriers, createCourier, updateCourierStatus,
  getReceptionistStats,
} from "../controllers/receptionist.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

// Dashboard
router.get   ("/stats",                getReceptionistStats);

// Visitors
router.get   ("/visitors",             listVisitors);
router.post  ("/visitors",             createVisitor);
router.get   ("/visitors/:id",         getVisitor);
router.patch ("/visitors/:id",         updateVisitor);
router.post  ("/visitors/:id/checkout", checkOutVisitor);

// Courier / package log
router.get   ("/couriers",             listCouriers);
router.post  ("/couriers",             createCourier);
router.patch ("/couriers/:id/status",  updateCourierStatus);

export default router;
