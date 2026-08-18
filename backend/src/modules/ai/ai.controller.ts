// src/modules/ai/ai.controller.ts
import type { Response } from "express";
import multer from "multer";
import { aiService } from "./ai.service";
import { env } from "../../config/env";
import { AppError } from "../../core/errors/AppError";
import { ok } from "../../core/http/apiResponse";
import type { AuthRequest } from "../../types";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.openai.resumeMaxBytes },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "text/plain"];
    cb(null, allowed.includes(file.mimetype));
  },
});

export const aiController = {
  uploadMiddleware: upload.single("resume"),

  async parseResume(req: AuthRequest, res: Response): Promise<void> {
    if (!req.file) throw AppError.badRequest("No resume file uploaded (PDF or TXT, field name 'resume')");
    const result = await aiService.parseResume(req.file.buffer, req.file.mimetype);
    ok(res, result, "Resume parsed successfully");
  },

  async analyzeSentiment(req: AuthRequest, res: Response): Promise<void> {
    const { note } = req.body as { note: string };
    const result = await aiService.analyzeSentiment(note);
    ok(res, result, "Sentiment analyzed");
  },
};
