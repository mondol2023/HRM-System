// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../types";
import { logger } from "../config/logger";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.warn(`[AppError] ${err.statusCode} — ${err.message}`);
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Mongoose duplicate key
  if ((err as NodeJS.ErrnoException).code === "11000") {
    res.status(409).json({ success: false, message: "Duplicate field value" });
    return;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    res.status(422).json({ success: false, message: err.message });
    return;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
    return;
  }

  logger.error("[Unhandled Error]", err);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
};