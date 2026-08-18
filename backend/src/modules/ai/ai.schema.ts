// src/modules/ai/ai.schema.ts
import Joi from "joi";

export const sentimentSchema = Joi.object({
  note: Joi.string().trim().min(10).max(2000).required(),
});
