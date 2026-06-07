// src/modules/ai/ai.routes.ts
import { Router } from "express";
import { aiController } from "./ai.controller";
import { authenticate, authorize } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

// Resume parsing — HR and admin only
router.post(
  "/parse-resume",
  authorize("admin", "hr"),
  aiController.uploadMiddleware,
  aiController.parseResume.bind(aiController)
);

// Direct sentiment analysis endpoint
router.post(
  "/sentiment",
  authorize("admin", "hr", "manager"),
  aiController.analyzeSentiment.bind(aiController)
);

export default router;