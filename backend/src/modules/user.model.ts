// src/modules/auth/user.model.ts
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { IUser } from "../../types";

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: {
      type: String,
      enum: ["admin", "hr", "manager", "employee"],
      default: "employee",
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Hash password before save
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
  this.password = await bcrypt.hash(this.password, rounds);
  next();
});

UserSchema.methods.comparePassword = async function (
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Never expose password in JSON output
UserSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

export const User = mongoose.model<IUser>("User", UserSchema);