import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listPatients, getPatient, createPatient, updatePatient,
  listVisits, createVisit, updateVisit,
  listPrescriptions, createPrescription,
  listLabReports, createLabReport,
  listDoctors, getDoctor, createDoctor, updateDoctor, verifyDoctor, addDoctorDocument,
  listAppointments, createAppointment, updateAppointment,
  patientPortal, getMyDoctorProfile,
  getHealthStats,
} from "../controllers/health.controller";

const router = Router();

// ── Public — no auth required ────────────────────────────────
router.get("/portal", patientPortal);

// ── All routes below require auth + org context ──────────────
router.use(authenticate, requireOrgContext);

// Dashboard stats
router.get("/stats",              getHealthStats);
// Doctor's own profile (matches email → Doctor record)
router.get("/my-doctor-profile",  getMyDoctorProfile);

// Patients
router.get("/patients",        listPatients);
router.post("/patients",       createPatient);
router.get("/patients/:id",    getPatient);
router.patch("/patients/:id",  updatePatient);

// Visits
router.get("/visits",          listVisits);
router.post("/visits",         createVisit);
router.patch("/visits/:id",    updateVisit);

// Prescriptions
router.get("/prescriptions",   listPrescriptions);
router.post("/prescriptions",  createPrescription);

// Lab reports
router.get("/lab-reports",     listLabReports);
router.post("/lab-reports",    createLabReport);

// Doctors
router.get("/doctors",                   listDoctors);
router.post("/doctors",                  createDoctor);
router.get("/doctors/:id",               getDoctor);
router.patch("/doctors/:id",             updateDoctor);
router.post("/doctors/:id/verify",       verifyDoctor);
router.post("/doctors/:id/documents",    addDoctorDocument);

// Appointments
router.get("/appointments",              listAppointments);
router.post("/appointments",             createAppointment);
router.patch("/appointments/:id",        updateAppointment);

export default router;
