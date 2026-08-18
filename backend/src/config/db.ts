// src/config/db.ts
import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

export const connectDB = async (): Promise<void> => {
  // Reject on unknown fields instead of silently dropping them, and never
  // allow an empty `$set` to wipe a document.
  mongoose.set("strictQuery", true);
  mongoose.set("sanitizeFilter", true);
  // Index builds are a deploy-time operation (`npm run indexes:sync`), not a
  // boot-time one — an implicit build on a large collection can stall writes.
  mongoose.set("autoIndex", env.mongo.autoIndex);

  mongoose.connection.on("error", (err: Error) => logger.error("MongoDB error", { error: err.message }));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected — driver will retry"));
  mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));

  await mongoose.connect(env.mongo.uri, {
    // The pool must cover peak *concurrency*, not peak RPS: at 150 rps with a
    // 20 ms average query, ~3 connections are busy at any instant, so 50 leaves
    // a very wide margin for slow aggregations and burst traffic.
    maxPoolSize: env.mongo.maxPoolSize,
    minPoolSize: env.mongo.minPoolSize,
    maxIdleTimeMS: 60_000,
    // Fail fast rather than letting requests pile up behind an unreachable
    // primary — a queued request still holds an event-loop slot.
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45_000,
    waitQueueTimeoutMS: 10_000,
    heartbeatFrequencyMS: 10_000,
    retryWrites: true,
    retryReads: true,
    compressors: ["zlib"],
  });

  logger.info("MongoDB connected", {
    maxPoolSize: env.mongo.maxPoolSize,
    autoIndex: env.mongo.autoIndex,
  });
};

/** 1 === connected. Used by the readiness probe. */
export const isDbHealthy = (): boolean => mongoose.connection.readyState === 1;

export const pingDb = async (): Promise<boolean> => {
  try {
    await mongoose.connection.db?.admin().ping();
    return isDbHealthy();
  } catch {
    return false;
  }
};

export const closeDB = async (): Promise<void> => {
  await mongoose.connection.close(false);
  logger.info("MongoDB connection closed");
};
