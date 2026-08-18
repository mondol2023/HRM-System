// src/modules/ai/ai.queue.ts
//
// Producer side only. The API enqueues; a separate worker process consumes, so
// a slow OpenAI call can never occupy a request thread.
//
// Two queues, not one queue with two job names: BullMQ concurrency is set per
// Worker, and sentiment/attrition need different concurrency budgets.
import { Queue, type JobsOptions } from "bullmq";
import { getRedis } from "../../config/redis";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

export const QUEUE_PREFIX = `${env.redis.keyPrefix}:bull`;
export const SENTIMENT_QUEUE = "ai-sentiment";
export const ATTRITION_QUEUE = "ai-attrition";

export interface SentimentJobData {
  employeeId: string;
  noteId: string;
  note: string;
}

export interface AttritionJobData {
  employeeId: string;
}

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { count: 100, age: 3600 },
  removeOnFail: { count: 500 },
};

let sentimentQueue: Queue<SentimentJobData> | null = null;
let attritionQueue: Queue<AttritionJobData> | null = null;

const makeQueue = <T>(name: string): Queue<T> => {
  const queue = new Queue<T>(name, { connection: getRedis("queue"), prefix: QUEUE_PREFIX, defaultJobOptions });
  queue.on("error", (error: Error) => logger.error(`Queue[${name}] error`, { error: error.message }));
  return queue;
};

export const aiQueue = {
  async sentiment(data: SentimentJobData): Promise<void> {
    sentimentQueue ??= makeQueue<SentimentJobData>(SENTIMENT_QUEUE);
    await sentimentQueue.add("sentiment", data);
  },

  /**
   * Debounced: one pending recompute per employee. Notes often arrive in bursts
   * and only the final state matters, so a fixed jobId collapses them.
   */
  async attrition(employeeId: string): Promise<void> {
    attritionQueue ??= makeQueue<AttritionJobData>(ATTRITION_QUEUE);
    await attritionQueue.add(
      "attrition",
      { employeeId },
      { jobId: `attrition:${employeeId}`, delay: 5000 }
    );
  },

  async close(): Promise<void> {
    await Promise.all([sentimentQueue?.close(), attritionQueue?.close()]);
    sentimentQueue = null;
    attritionQueue = null;
  },
};
