// src/middleware/error.middleware.ts
import type { NextFunction, Request, Response } from "express";
import { MongoServerError } from "mongodb";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError, HttpStatus } from "../core/errors/AppError";

interface ErrorBody {
  success: false;
  message: string;
  code?: string;
  details?: unknown;
  stack?: string;
}

/** Maps known library errors onto AppError; anything else is a bug (500). */
const normalize = (error: unknown): AppError => {
  if (error instanceof AppError) return error;

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((e) => ({ field: e.path, message: e.message }));
    return AppError.validation("Validation failed", details);
  }

  if (error instanceof mongoose.Error.CastError) {
    return AppError.badRequest(`Invalid value for "${error.path}"`);
  }

  if (error instanceof MongoServerError && error.code === 11000) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? "field";
    return AppError.conflict(`A record with that ${field} already exists`);
  }

  if (error instanceof jwt.JsonWebTokenError) return AppError.unauthorized("Invalid or expired token");

  // Malformed JSON body from express.json().
  if (error instanceof SyntaxError && "body" in error) return AppError.badRequest("Malformed JSON body");

  return new AppError(
    error instanceof Error ? error.message : "Internal server error",
    HttpStatus.INTERNAL_SERVER_ERROR
  );
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) return next(error);

  const appError = normalize(error);
  const isServerFault = appError.statusCode >= 500;

  if (isServerFault) {
    logger.error(appError.message, { stack: appError.stack });
  } else {
    logger.warn(appError.message, { status: appError.statusCode, code: appError.code });
  }

  const body: ErrorBody = {
    success: false,
    // Never leak internals of an unexpected failure to the caller.
    message: isServerFault && env.isProduction ? "Internal server error" : appError.message,
  };
  if (appError.code) body.code = appError.code;
  if (appError.details !== undefined) body.details = appError.details;
  if (!env.isProduction && isServerFault) body.stack = appError.stack;

  res.status(appError.statusCode).json(body);
};
