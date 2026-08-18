// src/core/http/apiResponse.ts
import type { Response } from "express";
import { HttpStatus } from "../errors/AppError";

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export const ok = <T>(res: Response, data: T, message = "OK", meta?: Record<string, unknown>): void => {
  const body: ApiEnvelope<T> = { success: true, message, data };
  if (meta) body.meta = meta;
  res.status(HttpStatus.OK).json(body);
};

export const created = <T>(res: Response, data: T, message = "Created"): void => {
  res.status(HttpStatus.CREATED).json({ success: true, message, data });
};

export const noContent = (res: Response): void => {
  res.status(HttpStatus.NO_CONTENT).send();
};

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Nested `data.data` shape is kept as-is — the existing frontend reads it. */
export const paginated = <T>(res: Response, result: Paginated<T>, message = "OK"): void => {
  res.status(HttpStatus.OK).json({ success: true, message, data: result });
};
