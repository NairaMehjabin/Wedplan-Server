import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type TransactionStatus = "completed" | "pending" | "failed";

export interface ITransaction extends Document {
  vendorId: Types.ObjectId;
  vendorName?: string;
  vendorEmail?: string;
  businessName?: string;
  plan: "free" | "premium";
  amount: number;
  currency: string;
  status: TransactionStatus;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vendorName: { type: String, trim: true },
    vendorEmail: { type: String, trim: true },
    businessName: { type: String, trim: true },
    plan: {
      type: String,
      enum: ["free", "premium"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
      trim: true,
    },
    status: {
      type: String,
      enum: ["completed", "pending", "failed"],
      default: "completed",
    },
    stripeSessionId: { type: String, index: true, sparse: true },
    stripePaymentIntentId: { type: String },
    stripeCustomerId: { type: String },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);