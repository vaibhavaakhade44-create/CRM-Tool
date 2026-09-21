import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { listAppointments, createAppointment, updateAppointment, deleteAppointment, getTodayAppointments } from "../controllers/appointment.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/today",  getTodayAppointments);
router.get("/",       listAppointments);
router.post("/",      createAppointment);
router.patch("/:id",  updateAppointment);
router.delete("/:id", deleteAppointment);

export default router;
