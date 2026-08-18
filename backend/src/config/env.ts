// src/config/env.ts
//
// Single source of truth for configuration. Every other module imports `env`
// from here and never touches `process.env` directly. That gives us:
//   - fail-fast at boot instead of `undefined` surfacing as a runtime 500,
//   - real types (numbers are numbers, booleans are booleans),
//   - one place to document every knob.
import "dotenv/config";
import Joi from "joi";

export type NodeEnv = "development" | "production" | "test";

/** Converts "15m" / "7d" / "900" into seconds. */
export const parseDuration = (input: string): number => {
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration: "${input}"`);

  const amount = Number(match[1]);
  switch (match[2]) {
    case "ms":
      return Math.ceil(amount / 1000);
    case "m":
      return amount * 60;
    case "h":
      return amount * 3600;
    case "d":
      return amount * 86400;
    default:
      return amount;
  }
};

const duration = Joi.string().custom((value: string, helpers) => {
  try {
    parseDuration(value);
    return value;
  } catch {
    return helpers.error("any.invalid");
  }
}, "duration");

// In production a weak signing secret is a vulnerability, so we hard-require
// length. Locally we only warn-by-default so `npm run dev` is not a chore.
const secret = Joi.string().when("NODE_ENV", {
  is: "production",
  then: Joi.string().min(32).required(),
  otherwise: Joi.string().min(16).default("dev-only-insecure-secret-change-me"),
});

const schema = Joi.object({
  // ─── Runtime ──────────────────────────────────────────────────────────────
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().port().default(5000),
  HOST: Joi.string().default("0.0.0.0"),
  LOG_LEVEL: Joi.string().valid("error", "warn", "info", "http", "debug").default("debug"),
  // Comma-separated allow-list. Anything not listed is rejected by CORS.
  CLIENT_URL: Joi.string().default("http://localhost:5173"),
  // Number of proxy hops to trust for req.ip. MUST be accurate: too high lets a
  // client spoof X-Forwarded-For and evade per-IP rate limits.
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(10).default(0),
  BODY_LIMIT: Joi.string().default("1mb"),
  SHUTDOWN_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  // 0 = one process per available core.
  CLUSTER_WORKERS: Joi.number().integer().min(0).default(0),

  // ─── MongoDB ──────────────────────────────────────────────────────────────
  MONGO_URI: Joi.string().uri({ scheme: ["mongodb", "mongodb+srv"] }).required(),
  // Sized for the throughput target: each in-flight request may hold one
  // connection, so the pool must exceed peak concurrency, not peak RPS.
  MONGO_MAX_POOL: Joi.number().integer().min(1).default(50),
  MONGO_MIN_POOL: Joi.number().integer().min(0).default(5),
  // Never build indexes implicitly in production — that is a foreground
  // operation on some deployments. Use `npm run indexes:sync` instead.
  MONGO_AUTO_INDEX: Joi.boolean().default(Joi.ref("$isDev")),

  // ─── Redis ────────────────────────────────────────────────────────────────
  REDIS_URL: Joi.string().uri({ scheme: ["redis", "rediss"] }).optional(),
  REDIS_HOST: Joi.string().default("localhost"),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow("").default(""),
  REDIS_DB: Joi.number().integer().min(0).default(0),
  REDIS_TLS: Joi.boolean().default(false),
  REDIS_KEY_PREFIX: Joi.string().default("hrm"),

  // ─── Auth ─────────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: secret,
  JWT_REFRESH_SECRET: secret,
  COOKIE_SECRET: secret,
  // Short-lived by design: access tokens are verified with zero I/O, so the
  // only revocation lever is expiry. Refresh tokens carry the revocable state.
  ACCESS_TOKEN_TTL: duration.default("15m"),
  REFRESH_TOKEN_TTL: duration.default("7d"),
  COOKIE_DOMAIN: Joi.string().allow("").default(""),
  COOKIE_SAMESITE: Joi.string().valid("strict", "lax", "none").default("strict"),
  BCRYPT_ROUNDS: Joi.number().integer().min(4).max(15).default(12),

  // ─── Rate limiting (per identity, per window) ─────────────────────────────
  RATE_LIMIT_AUTH_MAX: Joi.number().integer().min(1).default(10),
  RATE_LIMIT_AUTH_WINDOW: duration.default("15m"),
  RATE_LIMIT_API_MAX: Joi.number().integer().min(1).default(300),
  RATE_LIMIT_API_WINDOW: duration.default("1m"),
  RATE_LIMIT_AI_MAX: Joi.number().integer().min(1).default(20),
  RATE_LIMIT_AI_WINDOW: duration.default("1m"),

  // ─── Cache TTLs (seconds) ─────────────────────────────────────────────────
  CACHE_TTL_LIST: Joi.number().integer().min(1).default(60),
  CACHE_TTL_ENTITY: Joi.number().integer().min(1).default(300),
  CACHE_TTL_STATS: Joi.number().integer().min(1).default(60),

  // ─── OpenAI ───────────────────────────────────────────────────────────────
  OPENAI_API_KEY: Joi.string().allow("").default(""),
  OPENAI_MODEL: Joi.string().default("gpt-4o-mini"),
  OPENAI_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  OPENAI_MAX_RETRIES: Joi.number().integer().min(0).max(5).default(2),
  RESUME_MAX_BYTES: Joi.number().integer().min(1024).default(5 * 1024 * 1024),

  // ─── Background worker ────────────────────────────────────────────────────
  // API processes enqueue; a separate worker process consumes. Set true only
  // for single-process local dev.
  RUN_WORKER_IN_API: Joi.boolean().default(false),
  WORKER_SENTIMENT_CONCURRENCY: Joi.number().integer().min(1).default(5),
  WORKER_ATTRITION_CONCURRENCY: Joi.number().integer().min(1).default(3),

  // ─── Seed script ──────────────────────────────────────────────────────────
  ADMIN_NAME: Joi.string().default("System Admin"),
  ADMIN_EMAIL: Joi.string().email().default("admin@hrm.local"),
  ADMIN_PASSWORD: Joi.string().default("Admin@12345"),
}).unknown(true);

/**
 * `JWT_SECRET` was the pre-2.0 name and still lives in existing .env files.
 * Accept it as a fallback so upgrading does not require an env rewrite.
 */
const withLegacyFallbacks = (source: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const merged = { ...source };
  if (!merged["JWT_ACCESS_SECRET"] && merged["JWT_SECRET"]) {
    merged["JWT_ACCESS_SECRET"] = merged["JWT_SECRET"];
  }
  if (!merged["JWT_REFRESH_SECRET"] && merged["JWT_SECRET"]) {
    // Deliberately derived, not identical: a leaked access secret must not
    // also mint refresh tokens.
    merged["JWT_REFRESH_SECRET"] = `${merged["JWT_SECRET"]}:refresh`;
  }
  if (!merged["ACCESS_TOKEN_TTL"] && merged["JWT_EXPIRES_IN"]) {
    merged["ACCESS_TOKEN_TTL"] = merged["JWT_EXPIRES_IN"];
  }
  return merged;
};

const isDev = (process.env["NODE_ENV"] ?? "development") !== "production";

const { error, value } = schema.validate(withLegacyFallbacks(process.env), {
  abortEarly: false,
  convert: true,
  context: { isDev },
});

if (error) {
  const details = error.details.map((d) => `  - ${d.message}`).join("\n");
  // Thrown, not logged: the logger itself depends on this module.
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const raw = value as Record<string, string | number | boolean>;
const str = (key: string): string => String(raw[key]);
const num = (key: string): number => Number(raw[key]);
const bool = (key: string): boolean => raw[key] === true || raw[key] === "true";

export const env = Object.freeze({
  nodeEnv: str("NODE_ENV") as NodeEnv,
  isProduction: str("NODE_ENV") === "production",
  isTest: str("NODE_ENV") === "test",
  port: num("PORT"),
  host: str("HOST"),
  logLevel: str("LOG_LEVEL"),
  corsOrigins: str("CLIENT_URL")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  trustProxyHops: num("TRUST_PROXY_HOPS"),
  bodyLimit: str("BODY_LIMIT"),
  shutdownTimeoutMs: num("SHUTDOWN_TIMEOUT_MS"),
  clusterWorkers: num("CLUSTER_WORKERS"),

  mongo: {
    uri: str("MONGO_URI"),
    maxPoolSize: num("MONGO_MAX_POOL"),
    minPoolSize: num("MONGO_MIN_POOL"),
    autoIndex: bool("MONGO_AUTO_INDEX"),
  },

  redis: {
    url: raw["REDIS_URL"] ? str("REDIS_URL") : undefined,
    host: str("REDIS_HOST"),
    port: num("REDIS_PORT"),
    password: str("REDIS_PASSWORD") || undefined,
    db: num("REDIS_DB"),
    tls: bool("REDIS_TLS"),
    keyPrefix: str("REDIS_KEY_PREFIX"),
  },

  auth: {
    accessSecret: str("JWT_ACCESS_SECRET"),
    refreshSecret: str("JWT_REFRESH_SECRET"),
    cookieSecret: str("COOKIE_SECRET"),
    accessTtlSeconds: parseDuration(str("ACCESS_TOKEN_TTL")),
    refreshTtlSeconds: parseDuration(str("REFRESH_TOKEN_TTL")),
    cookieDomain: str("COOKIE_DOMAIN") || undefined,
    cookieSameSite: str("COOKIE_SAMESITE") as "strict" | "lax" | "none",
    bcryptRounds: num("BCRYPT_ROUNDS"),
  },

  rateLimit: {
    auth: { max: num("RATE_LIMIT_AUTH_MAX"), windowSeconds: parseDuration(str("RATE_LIMIT_AUTH_WINDOW")) },
    api: { max: num("RATE_LIMIT_API_MAX"), windowSeconds: parseDuration(str("RATE_LIMIT_API_WINDOW")) },
    ai: { max: num("RATE_LIMIT_AI_MAX"), windowSeconds: parseDuration(str("RATE_LIMIT_AI_WINDOW")) },
  },

  cacheTtl: {
    list: num("CACHE_TTL_LIST"),
    entity: num("CACHE_TTL_ENTITY"),
    stats: num("CACHE_TTL_STATS"),
  },

  openai: {
    apiKey: str("OPENAI_API_KEY"),
    model: str("OPENAI_MODEL"),
    timeoutMs: num("OPENAI_TIMEOUT_MS"),
    maxRetries: num("OPENAI_MAX_RETRIES"),
    resumeMaxBytes: num("RESUME_MAX_BYTES"),
  },

  worker: {
    runInApi: bool("RUN_WORKER_IN_API"),
    sentimentConcurrency: num("WORKER_SENTIMENT_CONCURRENCY"),
    attritionConcurrency: num("WORKER_ATTRITION_CONCURRENCY"),
  },

  seed: {
    adminName: str("ADMIN_NAME"),
    adminEmail: str("ADMIN_EMAIL"),
    adminPassword: str("ADMIN_PASSWORD"),
  },
});

export type Env = typeof env;
