import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  getTables, createTable, updateTable, deleteTable,
  getCategories, createCategory, updateCategory, deleteCategory,
  getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem,
  getKOTs, createKOT, updateKOTStatus, addKOTItems,
  generateBill, getBills,
  getReservations, createReservation, updateReservation,
  getDashboardStats,
} from "../controllers/restaurant.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

// Tables
router.get   ("/tables",            getTables);
router.post  ("/tables",            createTable);
router.patch ("/tables/:id",        updateTable);
router.delete("/tables/:id",        deleteTable);

// Menu categories
router.get   ("/categories",        getCategories);
router.post  ("/categories",        createCategory);
router.patch ("/categories/:id",    updateCategory);
router.delete("/categories/:id",    deleteCategory);

// Menu items
router.get   ("/items",             getMenuItems);
router.post  ("/items",             createMenuItem);
router.patch ("/items/:id",         updateMenuItem);
router.delete("/items/:id",         deleteMenuItem);

// KOT
router.get   ("/kot",               getKOTs);
router.post  ("/kot",               createKOT);
router.patch ("/kot/:id/status",    updateKOTStatus);
router.post  ("/kot/:id/items",     addKOTItems);

// Billing
router.post  ("/bills",             generateBill);
router.get   ("/bills",             getBills);

// Reservations
router.get   ("/reservations",      getReservations);
router.post  ("/reservations",      createReservation);
router.patch ("/reservations/:id",  updateReservation);

// Dashboard
router.get   ("/dashboard",         getDashboardStats);

export default router;
