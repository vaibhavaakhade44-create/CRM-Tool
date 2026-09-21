import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import { listTransactions, importTransactions, autoMatch, updateTransactionStatus, deleteTransaction } from "../controllers/reconciliation.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

router.get("/",             listTransactions);
router.post("/import",      importTransactions);
router.post("/auto-match",  autoMatch);
router.patch("/:id",        updateTransactionStatus);
router.delete("/:id",       deleteTransaction);

export default router;
