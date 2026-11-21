import mongoose, { Schema, Document, Types } from "mongoose";

export type BookingStatus = "Pending" | "Accepted" | "Rejected" | "Cancelled";

export interface IBooking extends Document {
  serviceId: Types.ObjectId;
  vendorId: Types.ObjectId;
  customerId: Types.ObjectId;
  eventDate: string;
  eventLocation: string;
  message?: string;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventDate: {
      type: String,
      required: true,
      trim: true,
    },
    eventLocation: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Cancelled"],
      default: "Pending",
      index: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate active (Pending or Accepted) booking requests for the same service + customer + eventDate
BookingSchema.index(
  { serviceId: 1, customerId: 1, eventDate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["Pending", "Accepted"] },
    },
  }
);

export const Booking =
  mongoose.models.Booking || mongoose.model<IBooking>("Booking", BookingSchema);