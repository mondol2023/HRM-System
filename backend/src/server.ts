// src/server.ts
import { createApp } from "./app";
import { env } from "./config/env";
import { connectDB, closeDB } from "./config/db";
import { connectRedis, closeRedis } from "./config/redis";
import { logger } from "./config/logger";
import { markShuttingDown } from "./core/shutdownState";
import { aiQueue } from "./modules/ai/ai.queue";
import { runAiWorker, type AiWorkerHandle } from "./workers/ai.worker";

const bootstrap = async (): Promise<void> => {
  await connectDB();

  const redisRoles: Array<"cache" | "limiter" | "queue"> = ["cache", "limiter"];
  if (env.worker.runInApi) redisRoles.push("queue");
  await connectRedis(redisRoles);

  let inProcessWorker: AiWorkerHandle | undefined;
  if (env.worker.runInApi) {
    inProcessWorker = runAiWorker();
    logger.warn("AI worker running in-process (RUN_WORKER_IN_API=true) — dev only");
  }

  const app = createApp();
  const server = app.listen(env.port, env.host, () => {
    logger.info(`HRM API listening on ${env.host}:${env.port} [${env.nodeEnv}]`);
  });

  // Must exceed any upstream load balancer's idle timeout, or the LB can send
  // a request on a socket this process just closed.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    markShuttingDown();
    logger.info(`${signal} received — draining`);

    const forceExit = setTimeout(() => {
      logger.error("Shutdown timed out — forcing exit");
      process.exit(1);
    }, env.shutdownTimeoutMs);
    forceExit.unref();

    server.close(() => {
      void (async () => {
        try {
          if (inProcessWorker) await inProcessWorker.close();
          await aiQueue.close();
          await closeDB();
          await closeRedis();
          logger.info("Shutdown complete");
          clearTimeout(forceExit);
          process.exit(0);
        } catch (error) {
          logger.error("Error during shutdown", { error: (error as Error).message });
          process.exit(1);
        }
      })();
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { reason: reason instanceof Error ? reason.message : reason });
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error: error.message, stack: error.stack });
    shutdown("uncaughtException");
  });
};

bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Bootstrap failed:", error);
  process.exit(1);
});
