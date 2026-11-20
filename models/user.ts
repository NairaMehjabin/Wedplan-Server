import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "customer" | "vendor" | "admin";
export type SubscriptionPlan = "free" | "premium";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  image?: string | null;
  role: UserRole;
  isBlocked: boolean;
  businessName?: string;
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },
    image: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["customer", "vendor", "admin"],
      default: "customer",
      index: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    businessName: {
      type: String,
      trim: true,
    },
    subscriptionPlan: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);