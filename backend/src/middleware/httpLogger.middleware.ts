// src/middleware/httpLogger.middleware.ts
//
// Replaces morgan: one structured line per response, correlated via
// AsyncLocalStorage, and no string formatting on the hot path.
import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";

const SLOW_REQUEST_MS = 1000;

export const httpLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const meta = {
      method: req.method,
      path: req.route?.path ?? req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
    };

    if (res.statusCode >= 500) logger.error("request failed", meta);
    else if (res.statusCode >= 400 || durationMs > SLOW_REQUEST_MS) logger.warn("request", meta);
    else logger.http("request", meta);
  });

  next();
};
