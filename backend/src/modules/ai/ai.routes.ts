// src/modules/ai/ai.routes.ts
import { Router } from "express";
import { aiController } from "./ai.controller";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { aiLimiter } from "../../middleware/rateLimit.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../core/http/asyncHandler";
import { sentimentSchema } from "./ai.schema";
import type { AuthRequest } from "../../types";

const router = Router();

router.use(authenticate, aiLimiter);

router.post(
  "/parse-resume",
  authorize("admin", "hr"),
  aiController.uploadMiddleware,
  asyncHandler<AuthRequest>(aiController.parseResume)
);

router.post(
  "/sentiment",
  authorize("admin", "hr", "manager"),
  validate(sentimentSchema),
  asyncHandler<AuthRequest>(aiController.analyzeSentiment)
);

export default router;
