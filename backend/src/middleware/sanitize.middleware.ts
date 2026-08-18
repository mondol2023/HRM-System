// src/middleware/sanitize.middleware.ts
//
// In-house replacement for express-mongo-sanitize + hpp: both are unmaintained
// and the former mutates req.query, which throws on Express 5.
import type { NextFunction, Request, Response } from "express";

const MAX_DEPTH = 8;

/** Strips `$op` and dotted keys that would otherwise be interpreted by Mongo. */
const clean = (value: unknown, depth = 0): unknown => {
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) return value.map((item) => clean(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("$") || key.includes(".")) continue;
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    out[key] = clean(item, depth + 1);
  }
  return out;
};

/**
 * `?status=a&status=b` arrives as an array and can turn a string comparison
 * into an unexpected shape downstream. Keep the last value.
 */
const flattenDuplicates = (query: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    out[key] = Array.isArray(value) ? value[value.length - 1] : value;
  }
  return out;
};

export const sanitize = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === "object") req.body = clean(req.body);

  if (req.query && typeof req.query === "object") {
    const cleaned = flattenDuplicates(clean(req.query) as Record<string, unknown>);
    Object.defineProperty(req, "query", { value: cleaned, writable: true, configurable: true });
  }

  if (req.params && typeof req.params === "object") {
    Object.defineProperty(req, "params", { value: clean(req.params), writable: true, configurable: true });
  }

  next();
};
