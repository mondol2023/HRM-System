// src/app.ts
import express, { type Application } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";

import { env } from "./config/env";
import { requestContext } from "./middleware/requestContext.middleware";
import { httpLogger } from "./middleware/httpLogger.middleware";
import { sanitize } from "./middleware/sanitize.middleware";
import { notFound } from "./middleware/notFound.middleware";
import { errorHandler } from "./middleware/error.middleware";

import healthRoutes from "./modules/health/health.routes";
import apiRoutes from "./routes/index";

export const createApp = (): Application => {
  const app = express();

  // Accurate hop count so req.ip reflects the real client, not a spoofable header.
  app.set("trust proxy", env.trustProxyHops);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
      exposedHeaders: ["x-request-id"],
    })
  );

  app.use(express.json({ limit: env.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: env.bodyLimit }));
  app.use(cookieParser(env.auth.cookieSecret));

  app.use(requestContext);
  app.use(httpLogger);
  app.use(sanitize);

  app.use("/health", healthRoutes);
  app.use("/api/v1", apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
