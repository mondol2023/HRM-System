// src/routes/index.ts
import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import employeeRoutes from "../modules/employee/employee.routes";
import aiRoutes from "../modules/ai/ai.routes";
import { apiLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.use(apiLimiter);
router.use("/auth", authRoutes);
router.use("/employees", employeeRoutes);
router.use("/ai", aiRoutes);

export default router;
