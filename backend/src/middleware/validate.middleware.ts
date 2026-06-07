// src/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { AppError } from "../types";

type ValidationTarget = "body" | "query" | "params";

export const validate =
  (schema: Joi.ObjectSchema, target: ValidationTarget = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((d) => d.message).join("; ");
      return next(new AppError(message, 422));
    }

    req[target] = value;
    next();
  };