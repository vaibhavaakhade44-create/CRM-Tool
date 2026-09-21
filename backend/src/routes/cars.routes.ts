import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requireModuleAccess } from "../middleware/requireModuleAccess";
import {
  listCarLeads, getCarLead, createCarLead, updateCarLead, deleteCarLead,
  bulkImportCarLeads, convertCarLead,
  listVehicles, getVehicle, createVehicle, updateVehicle, bulkImportVehicles,
  addInsurance, updateInsurance, listExpiringInsurance,
  getCarsStats, getSalesReport, getMonthlyLeadReport, listWarranties,
  listHistoricalStats, bulkImportHistoricalStats, deleteHistoricalStat,
} from "../controllers/cars.controller";

const router = Router();
router.use(authenticate, requireOrgContext, requireModuleAccess("CARS"));

router.get("/stats",                 getCarsStats);
router.get("/sales-report",          getSalesReport);
router.get("/leads/monthly-report",  getMonthlyLeadReport);

router.get("/historical-stats",              listHistoricalStats);
router.post("/historical-stats/bulk-import", bulkImportHistoricalStats);
router.delete("/historical-stats/:id",       deleteHistoricalStat);

router.get("/leads",                 listCarLeads);
router.post("/leads",                createCarLead);
router.post("/leads/bulk-import",    bulkImportCarLeads);
router.get("/leads/:id",             getCarLead);
router.patch("/leads/:id",           updateCarLead);
router.delete("/leads/:id",          deleteCarLead);
router.post("/leads/:id/convert",    convertCarLead);

router.get("/vehicles",              listVehicles);
router.post("/vehicles",             createVehicle);
router.post("/vehicles/bulk-import", bulkImportVehicles);
router.get("/vehicles/:id",          getVehicle);
router.patch("/vehicles/:id",        updateVehicle);
router.post("/vehicles/:vehicleId/insurance", addInsurance);

router.get("/warranties",            listWarranties);

router.get("/insurance/expiring",    listExpiringInsurance);
router.patch("/insurance/:id",       updateInsurance);

export default router;
