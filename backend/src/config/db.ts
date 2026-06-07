// src/config/db.ts
import mongoose from "mongoose";
import { logger } from "./logger";

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI as string;
  if (!uri) throw new Error("MONGO_URI not defined in environment");

  try {
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info("✅ MongoDB connected");

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected. Reconnecting...");
    });
  } catch (err) {
    logger.error("MongoDB connection failed:", err);
    process.exit(1);
  }
};