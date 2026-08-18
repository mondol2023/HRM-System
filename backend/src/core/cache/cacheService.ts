// src/core/cache/cacheService.ts
//
// Two rules: never scan keys (namespace versions instead of KEYS patterns), and
// never let a Redis failure fail a request (everything falls through to source).
import type { Redis } from "ioredis";
import { getRedis } from "../../config/redis";
import { logger } from "../../config/logger";

// Version lookup + read folded into one round trip.
const GET_VERSIONED = `
local version = redis.call('GET', KEYS[1])
if not version then version = '0' end
return { version, redis.call('GET', ARGV[1] .. ':v' .. version .. ':' .. ARGV[2]) }
`;

const SET_VERSIONED = `
local version = redis.call('GET', KEYS[1])
if not version then version = '0' end
redis.call('SET', ARGV[1] .. ':v' .. version .. ':' .. ARGV[2], ARGV[3], 'PX', ARGV[4])
return version
`;

// Only delete a lock we still own.
const RELEASE_LOCK = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

interface ScriptedRedis extends Redis {
  cacheGetVersioned(versionKey: string, namespace: string, suffix: string): Promise<[string, string | null]>;
  cacheSetVersioned(
    versionKey: string,
    namespace: string,
    suffix: string,
    payload: string,
    ttlMs: number
  ): Promise<string>;
  cacheReleaseLock(lockKey: string, token: string): Promise<number>;
}

let scripted: ScriptedRedis | null = null;

const client = (): ScriptedRedis => {
  if (scripted) return scripted;
  const redis = getRedis("cache") as ScriptedRedis;
  redis.defineCommand("cacheGetVersioned", { numberOfKeys: 1, lua: GET_VERSIONED });
  redis.defineCommand("cacheSetVersioned", { numberOfKeys: 1, lua: SET_VERSIONED });
  redis.defineCommand("cacheReleaseLock", { numberOfKeys: 1, lua: RELEASE_LOCK });
  scripted = redis;
  return scripted;
};

// `{ns}` is a cluster hash tag: version and data keys stay in one slot.
const versionKey = (namespace: string): string => `v:{${namespace}}`;
const dataNamespace = (namespace: string): string => `{${namespace}}`;

// ±10% so entries cached together don't expire together.
const jitteredTtlMs = (ttlSeconds: number): number =>
  Math.round(ttlSeconds * 1000 * (0.9 + Math.random() * 0.2));

const LOCK_TTL_MS = 5000;
const LOCK_RETRY_DELAY_MS = 40;
const LOCK_RETRY_ATTEMPTS = 5;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const onRedisError = (operation: string, error: unknown): void => {
  logger.warn(`Cache ${operation} failed — using source`, {
    error: error instanceof Error ? error.message : String(error),
  });
};

export interface CacheOptions {
  /** Seconds; jitter applied on top. */
  ttl: number;
  /** Seconds to cache a `null` result, to stop repeated misses hitting Mongo. 0 disables. */
  negativeTtl?: number;
}

export const cache = {
  async get<T>(namespace: string, suffix: string): Promise<T | undefined> {
    try {
      const [, raw] = await client().cacheGetVersioned(versionKey(namespace), dataNamespace(namespace), suffix);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch (error) {
      onRedisError("get", error);
      return undefined;
    }
  },

  async set<T>(namespace: string, suffix: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await client().cacheSetVersioned(
        versionKey(namespace),
        dataNamespace(namespace),
        suffix,
        JSON.stringify(value),
        jitteredTtlMs(ttlSeconds)
      );
    } catch (error) {
      onRedisError("set", error);
    }
  },

  /** O(1) invalidation: bump the version, orphaned keys expire on their own TTL. */
  async invalidate(namespace: string): Promise<void> {
    try {
      await client().incr(versionKey(namespace));
    } catch (error) {
      onRedisError("invalidate", error);
    }
  },

  async invalidateMany(namespaces: string[]): Promise<void> {
    // Auto-pipelining collapses these into one round trip.
    await Promise.all(namespaces.map((namespace) => cache.invalidate(namespace)));
  },

  /**
   * Cache-aside read. On a miss one caller takes a short lock and loads; others
   * poll briefly, then load themselves rather than wait — a slow cache must
   * never be slower than no cache.
   */
  async getOrSet<T>(
    namespace: string,
    suffix: string,
    loader: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    const hit = await cache.get<T>(namespace, suffix);
    if (hit !== undefined) return hit;

    const redis = client();
    const lockKey = `lock:{${namespace}}:${suffix}`;
    const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    let acquired = false;
    try {
      acquired = (await redis.set(lockKey, token, "PX", LOCK_TTL_MS, "NX")) === "OK";
    } catch (error) {
      onRedisError("lock", error);
      return loader();
    }

    if (!acquired) {
      for (let attempt = 0; attempt < LOCK_RETRY_ATTEMPTS; attempt += 1) {
        await sleep(LOCK_RETRY_DELAY_MS);
        const filled = await cache.get<T>(namespace, suffix);
        if (filled !== undefined) return filled;
      }
      return loader();
    }

    try {
      const value = await loader();
      const isEmpty = value === null || value === undefined;
      const ttl = isEmpty ? (options.negativeTtl ?? 0) : options.ttl;
      if (value !== undefined && ttl > 0) await cache.set(namespace, suffix, value, ttl);
      return value;
    } finally {
      try {
        await redis.cacheReleaseLock(lockKey, token);
      } catch {
        // Lock expires on its own.
      }
    }
  },
};

/**
 * Canonical, fixed-width cache suffix for a query object. Replaces
 * `JSON.stringify(query)`, where key order changed the key and long filters
 * produced unbounded key sizes.
 */
export const queryFingerprint = (query: Record<string, unknown>): string => {
  const canonical = Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== "")
    .sort()
    .map((key) => `${key}=${String(query[key])}`)
    .join("&");

  if (canonical.length <= 64) return canonical || "all";

  // FNV-1a; a collision only costs a cache miss.
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `h${hash.toString(36)}`;
};
