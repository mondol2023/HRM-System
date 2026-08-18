// src/config/logger.ts
import path from "node:path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { env } from "./env";
import { getContext } from "../core/context/requestContext";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

/**
 * Pulls the active request's id/user out of AsyncLocalStorage so every log line
 * emitted while handling a request is correlated, without callers passing it.
 */
const withRequestContext = winston.format((info) => {
  const ctx = getContext();
  if (ctx) {
    info["requestId"] = ctx.requestId;
    if (ctx.userId) info["userId"] = ctx.userId;
  }
  return info;
});

const NOISY_DEV_KEYS = new Set(["level", "message", "timestamp", "stack", "requestId", "service"]);

const devFormat = printf((info) => {
  const reqTag = info["requestId"] ? ` (${String(info["requestId"]).slice(0, 8)})` : "";
  const extras = Object.keys(info).filter((key) => !NOISY_DEV_KEYS.has(key));
  const suffix = extras.length
    ? ` ${JSON.stringify(Object.fromEntries(extras.map((key) => [key, info[key]])))}`
    : "";
  return `${info["timestamp"]} [${info.level}]${reqTag}: ${info["stack"] ?? info.message}${suffix}`;
});

const transports: winston.transport[] = [
  new winston.transports.Console({
    // Structured JSON in production so a log shipper can index it; human
    // readable locally.
    format: env.isProduction
      ? combine(timestamp(), json())
      : combine(colorize(), timestamp({ format: "HH:mm:ss" }), devFormat),
    silent: env.isTest,
  }),
];

if (env.isProduction) {
  const rotation = { datePattern: "YYYY-MM-DD", maxFiles: "14d", maxSize: "20m", zippedArchive: true };
  transports.push(
    new DailyRotateFile({
      filename: path.join("logs", "error-%DATE%.log"),
      level: "error",
      format: combine(timestamp(), json()),
      ...rotation,
    }),
    new DailyRotateFile({
      filename: path.join("logs", "combined-%DATE%.log"),
      format: combine(timestamp(), json()),
      ...rotation,
    })
  );
}

export const logger = winston.createLogger({
  level: env.isProduction ? "info" : env.logLevel,
  format: combine(errors({ stack: true }), withRequestContext(), timestamp()),
  defaultMeta: { service: "hrm-backend" },
  transports,
  exitOnError: false,
});
