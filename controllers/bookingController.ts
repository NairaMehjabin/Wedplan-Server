import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { Booking, BookingStatus } from "../models/booking";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  "wedplan-dev-jwt-secret";

type UserRole = "customer" | "vendor" | "admin";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isBlocked: boolean;
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;
  return Buffer.from(padded, "base64").toString("utf8");
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function verifyJwtToken(
  token: string
): { userId: string; email: string; role: UserRole } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const unsigned = `${header}.${body}`;
    const expectedSig = base64UrlEncode(
      crypto.createHmac("sha256", JWT_SECRET).update(unsigned).digest()
    );
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const decoded = JSON.parse(base64UrlDecode(body)) as {
      userId?: string;
      email?: string;
      role?: UserRole;
      exp?: number;
    };
    if (!decoded.userId || !decoded.email || !decoded.role) return null;
    if (
      typeof decoded.exp === "number" &&
      decoded.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

  if (!token) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const decoded = verifyJwtToken(token);
  if (!decoded || !mongoose.Types.ObjectId.isValid(decoded.userId)) {
    res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
    return;
  }

  const usersCol = mongoose.connection.collection("users");
  const dbUser = await usersCol.findOne({
    _id: new mongoose.Types.ObjectId(decoded.userId),
  });

  if (!dbUser) {
    res.status(401).json({ success: false, message: "User not found" });
    return;
  }

  if (dbUser.isBlocked) {
    res.status(403).json({ success: false, message: "Account is blocked" });
    return;
  }

  req.authUser = {
    id: String(dbUser._id),
    email: String(dbUser.email),
    name: String(dbUser.name || ""),
    role: (dbUser.role as UserRole) || "customer",
    isBlocked: Boolean(dbUser.isBlocked),
  };

  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({
        success: false,
        message: "Forbidden: insufficient role permissions",
      });
      return;
    }
    next();
  };
}

export async function createBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = req.authUser!;
    const { serviceId, eventDate, eventLocation, message } = req.body as {
      serviceId?: string;
      eventDate?: string;
      eventLocation?: string;
      message?: string;
    };

    if (!serviceId || !mongoose.Types.ObjectId.isValid(String(serviceId))) {
      res
        .status(400)
        .json({ success: false, message: "Valid serviceId is required" });
      return;
    }

    const cleanDate = String(eventDate || "").trim();
    const cleanLocation = String(eventLocation || "").trim();
    if (!cleanDate || !cleanLocation) {
      res.status(400).json({
        success: false,
        message: "Event date and event location are required",
      });
      return;
    }

    const servicesCol = mongoose.connection.collection("services");
    const service = await servicesCol.findOne({
      _id: new mongoose.Types.ObjectId(String(serviceId)),
    });

    if (!service) {
      res.status(404).json({ success: false, message: "Service not found" });
      return;
    }

    const serviceStatus = String(service.status || "").toLowerCase();
    if (serviceStatus !== "approved" || service.isActive === false) {
      res.status(400).json({
        success: false,
        message: "Only approved and active services can be booked",
      });
      return;
    }

    const serviceVendorId = service.vendorId ? String(service.vendorId) : "";
    if (!serviceVendorId || !mongoose.Types.ObjectId.isValid(serviceVendorId)) {
      res.status(400).json({
        success: false,
        message: "Service does not have a valid vendor assigned",
      });
      return;
    }

    if (serviceVendorId === authUser.id) {
      res.status(400).json({
        success: false,
        message: "You cannot book your own service",
      });
      return;
    }

    const customerObjectId = new mongoose.Types.ObjectId(authUser.id);
    const serviceObjectId = new mongoose.Types.ObjectId(String(serviceId));
    const vendorObjectId = new mongoose.Types.ObjectId(serviceVendorId);

    const duplicate = await Booking.findOne({
      serviceId: serviceObjectId,
      customerId: customerObjectId,
      eventDate: cleanDate,
      status: { $in: ["Pending", "Accepted"] },
    }).lean();

    if (duplicate) {
      res.status(409).json({
        success: false,
        message:
          "You already have an active booking request for this service on this date",
      });
      return;
    }

    const created = await Booking.create({
      serviceId: serviceObjectId,
      vendorId: vendorObjectId,
      customerId: customerObjectId,
      eventDate: cleanDate,
      eventLocation: cleanLocation,
      message: message ? String(message).trim() : "",
      status: "Pending",
    });

    res.status(201).json({
      success: true,
      message: "Booking request submitted",
      data: created,
    });
  } catch (error: unknown) {
    const mongoErr = error as { code?: number };
    if (mongoErr?.code === 11000) {
      res.status(409).json({
        success: false,
        message:
          "Duplicate active booking request for this service and event date",
      });
      return;
    }
    console.error("Create booking error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to submit booking request" });
  }
}

export async function getMyBookings(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = req.authUser!;
    const customerObjectId = new mongoose.Types.ObjectId(authUser.id);

    const rawBookings = await Booking.find({ customerId: customerObjectId })
      .sort({ createdAt: -1 })
      .lean();

    const serviceIds = [
      ...new Set(rawBookings.map((b) => String(b.serviceId)).filter(Boolean)),
    ]
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const vendorIds = [
      ...new Set(rawBookings.map((b) => String(b.vendorId)).filter(Boolean)),
    ]
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const servicesCol = mongoose.connection.collection("services");
    const usersCol = mongoose.connection.collection("users");

    const [servicesDocs, vendorsDocs] = await Promise.all([
      serviceIds.length
        ? servicesCol.find({ _id: { $in: serviceIds } }).toArray()
        : Promise.resolve([]),
      vendorIds.length
        ? usersCol.find({ _id: { $in: vendorIds } }).toArray()
        : Promise.resolve([]),
    ]);

    const serviceMap = new Map(servicesDocs.map((s) => [String(s._id), s]));
    const vendorMap = new Map(vendorsDocs.map((v) => [String(v._id), v]));

    const formatted = rawBookings.map((b) => {
      const srv = serviceMap.get(String(b.serviceId));
      const vnd = vendorMap.get(String(b.vendorId));
      const images = Array.isArray(srv?.images) ? srv.images : [];

      return {
        _id: String(b._id),
        serviceId: String(b.serviceId),
        serviceName: String(srv?.serviceName || "Wedding Service"),
        serviceImage: srv?.img || images[0] || "",
        category: String(srv?.category || ""),
        price: typeof srv?.price === "number" ? srv.price : undefined,
        vendorId: String(b.vendorId),
        vendorName: String(vnd?.name || srv?.vendorName || "Vendor"),
        businessName: String(vnd?.businessName || srv?.businessName || ""),
        eventDate: b.eventDate,
        eventLocation: b.eventLocation,
        message: b.message || "",
        status: b.status as BookingStatus,
        createdAt: b.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error("Get my bookings error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to load your bookings" });
  }
}

export async function cancelMyBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = req.authUser!;
    const bookingId = String(req.params.id || "");

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      res.status(400).json({ success: false, message: "Invalid booking ID" });
      return;
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }

    if (String(booking.customerId) !== authUser.id) {
      res.status(403).json({
        success: false,
        message: "You cannot cancel another customer's booking",
      });
      return;
    }

    if (booking.status !== "Pending") {
      res.status(400).json({
        success: false,
        message: `Cannot cancel a booking that is already ${booking.status}`,
      });
      return;
    }

    booking.status = "Cancelled";
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking request cancelled",
      data: booking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to cancel booking request" });
  }
}

export async function getVendorBookings(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = req.authUser!;
    const vendorObjectId = new mongoose.Types.ObjectId(authUser.id);

    const rawBookings = await Booking.find({ vendorId: vendorObjectId })
      .sort({ createdAt: -1 })
      .lean();

    const serviceIds = [
      ...new Set(rawBookings.map((b) => String(b.serviceId)).filter(Boolean)),
    ]
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const customerIds = [
      ...new Set(rawBookings.map((b) => String(b.customerId)).filter(Boolean)),
    ]
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const servicesCol = mongoose.connection.collection("services");
    const usersCol = mongoose.connection.collection("users");

    const [servicesDocs, customersDocs] = await Promise.all([
      serviceIds.length
        ? servicesCol.find({ _id: { $in: serviceIds } }).toArray()
        : Promise.resolve([]),
      customerIds.length
        ? usersCol.find({ _id: { $in: customerIds } }).toArray()
        : Promise.resolve([]),
    ]);

    const serviceMap = new Map(servicesDocs.map((s) => [String(s._id), s]));
    const customerMap = new Map(customersDocs.map((c) => [String(c._id), c]));

    const formatted = rawBookings.map((b) => {
      const srv = serviceMap.get(String(b.serviceId));
      const cust = customerMap.get(String(b.customerId));

      return {
        _id: String(b._id),
        serviceId: String(b.serviceId),
        serviceName: String(srv?.serviceName || "Wedding Service"),
        customerId: String(b.customerId),
        customerName: String(cust?.name || "Customer"),
        customerEmail: String(cust?.email || ""),
        eventDate: b.eventDate,
        eventLocation: b.eventLocation,
        message: b.message || "",
        status: b.status as BookingStatus,
        createdAt: b.createdAt,
      };
    });

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Get vendor bookings error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to load vendor bookings" });
  }
}

export async function updateVendorBookingStatus(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = req.authUser!;
    const bookingId = String(req.params.id || "");
    const nextStatus = String(req.body?.status || "") as BookingStatus;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      res.status(400).json({ success: false, message: "Invalid booking ID" });
      return;
    }

    if (nextStatus !== "Accepted" && nextStatus !== "Rejected") {
      res.status(400).json({
        success: false,
        message: "Status must be 'Accepted' or 'Rejected'",
      });
      return;
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }

    if (String(booking.vendorId) !== authUser.id && authUser.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "You cannot modify another vendor's booking request",
      });
      return;
    }

    if (booking.status !== "Pending") {
      res.status(400).json({
        success: false,
        message: `Booking is already ${booking.status} and cannot be changed again`,
      });
      return;
    }

    booking.status = nextStatus;
    await booking.save();

    res.status(200).json({
      success: true,
      message: `Booking ${nextStatus.toLowerCase()}`,
      data: booking,
    });
  } catch (error) {
    console.error("Update vendor booking status error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update booking status" });
  }
}

export async function deleteMyBooking(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = req.authUser!;
    const bookingId = String(req.params.id || "");

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      res.status(400).json({ success: false, message: "Invalid booking ID" });
      return;
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }

    if (String(booking.customerId) !== authUser.id) {
      res.status(403).json({
        success: false,
        message: "You cannot delete another customer's booking",
      });
      return;
    }

    if (booking.status !== "Cancelled") {
      res.status(400).json({
        success: false,
        message: "Only cancelled booking requests can be deleted",
      });
      return;
    }

    await Booking.deleteOne({ _id: booking._id });

    res.status(200).json({
      success: true,
      message: "Cancelled booking deleted",
    });
  } catch (error) {
    console.error("Delete booking error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete booking" });
  }
}