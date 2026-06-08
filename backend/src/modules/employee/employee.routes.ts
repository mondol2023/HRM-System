// src/modules/employee/employee.routes.ts
import { Router } from "express";
import { employeeController } from "./employee.controller";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { apiLimiter } from "../../middleware/rateLimit.middleware";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  addPerformanceNoteSchema,
  listQuerySchema,
} from "./employee.schema";

const router = Router();

router.use(authenticate, apiLimiter);

router.get("/stats", authorize("admin", "hr"), employeeController.stats.bind(employeeController));
router.get("/", authorize("admin", "hr", "manager"), validate(listQuerySchema, "query"), employeeController.list.bind(employeeController));
router.get("/:id", employeeController.getOne.bind(employeeController));
router.post("/", authorize("admin", "hr"), validate(createEmployeeSchema), employeeController.create.bind(employeeController));
router.patch("/:id", authorize("admin", "hr"), validate(updateEmployeeSchema), employeeController.update.bind(employeeController));
router.delete("/:id", authorize("admin"), employeeController.terminate.bind(employeeController));
router.post("/:id/notes", authorize("admin", "hr", "manager"), validate(addPerformanceNoteSchema), employeeController.addNote.bind(employeeController));

export default router;