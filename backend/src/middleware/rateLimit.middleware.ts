// src/middleware/rateLimit.middleware.ts
//
// Sliding-window counter (Cloudflare style): the previous window's count is
// weighted by how far into the current window we are. Smooth like a true
// sliding log, but O(1) memory and one round trip — the old INCR+EXPIRE version
// cost 2-3 round trips per request and let a burst through at window edges.
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Redis } from "ioredis";
import { getRedis } from "../config/redis";
import { logger } from "../config/logger";
import { env } from "../config/env";
import { AppError } from "../core/errors/AppError";
import type { AuthRequest } from "../types";

// KEYS[1]=current bucket, KEYS[2]=previous bucket
// ARGV: limit, windowSeconds, elapsedRatio
// Returns { allowed, remaining, retryAfterSeconds }
const SLIDING_WINDOW = `
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local ratio = tonumber(ARGV[3])

local current = tonumber(redis.call('GET', KEYS[1])) or 0
local previous = tonumber(redis.call('GET', KEYS[2])) or 0
local estimate = previous * (1 - ratio) + current

if estimate >= limit then
  return { 0, 0, math.ceil(window * (1 - ratio)) }
end

current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], window * 2) end

return { 1, math.max(0, limit - math.floor(estimate) - 1), 0 }
`;

interface LimiterRedis extends Redis {
  slidingWindow(
    currentKey: string,
    previousKey: string,
    limit: number,
    windowSeconds: number,
    ratio: number
  ): Promise<[number, number, number]>;
}

let limiter: LimiterRedis | null = null;

const client = (): LimiterRedis => {
  if (limiter) return limiter;
  const redis = getRedis("limiter") as LimiterRedis;
  redis.defineCommand("slidingWindow", { numberOfKeys: 2, lua: SLIDING_WINDOW });
  limiter = redis;
  return limiter;
};

export interface RateLimitOptions {
  max: number;
  windowSeconds: number;
  /** Namespace, so the auth and api limiters never share a counter. */
  scope: string;
  /** Defaults to user id when authenticated, else IP. */
  keyGenerator?: (req: Request) => string;
}

const defaultKey = (req: Request): string => {
  const user = (req as AuthRequest).user;
  // Per-user beats per-IP: a whole office behind one NAT must not share a quota.
  return user ? `u:${user.id}` : `ip:${req.ip ?? "unknown"}`;
};

export const rateLimit = (options: RateLimitOptions): RequestHandler => {
  const { max, windowSeconds, scope, keyGenerator = defaultKey } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const bucket = Math.floor(now / windowMs);
    const ratio = (now % windowMs) / windowMs;
    const identity = keyGenerator(req);

    client()
      .slidingWindow(
        `rl:${scope}:${identity}:${bucket}`,
        `rl:${scope}:${identity}:${bucket - 1}`,
        max,
        windowSeconds,
        ratio
      )
      .then(([allowed, remaining, retryAfter]) => {
        res.setHeader("RateLimit-Limit", max);
        res.setHeader("RateLimit-Remaining", remaining);

        if (allowed === 1) return next();

        res.setHeader("Retry-After", retryAfter);
        logger.warn("Rate limit exceeded", { scope, identity, path: req.path });
        next(AppError.tooManyRequests("Too many requests, please try again later"));
      })
      .catch((error: unknown) => {
        // Fail open: Redis being down must not lock every user out.
        logger.error("Rate limiter unavailable — allowing request", {
          error: error instanceof Error ? error.message : String(error),
        });
        next();
      });
  };
};

export const authLimiter = rateLimit({ ...env.rateLimit.auth, scope: "auth" });
export const apiLimiter = rateLimit({ ...env.rateLimit.api, scope: "api" });
export const aiLimiter = rateLimit({ ...env.rateLimit.ai, scope: "ai" });
