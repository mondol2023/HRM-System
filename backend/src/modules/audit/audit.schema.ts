// src/modules/audit/audit.schema.ts
import Joi from "joi";
import { AUDIT_ACTIONS, asMutable } from "../../constants/enums";

const objectId = Joi.string().hex().length(24);

export const listAuditSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  targetType: Joi.string().trim().max(50).optional(),
  targetId: objectId.optional(),
  actorId: objectId.optional(),
  action: Joi.string()
    .valid(...asMutable(AUDIT_ACTIONS))
    .optional(),
});
