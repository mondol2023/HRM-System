// src/modules/auth/auth.service.ts
import jwt from "jsonwebtoken";
import { User } from "./user.model";
import { IUser, ITokenPayload, AppError } from "../../types";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export class AuthService {
  generateToken(payload: ITokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  }

  async register(data: {
    name: string;
    email: string;
    password: string;
    role?: IUser["role"];
  }): Promise<{ user: IUser; token: string }> {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError("Email already in use", 409);

    const user = await User.create(data);

    const token = this.generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return { user, token };
  }

  async login(email: string, password: string): Promise<{ user: IUser; token: string }> {
    const user = await User.findOne({ email, isActive: true }).select("+password");
    if (!user) throw new AppError("Invalid credentials", 401);

    const valid = await user.comparePassword(password);
    if (!valid) throw new AppError("Invalid credentials", 401);

    const token = this.generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return { user, token };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await User.findById(userId).select("+password");
    if (!user) throw new AppError("User not found", 404);

    const valid = await user.comparePassword(currentPassword);
    if (!valid) throw new AppError("Current password is incorrect", 401);

    user.password = newPassword;
    await user.save();
  }

  async getMe(userId: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    return user;
  }
}

export const authService = new AuthService();