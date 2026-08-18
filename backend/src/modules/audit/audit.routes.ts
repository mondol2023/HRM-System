// src/modules/audit/audit.routes.ts
import { Router } from "express";
import { auditController } from "./audit.controller";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../core/http/asyncHandler";
import { listAuditSchema } from "./audit.schema";
import type { AuthRequest } from "../../types";

const router = Router();

router.use(authenticate);

// admin-only: hr performs many of the audited actions itself and must not be
// able to review (or notice gaps in) its own trail.
router.get("/", authorize("admin"), validate(listAuditSchema, "query"), asyncHandler<AuthRequest>(auditController.list));

export default router;
