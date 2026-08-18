// src/modules/auth/user.model.ts
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { USER_ROLES, asMutable } from "../../constants/enums";
import type { IUser } from "../../types";

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: asMutable(USER_ROLES), default: "employee" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Login filters on both fields together.
UserSchema.index({ email: 1, isActive: 1 });

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, env.auth.bcryptRounds);
  next();
});

UserSchema.methods["comparePassword"] = async function (this: IUser, candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

UserSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj["password"];
    delete obj["__v"];
    return obj;
  },
});

export const User = mongoose.model<IUser>("User", UserSchema);
