// src/config/redis.ts
import Redis from "ioredis";
import { logger } from "./logger";

let redisClient: Redis;

export const getRedis = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      lazyConnect: true,
    });

    redisClient.on("connect", () => logger.info("✅ Redis connected"));
    redisClient.on("error", (err) => logger.error("Redis error:", err));
    redisClient.on("reconnecting", () => logger.warn("Redis reconnecting..."));
  }
  return redisClient;
};

// ─── Cache helpers ────────────────────────────────────────────────────────────
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const data = await getRedis().get(key);
  return data ? (JSON.parse(data) as T) : null;
};

export const cacheSet = async (
  key: string,
  value: unknown,
  ttlSeconds = 300
): Promise<void> => {
  await getRedis().setex(key, ttlSeconds, JSON.stringify(value));
};

export const cacheDel = async (...keys: string[]): Promise<void> => {
  if (keys.length) await getRedis().del(...keys);
};

export const cacheInvalidatePattern = async (pattern: string): Promise<void> => {
  const keys = await getRedis().keys(pattern);
  if (keys.length) await getRedis().del(...keys);
};