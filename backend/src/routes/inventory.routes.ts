import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { requirePermission } from "../middleware/requirePermission";
import {
  listCategories, createCategory, updateCategory, deleteCategory,
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  addStockMovement, listMovements, getInventorySummary, bulkImportProducts,
} from "../controllers/inventory.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/summary", getInventorySummary);
router.post("/bulk-import", requirePermission("inventory:create"), bulkImportProducts);

router.get("/categories", listCategories);
router.post("/categories", requirePermission("inventory:create"), createCategory);
router.patch("/categories/:id", requirePermission("inventory:update"), updateCategory);
router.delete("/categories/:id", requirePermission("inventory:delete"), deleteCategory);

router.get("/movements", listMovements);
router.post("/movements", requirePermission("inventory:adjust"), addStockMovement);

router.get("/", listProducts);
router.post("/", requirePermission("inventory:create"), createProduct);
router.get("/:id", getProduct);
router.patch("/:id", requirePermission("inventory:update"), updateProduct);
router.delete("/:id", requirePermission("inventory:delete"), deleteProduct);

export default router;
