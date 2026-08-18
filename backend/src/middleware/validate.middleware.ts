// src/middleware/validate.middleware.ts
import type { NextFunction, Request, Response } from "express";
import type Joi from "joi";
import { AppError } from "../core/errors/AppError";

type ValidationTarget = "body" | "query" | "params";

export const validate =
  (schema: Joi.ObjectSchema, target: ValidationTarget = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      // Unknown keys are dropped, not rejected: this is what strips an
      // attacker-supplied `role` from a registration body.
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join("."), message: d.message }));
      return next(AppError.validation(error.details.map((d) => d.message).join("; "), details));
    }

    // Express 5 makes req.query a getter; assigning via defineProperty keeps
    // this working on both 4 and 5.
    Object.defineProperty(req, target, { value, writable: true, configurable: true });
    next();
  };
