// src/modules/leave/leave.routes.ts
import { Router } from "express";
import { leaveController, leaveTypeController } from "./leave.controller";
import { authenticate, authorize, authorizePrivileged } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../core/http/asyncHandler";
import {
  createLeaveRequestSchema,
  createLeaveTypeSchema,
  decideLeaveRequestSchema,
  idParamSchema,
  listLeaveRequestSchema,
  updateLeaveTypeSchema,
} from "./leave.schema";
import type { AuthRequest } from "../../types";

const router = Router();

router.use(authenticate);

// Policy config — admin/hr define what leave types exist and their rules.
router.get("/types", asyncHandler<AuthRequest>(leaveTypeController.list));
router.post("/types", authorizePrivileged, validate(createLeaveTypeSchema), asyncHandler<AuthRequest>(leaveTypeController.create));
router.patch(
  "/types/:id",
  authorizePrivileged,
  validate(idParamSchema, "params"),
  validate(updateLeaveTypeSchema),
  asyncHandler<AuthRequest>(leaveTypeController.update)
);

router.get("/balance", asyncHandler<AuthRequest>(leaveController.myBalances));

router.get("/requests", validate(listLeaveRequestSchema, "query"), asyncHandler<AuthRequest>(leaveController.list));
router.post("/requests", validate(createLeaveRequestSchema), asyncHandler<AuthRequest>(leaveController.create));

// Fine-grained "is this actually your report" / manager-vs-HR-stage check lives in the
// service — it needs the loaded request/employee, same documented pattern as assertCanView.
router.post(
  "/requests/:id/decide",
  authorize("admin", "hr", "manager"),
  validate(idParamSchema, "params"),
  validate(decideLeaveRequestSchema),
  asyncHandler<AuthRequest>(leaveController.decide)
);

router.post(
  "/requests/:id/cancel",
  validate(idParamSchema, "params"),
  asyncHandler<AuthRequest>(leaveController.cancel)
);

export default router;
