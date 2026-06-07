// src/modules/ai/ai.service.ts
import OpenAI from "openai";
import pdfParse from "pdf-parse";
import { IResumeParseResult, ISentimentResult, IAttritionResult, AppError } from "../../types";
import { logger } from "../../config/logger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class AiService {
  // ─── Resume Parsing ───────────────────────────────────────────────────────
  async parseResume(fileBuffer: Buffer, mimeType: string): Promise<IResumeParseResult> {
    let text = "";

    if (mimeType === "application/pdf") {
      const parsed = await pdfParse(fileBuffer);
      text = parsed.text;
    } else if (mimeType === "text/plain") {
      text = fileBuffer.toString("utf-8");
    } else {
      throw new AppError("Only PDF or TXT resumes are supported", 400);
    }

    if (text.length < 50) throw new AppError("Resume content too short to parse", 422);

    const prompt = `
You are an expert HR recruiter and resume parser.
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
"""
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new AppError("OpenAI returned empty response", 502);

      return JSON.parse(content) as IResumeParseResult;
    } catch (err) {
      logger.error("Resume parse OpenAI error:", err);
      throw new AppError("AI resume parsing failed", 502);
    }
  }

  // ─── Sentiment Analysis ───────────────────────────────────────────────────
  async analyzeSentiment(note: string): Promise<ISentimentResult> {
    const prompt = `
Analyze the sentiment of the following employee performance note.
Return ONLY a valid JSON object:
{
  "sentiment": "positive" | "neutral" | "negative",
  "score": <number between -1.0 (very negative) and 1.0 (very positive)>,
  "reasoning": "Brief explanation in 1-2 sentences"
}

Performance note:
"${note}"
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new AppError("OpenAI returned empty response", 502);

    return JSON.parse(content) as ISentimentResult;
  }

  // ─── Attrition Risk Prediction ────────────────────────────────────────────
  async predictAttrition(employeeData: {
    tenure: number; // months
    salary: number;
    department: string;
    designation: string;
    status: string;
    recentSentiments: number[]; // array of sentiment scores
    noteCount: number;
  }): Promise<IAttritionResult> {
    const avgSentiment =
      employeeData.recentSentiments.length > 0
        ? employeeData.recentSentiments.reduce((a, b) => a + b, 0) /
          employeeData.recentSentiments.length
        : 0;

    const prompt = `
You are an HR analytics expert specializing in employee retention.
Analyze the following employee data and predict attrition risk.
Return ONLY a valid JSON object:
{
  "risk": <number between 0.0 (no risk) and 1.0 (certain to leave)>,
  "factors": ["factor1", "factor2", "factor3"],
  "recommendation": "Actionable recommendation for HR in 2-3 sentences"
}

Employee data:
- Tenure: ${employeeData.tenure} months
- Salary: $${employeeData.salary}
- Department: ${employeeData.department}
- Designation: ${employeeData.designation}
- Status: ${employeeData.status}
- Average performance sentiment: ${avgSentiment.toFixed(2)} (scale: -1 negative to +1 positive)
- Number of performance notes: ${employeeData.noteCount}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new AppError("OpenAI returned empty response", 502);

    return JSON.parse(content) as IAttritionResult;
  }
}

export const aiService = new AiService();