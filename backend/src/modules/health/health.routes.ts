// src/modules/health/health.routes.ts
//
// Split liveness/readiness: a load balancer stops routing to a not-ready pod
// without killing it, while an orchestrator restarts a dead-livenessed one.
import { Router } from "express";
import { isDbHealthy, pingDb } from "../../config/db";
import { pingRedis } from "../../config/redis";
import { isShuttingDown } from "../../core/shutdownState";

const router = Router();

router.get("/live", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/ready", async (_req, res) => {
  if (isShuttingDown()) {
    res.status(503).json({ status: "shutting_down" });
    return;
  }

  const [db, cache] = await Promise.all([pingDb(), pingRedis("cache")]);
  const ready = db && cache;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    db: db ? "up" : "down",
    cache: cache ? "up" : "down",
    mongoState: isDbHealthy() ? "connected" : "disconnected",
  });
});

export default router;
