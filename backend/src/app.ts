// src/app.ts
import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { errorHandler } from "./middleware/error.middleware";
import { logger } from "./config/logger";

import authRoutes from "./modules/auth/auth.routes";
import employeeRoutes from "./modules/employee/employee.routes";
import aiRoutes from "./modules/ai/ai.routes";

export const createApp = (): Application => {
  const app = express();

  // ─── Security headers ───────────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // ─── Body parsers ───────────────────────────────────────────────────────────
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser(process.env.COOKIE_SECRET));

  // ─── HTTP logging ───────────────────────────────────────────────────────────
  app.use(
    morgan("combined", {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip: () => process.env.NODE_ENV === "test",
    })
  );

  // ─── Health check ───────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─── API Routes ─────────────────────────────────────────────────────────────
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/employees", employeeRoutes);
  app.use("/api/v1/ai", aiRoutes);

  // ─── 404 handler ────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
  });

  // ─── Global error handler ───────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
};