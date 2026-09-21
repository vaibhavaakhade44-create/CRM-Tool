import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireOrgContext } from "../middleware/orgContext";
import {
  listServiceItems, createServiceItem, updateServiceItem,
  listServiceContracts, createServiceContract, updateServiceContract,
  listKBArticles, getKBArticle, createKBArticle, updateKBArticle, voteKBArticle,
  listMessages, sendMessage, markMessageRead,
} from "../controllers/services.controller";

const router = Router();
router.use(authenticate, requireOrgContext);

// Service catalog
router.get("/catalog",           listServiceItems);
router.post("/catalog",          createServiceItem);
router.patch("/catalog/:id",     updateServiceItem);

// Service contracts
router.get("/contracts",         listServiceContracts);
router.post("/contracts",        createServiceContract);
router.patch("/contracts/:id",   updateServiceContract);

// Knowledge base
router.get("/kb",                listKBArticles);
router.post("/kb",               createKBArticle);
router.get("/kb/:id",            getKBArticle);
router.patch("/kb/:id",          updateKBArticle);
router.post("/kb/:id/vote",      voteKBArticle);

// Internal messages
router.get("/messages",          listMessages);
router.post("/messages",         sendMessage);
router.patch("/messages/:id/read", markMessageRead);

export default router;
