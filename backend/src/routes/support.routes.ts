import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listTickets, getTicket, createTicket, updateTicketStatus,
  addReply, getSupportStats,
} from "../controllers/support.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/stats", getSupportStats);

router.get("/", listTickets);
router.post("/", createTicket);
router.get("/:id", getTicket);
router.patch("/:id/status", updateTicketStatus);
router.post("/:id/replies", addReply);

export default router;
