// src/middleware/requestContext.middleware.ts
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { runWithContext } from "../core/context/requestContext";

const HEADER = "x-request-id";

/** Establishes the AsyncLocalStorage scope every log line and handler runs inside. */
export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.headers[HEADER];
  const requestId = (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();

  res.setHeader(HEADER, requestId);
  runWithContext({ requestId }, () => next());
};
