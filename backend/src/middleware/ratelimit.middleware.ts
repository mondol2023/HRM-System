// src/middleware/rateLimit.middleware.ts
import { Request, Response } from "express";
import { getRedis } from "../config/redis";
import { AppError } from "../types";

/**
 * Simple Redis-backed sliding window rate limiter.
 * Uses Redis INCR + EXPIRE for atomic per-IP counting.
 * No external rate-limit library needed.
 */
export const rateLimit = (options: {
  windowMs: number;  // milliseconds
  max: number;       // max requests per window
  message?: string;
  keyPrefix?: string;
}) => {
  const {
    windowMs,
    max,
    message = "Too many requests. Please try again later.",
    keyPrefix = "rl",
  } = options;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: Parameters<typeof res.json>[0] extends never ? never : (err?: unknown) => void): Promise<void> => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const key = `${keyPrefix}:${ip}`;

    try {
      const redis = getRedis();
      const current = await redis.incr(key);

      if (current === 1) {
        // First request in window — set expiry
        await redis.expire(key, windowSeconds);
      }

      // Set headers for clients
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, max - current));

      if (current > max) {
        const ttl = await redis.ttl(key);
        res.setHeader("Retry-After", ttl);
        next(new AppError(message, 429));
        return;
      }

      next();
    } catch {
      // If Redis is down, fail open (don't block requests)
      next();
    }
  };
};

// ─── Preset limiters ──────────────────────────────────────────────────────────

/** Strict limiter for auth endpoints: 10 req / 15 min */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many auth attempts. Please try again in 15 minutes.",
  keyPrefix: "rl:auth",
});

/** Standard API limiter: 100 req / min */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyPrefix: "rl:api",
});

/** AI endpoint limiter: 20 req / min (expensive OpenAI calls) */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many AI requests. Please slow down.",
  keyPrefix: "rl:ai",
});