import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ServiceStatus = "pending" | "approved" | "rejected";

export interface IService extends Document {
  vendorId: Types.ObjectId | string;
  vendorName?: string;
  businessName?: string;
  serviceName: string;
  category: string;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: ServiceStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IService>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Vendor ID is required"],
      index: true,
    },
    vendorName: {
      type: String,
      trim: true,
    },
    businessName: {
      type: String,
      trim: true,
    },
    serviceName: {
      type: String,
      required: [true, "Service name is required"],
      trim: true,
      maxlength: 140,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
      index: true,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
      index: true,
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

export const Service: Model<IService> =
  mongoose.models.Service || mongoose.model<IService>("Service", ServiceSchema);