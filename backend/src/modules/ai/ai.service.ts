// src/modules/ai/ai.service.ts
import OpenAI from "openai";
import pdfParse from "pdf-parse";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AppError } from "../../core/errors/AppError";
import type { IAttritionResult, IResumeParseResult, ISentimentResult } from "../../types";

const openai = new OpenAI({
  apiKey: env.openai.apiKey,
  timeout: env.openai.timeoutMs,
  maxRetries: env.openai.maxRetries,
});

const PDF_MAGIC = Buffer.from("%PDF");

/** Content sniff, not just the declared mimetype — an uploader can lie about it. */
const isPdf = (buffer: Buffer): boolean => buffer.subarray(0, 4).equals(PDF_MAGIC);

const isPlainText = (buffer: Buffer): boolean => {
  // Reject anything with embedded nulls / control bytes — not real text.
  const sample = buffer.subarray(0, 1000);
  for (const byte of sample) {
    if (byte === 0) return false;
  }
  return true;
};

const extractJson = <T>(content: string | null | undefined, context: string): T => {
  if (!content) throw AppError.upstream(`OpenAI returned an empty response (${context})`);
  try {
    return JSON.parse(content) as T;
  } catch {
    throw AppError.upstream(`OpenAI returned malformed JSON (${context})`);
  }
};

const chatJson = async (prompt: string, maxTokens: number, temperature: number): Promise<string | null> => {
  const response = await openai.chat.completions.create({
    model: env.openai.model,
    messages: [{ role: "user", content: prompt }],
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });
  return response.choices[0]?.message?.content ?? null;
};

export const aiService = {
  async parseResume(fileBuffer: Buffer, declaredMimeType: string): Promise<IResumeParseResult> {
    let text: string;

    if (declaredMimeType === "application/pdf") {
      if (!isPdf(fileBuffer)) throw AppError.badRequest("File is not a valid PDF");
      text = (await pdfParse(fileBuffer)).text;
    } else if (declaredMimeType === "text/plain") {
      if (!isPlainText(fileBuffer)) throw AppError.badRequest("File is not valid plain text");
      text = fileBuffer.toString("utf-8");
    } else {
      throw AppError.badRequest("Only PDF or TXT resumes are supported");
    }

    if (text.trim().length < 50) throw AppError.validation("Resume content too short to parse");

    const prompt = `You are an expert HR recruiter and resume parser.
Parse the following resume text and extract structured information.
Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number or null",
  "skills": ["skill1", "skill2"],
  "experience": "Summary of work experience",
  "education": "Education details",
  "summary": "Professional summary in 2-3 sentences",
  "suggestedDesignation": "Best fitting job title",
  "suggestedDepartment": "One of: engineering|hr|finance|marketing|operations|sales|legal"
}

Resume text:
"""
${text.slice(0, 6000)}
"""`;

    try {
      const content = await chatJson(prompt, 1000, 0.2);
      return extractJson<IResumeParseResult>(content, "resume parse");
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Resume parse OpenAI call failed", { error: (error as Error).message });
      throw AppError.upstream("AI resume parsing failed");
    }
  },

  async analyzeSentiment(note: string): Promise<ISentimentResult> {
    const prompt = `Analyze the sentiment of the following employee performance note.
Return ONLY a valid JSON object:
{
  "sentiment": "positive" | "neutral" | "negative",
  "score": <number between -1.0 (very negative) and 1.0 (very positive)>,
  "reasoning": "Brief explanation in 1-2 sentences"
}

Performance note:
"${note}"`;

    try {
      const content = await chatJson(prompt, 300, 0.1);
      return extractJson<ISentimentResult>(content, "sentiment");
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Sentiment OpenAI call failed", { error: (error as Error).message });
      throw AppError.upstream("AI sentiment analysis failed");
    }
  },

  async predictAttrition(input: {
    tenureMonths: number;
    salary: number;
    department: string;
    designation: string;
    status: string;
    recentSentiments: number[];
    noteCount: number;
  }): Promise<IAttritionResult> {
    const avgSentiment =
      input.recentSentiments.length > 0
        ? input.recentSentiments.reduce((a, b) => a + b, 0) / input.recentSentiments.length
        : 0;

    const prompt = `You are an HR analytics expert specializing in employee retention.
Analyze the following employee data and predict attrition risk.
Return ONLY a valid JSON object:
{
  "risk": <number between 0.0 (no risk) and 1.0 (certain to leave)>,
  "factors": ["factor1", "factor2", "factor3"],
  "recommendation": "Actionable recommendation for HR in 2-3 sentences"
}

Employee data:
- Tenure: ${input.tenureMonths} months
- Salary: $${input.salary}
- Department: ${input.department}
- Designation: ${input.designation}
- Status: ${input.status}
- Average performance sentiment: ${avgSentiment.toFixed(2)} (scale: -1 negative to +1 positive)
- Number of performance notes: ${input.noteCount}`;

    try {
      const content = await chatJson(prompt, 400, 0.2);
      return extractJson<IAttritionResult>(content, "attrition");
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Attrition OpenAI call failed", { error: (error as Error).message });
      throw AppError.upstream("AI attrition prediction failed");
    }
  },
};
