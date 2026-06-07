// src/modules/ai/ai.queue.ts
import Bull, { Queue, Job } from "bull";
import { Employee } from "../employee/employee.model";
import { aiService } from "./ai.service";
import { logger } from "../../config/logger";
import mongoose from "mongoose";

interface SentimentJobData {
  employeeId: string;
  noteId: string;
  note: string;
}

interface AttritionJobData {
  employeeId: string;
}

// Singleton queue instance
let queue: Queue;

export const initQueues = (): void => {
  const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  };

  queue = new Bull("ai-tasks", {
    redis: redisConfig,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  // ─── Process sentiment jobs ─────────────────────────────────────────────
  queue.process("sentiment", 3, async (job: Job<SentimentJobData>) => {
    const { employeeId, noteId, note } = job.data;
    logger.info(`[Queue] Analyzing sentiment for note ${noteId}`);

    const result = await aiService.analyzeSentiment(note);

    await Employee.updateOne(
      { _id: employeeId, "performanceNotes._id": new mongoose.Types.ObjectId(noteId) },
      {
        $set: {
          "performanceNotes.$.sentiment": result.sentiment,
          "performanceNotes.$.sentimentScore": result.score,
        },
      }
    );

    logger.info(`[Queue] Sentiment saved for note ${noteId}: ${result.sentiment}`);
    return result;
  });

  // ─── Process attrition jobs ─────────────────────────────────────────────
  queue.process("attrition", 2, async (job: Job<AttritionJobData>) => {
    const { employeeId } = job.data;
    logger.info(`[Queue] Predicting attrition for employee ${employeeId}`);

    const emp = await Employee.findById(employeeId).populate("userId");
    if (!emp) {
      logger.warn(`[Queue] Employee ${employeeId} not found for attrition`);
      return;
    }

    const tenureMonths = Math.floor(
      (Date.now() - emp.joiningDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    const recentSentiments = emp.performanceNotes
      .filter((n) => n.sentimentScore !== undefined)
      .slice(-10)
      .map((n) => n.sentimentScore as number);

    const result = await aiService.predictAttrition({
      tenure: tenureMonths,
      salary: emp.salary,
      department: emp.department,
      designation: emp.designation,
      status: emp.status,
      recentSentiments,
      noteCount: emp.performanceNotes.length,
    });

    await Employee.findByIdAndUpdate(employeeId, {
      attritionRisk: result.risk,
      attritionRiskUpdatedAt: new Date(),
    });

    logger.info(`[Queue] Attrition risk for ${employeeId}: ${result.risk}`);
    return result;
  });

  // ─── Queue event listeners ──────────────────────────────────────────────
  queue.on("failed", (job, err) => {
    logger.error(`[Queue] Job ${job.id} (${job.name}) failed:`, err.message);
  });

  queue.on("completed", (job) => {
    logger.debug(`[Queue] Job ${job.id} (${job.name}) completed`);
  });

  logger.info("✅ AI Queue initialized");
};

export const aiQueue = {
  add: async (name: string, data: SentimentJobData | AttritionJobData) => {
    if (!queue) throw new Error("Queue not initialized");
    return queue.add(name, data);
  },
};