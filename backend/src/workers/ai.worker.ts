// src/workers/ai.worker.ts
//
// Runs as its own process in production (`npm run start:worker`), so a slow or
// failing OpenAI call never competes with API request handling for CPU/event
// loop time. Can also run in-process for local dev (RUN_WORKER_IN_API=true).
import { Worker, type Job } from "bullmq";
import mongoose from "mongoose";
import { getRedis } from "../config/redis";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { Employee } from "../modules/employee/employee.model";
import { aiService } from "../modules/ai/ai.service";
import { cache } from "../core/cache/cacheService";
import { CacheNamespace } from "../constants/cacheKeys";
import {
  ATTRITION_QUEUE,
  QUEUE_PREFIX,
  SENTIMENT_QUEUE,
  type AttritionJobData,
  type SentimentJobData,
} from "../modules/ai/ai.queue";

const processSentiment = async (job: Job<SentimentJobData>): Promise<void> => {
  const { employeeId, noteId, note } = job.data;
  const result = await aiService.analyzeSentiment(note);

  await Employee.updateOne(
    { _id: employeeId, "performanceNotes._id": new mongoose.Types.ObjectId(noteId) },
    { $set: { "performanceNotes.$.sentiment": result.sentiment, "performanceNotes.$.sentimentScore": result.score } }
  );
  await cache.invalidate(CacheNamespace.EMPLOYEE);
  logger.info("Sentiment saved", { employeeId, noteId, sentiment: result.sentiment });
};

const processAttrition = async (job: Job<AttritionJobData>): Promise<void> => {
  const { employeeId } = job.data;
  const employee = await Employee.findById(employeeId);
  if (!employee) {
    logger.warn("Attrition job skipped — employee not found", { employeeId });
    return;
  }

  const tenureMonths = Math.floor((Date.now() - employee.joiningDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const recentSentiments = employee.performanceNotes
    .filter((n) => n.sentimentScore !== undefined)
    .slice(-10)
    .map((n) => n.sentimentScore as number);

  const result = await aiService.predictAttrition({
    tenureMonths,
    salary: employee.salary,
    department: employee.department,
    designation: employee.designation,
    status: employee.status,
    recentSentiments,
    noteCount: employee.performanceNotes.length,
  });

  await Employee.updateOne(
    { _id: employeeId },
    { $set: { attritionRisk: result.risk, attritionRiskUpdatedAt: new Date() } }
  );
  await cache.invalidate(CacheNamespace.EMPLOYEE);
  logger.info("Attrition risk updated", { employeeId, risk: result.risk });
};

export interface AiWorkerHandle {
  close(): Promise<void>;
}

export const runAiWorker = (): AiWorkerHandle => {
  const connection = getRedis("queue");

  const sentimentWorker = new Worker<SentimentJobData>(SENTIMENT_QUEUE, processSentiment, {
    connection,
    prefix: QUEUE_PREFIX,
    concurrency: env.worker.sentimentConcurrency,
  });

  const attritionWorker = new Worker<AttritionJobData>(ATTRITION_QUEUE, processAttrition, {
    connection,
    prefix: QUEUE_PREFIX,
    concurrency: env.worker.attritionConcurrency,
  });

  for (const [name, worker] of [["sentiment", sentimentWorker], ["attrition", attritionWorker]] as const) {
    worker.on("failed", (job, err) => logger.error(`Worker[${name}] job failed`, { jobId: job?.id, error: err.message }));
    worker.on("error", (err) => logger.error(`Worker[${name}] error`, { error: err.message }));
  }

  return {
    async close() {
      await Promise.all([sentimentWorker.close(), attritionWorker.close()]);
    },
  };
};

// Standalone entrypoint: `npm run start:worker` / `npm run dev:worker`.
if (require.main === module) {
  void (async () => {
    const { connectDB, closeDB } = await import("../config/db");
    const { connectRedis, closeRedis } = await import("../config/redis");

    await connectDB();
    await connectRedis(["queue", "cache"]);
    const handle = runAiWorker();
    logger.info("AI worker process started");

    const shutdown = (signal: string): void => {
      logger.info(`${signal} received — draining worker`);
      void handle
        .close()
        .then(closeDB)
        .then(() => closeRedis())
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          logger.error("Worker shutdown error", { error: error instanceof Error ? error.message : error });
          process.exit(1);
        });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })();
}
