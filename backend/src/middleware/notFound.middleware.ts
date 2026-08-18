// src/middleware/notFound.middleware.ts
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../core/errors/AppError";

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl}`));
};
