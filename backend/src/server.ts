// src/server.ts
import "dotenv/config";
import { createApp } from "./app";
import { connectDB } from "./config/db";
import { getRedis } from "./config/redis";
import { logger } from "./config/logger";
import { initQueues } from "./modules/ai/ai.queue";

const PORT = parseInt(process.env.PORT || "5000");

const bootstrap = async (): Promise<void> => {
  await connectDB();
  await getRedis().connect();
  initQueues();

  const app = createApp();

  const server = app.listen(PORT, () => {
    logger.info(`🚀 HRM Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  // ─── Graceful shutdown ───────────────────────────────────────────────────
  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection:", reason);
    server.close(() => process.exit(1));
  });

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception:", err);
    process.exit(1);
  });
};

bootstrap().catch((err) => {
  logger.error("Bootstrap failed:", err);
  process.exit(1);
});