// src/modules/ai/ai.controller.ts
import { Response, NextFunction } from "express";
import multer from "multer";
import { AuthRequest } from "../../types";
import { aiService } from "./ai.service";
import { AppError } from "../../types";

// Memory storage for file upload (buffer passed directly to AI)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "text/plain"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError("Only PDF or TXT files allowed", 400));
    }
  },
});

export class AiController {
  // Expose multer middleware for routing
  uploadMiddleware = upload.single("resume");

  async parseResume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new AppError("No resume file uploaded", 400);
      const result = await aiService.parseResume(req.file.buffer, req.file.mimetype);
      res.json({ success: true, message: "Resume parsed successfully", data: result });
    } catch (err) { next(err); }
  }

  async analyzeSentiment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { note } = req.body as { note: string };
      if (!note || note.trim().length < 10) {
        throw new AppError("Note must be at least 10 characters", 422);
      }
      const result = await aiService.analyzeSentiment(note);
      res.json({ success: true, message: "Sentiment analyzed", data: result });
    } catch (err) { next(err); }
  }
}

export const aiController = new AiController();