// src/cluster.ts
//
// Production entrypoint. One worker process per core shares the listening
// socket via the OS, multiplying single-process throughput without any
// application-level change — this is how 150 rps stays comfortable on modest
// hardware.
import cluster from "node:cluster";
import os from "node:os";
import { env } from "./config/env";
import { logger } from "./config/logger";

const workerCount = env.clusterWorkers > 0 ? env.clusterWorkers : os.cpus().length;

if (cluster.isPrimary) {
  logger.info(`Primary ${process.pid} starting ${workerCount} workers`);

  for (let i = 0; i < workerCount; i += 1) cluster.fork();

  cluster.on("exit", (worker, code, signal) => {
    logger.warn("Worker died — restarting", { pid: worker.process.pid, code, signal });
    cluster.fork();
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info(`Primary received ${signal} — stopping workers`);
    for (const worker of Object.values(cluster.workers ?? {})) worker?.process.kill(signal);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
} else {
  void import("./server");
}
