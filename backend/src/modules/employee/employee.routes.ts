// src/modules/employee/employee.routes.ts
import { Router } from "express";
import { employeeController } from "./employee.controller";
import { authenticate, authorize, authorizePrivileged } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { asyncHandler } from "../../core/http/asyncHandler";
import {
  addPerformanceNoteSchema,
  createEmployeeSchema,
  idParamSchema,
  listQuerySchema,
  updateEmployeeSchema,
} from "./employee.schema";
import type { AuthRequest } from "../../types";

const router = Router();

router.use(authenticate);

router.get("/stats", authorizePrivileged, asyncHandler<AuthRequest>(employeeController.stats));

router.get(
  "/",
  authorize("admin", "hr", "manager"),
  validate(listQuerySchema, "query"),
  asyncHandler<AuthRequest>(employeeController.list)
);

// Open to any authenticated role — per-record access is enforced in the service.
router.get(
  "/:id",
  validate(idParamSchema, "params"),
  asyncHandler<AuthRequest>(employeeController.getOne)
);

router.post(
  "/",
  authorizePrivileged,
  validate(createEmployeeSchema),
  asyncHandler<AuthRequest>(employeeController.create)
);

router.patch(
  "/:id",
  authorizePrivileged,
  validate(idParamSchema, "params"),
  validate(updateEmployeeSchema),
  asyncHandler<AuthRequest>(employeeController.update)
);

router.delete(
  "/:id",
  authorize("admin"),
  validate(idParamSchema, "params"),
  asyncHandler<AuthRequest>(employeeController.terminate)
);

router.post(
  "/:id/notes",
  authorize("admin", "hr", "manager"),
  validate(idParamSchema, "params"),
  validate(addPerformanceNoteSchema),
  asyncHandler<AuthRequest>(employeeController.addNote)
);

export default router;
