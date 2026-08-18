// src/routes/index.ts
import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import employeeRoutes from "../modules/employee/employee.routes";
import aiRoutes from "../modules/ai/ai.routes";
import auditRoutes from "../modules/audit/audit.routes";
import leaveRoutes from "../modules/leave/leave.routes";
import { apiLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.use(apiLimiter);
router.use("/auth", authRoutes);
router.use("/employees", employeeRoutes);
router.use("/ai", aiRoutes);
router.use("/audit", auditRoutes);
router.use("/leave", leaveRoutes);

export default router;
