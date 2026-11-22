import { Request, Response } from "express";
import mongoose from "mongoose";
import { Service } from "../models/service";
import { AuthRequest } from "./bookingController";

const FREE_PLAN_ACTIVE_LIMIT = 3;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getVendorSubscriptionPlan(vendorId: string): Promise<"free" | "premium"> {
  if (!mongoose.Types.ObjectId.isValid(vendorId)) return "free";
  const usersCol = mongoose.connection.collection("users");
  const userDoc = await usersCol.findOne({ _id: new mongoose.Types.ObjectId(vendorId) });
  return userDoc?.subscriptionPlan === "premium" ? "premium" : "free";
}

export async function getAllServices(req: Request, res: Response): Promise<void> {
  try {
    const {
      search,
      q,
      category,
      location,
      sort,
      sortBy,
      order,
      page = "1",
      limit = "12",
    } = req.query;

    // Rejected or pending or inactive services are never exposed to customers
    const filter: Record<string, unknown> = {
      status: "approved",
      isActive: true,
    };

    const searchQuery = String(search ?? q ?? "").trim();
    if (searchQuery) {
      const regex = new RegExp(escapeRegex(searchQuery), "i");
      filter.$or = [
        { serviceName: regex },
        { description: regex },
        { businessName: regex },
        { vendorName: regex },
      ];
    }

    if (category && String(category).trim() && String(category) !== "All") {
      filter.category = {
        $regex: new RegExp(`^${escapeRegex(String(category).trim())}$`, "i"),
      };
    }

    if (location && String(location).trim() && String(location) !== "All") {
      filter.location = {
        $regex: new RegExp(escapeRegex(String(location).trim()), "i"),
      };
    }

    let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
    const sortParam = String(sort ?? "").toLowerCase();
    const sortByParam = String(sortBy ?? "").toLowerCase();
    const orderParam = String(order ?? "asc").toLowerCase();

    if (sortParam === "price_asc" || (sortByParam === "price" && orderParam === "asc")) {
      sortOption = { price: 1, createdAt: -1 };
    } else if (
      sortParam === "price_desc" ||
      (sortByParam === "price" && orderParam === "desc")
    ) {
      sortOption = { price: -1, createdAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [services, total] = await Promise.all([
      Service.find(filter).sort(sortOption).skip(skip).limit(limitNum).lean(),
      Service.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: services,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wedding services",
    });
  }
}

export async function getServiceById(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = String(Array.isArray(rawId) ? rawId[0] : rawId || "").trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid service ID format",
      });
      return;
    }

    const service = await Service.findById(id).lean();

    if (!service) {
      res.status(404).json({
        success: false,
        message: "Wedding service not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error("Error fetching service by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve service details",
    });
  }
}

export async function getVendorServices(req: AuthRequest, res: Response): Promise<void> {
  try {
    const authUser = req.authUser!;
    const vendorObjectId = new mongoose.Types.ObjectId(authUser.id);

    const services = await Service.find({ vendorId: vendorObjectId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("Error fetching vendor services:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your services",
    });
  }
}

export async function createService(req: AuthRequest, res: Response): Promise<void> {
  try {
    const authUser = req.authUser;
    const body = req.body as {
      vendorId?: string;
      vendorName?: string;
      businessName?: string;
      serviceName?: string;
      category?: string;
      description?: string;
      price?: number | string;
      location?: string;
      images?: string[];
      image?: string;
    };

    const resolvedVendorId = authUser ? authUser.id : String(body.vendorId || "");
    const cleanName = String(body.serviceName || "").trim();
    const cleanCategory = String(body.category || "").trim();
    const cleanDescription = String(body.description || "").trim();
    const cleanLocation = String(body.location || "").trim();

    if (
      !resolvedVendorId ||
      !cleanName ||
      !cleanCategory ||
      !cleanDescription ||
      body.price === undefined ||
      body.price === "" ||
      !cleanLocation
    ) {
      res.status(400).json({
        success: false,
        message:
          "Service name, category, description, price, and location are required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(resolvedVendorId)) {
      res.status(400).json({
        success: false,
        message: "Invalid vendor ID",
      });
      return;
    }

    const numericPrice = Number(body.price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      res.status(400).json({
        success: false,
        message: "Price must be a valid non-negative number",
      });
      return;
    }

    const plan = await getVendorSubscriptionPlan(resolvedVendorId);
    const activeCount = await Service.countDocuments({
      vendorId: new mongoose.Types.ObjectId(resolvedVendorId),
      isActive: true,
    });

    if (plan === "free" && activeCount >= FREE_PLAN_ACTIVE_LIMIT) {
      res.status(403).json({
        success: false,
        message:
          "Free plan allows a maximum of 3 active services. Upgrade to Premium for unlimited services.",
      });
      return;
    }

    const imageList = Array.isArray(body.images)
      ? body.images.map((img) => String(img).trim()).filter(Boolean)
      : body.image
        ? [String(body.image).trim()].filter(Boolean)
        : [];

    if (imageList.length === 0) {
      res.status(400).json({
        success: false,
        message: "Please upload a service image before submitting",
      });
      return;
    }

    const service = await Service.create({
      vendorId: new mongoose.Types.ObjectId(resolvedVendorId),
      vendorName: body.vendorName ? String(body.vendorName).trim() : authUser?.name,
      businessName: body.businessName ? String(body.businessName).trim() : undefined,
      serviceName: cleanName,
      category: cleanCategory,
      description: cleanDescription,
      price: numericPrice,
      location: cleanLocation,
      images: imageList,
      status: "pending", // Always pending until approved by an admin
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Service submitted for admin approval",
      data: service,
    });
  } catch (error) {
    console.error("Error creating service:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create service",
    });
  }
}

export async function updateService(req: AuthRequest, res: Response): Promise<void> {
  try {
    const authUser = req.authUser!;
    const rawId = req.params.id;
    const id = String(Array.isArray(rawId) ? rawId[0] : rawId || "").trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid service ID" });
      return;
    }

    const service = await Service.findById(id);
    if (!service) {
      res.status(404).json({ success: false, message: "Service not found" });
      return;
    }

    if (String(service.vendorId) !== authUser.id && authUser.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "You cannot update another vendor's service",
      });
      return;
    }

    const body = req.body as {
      serviceName?: string;
      category?: string;
      description?: string;
      price?: number | string;
      location?: string;
      images?: string[];
      isActive?: boolean;
    };

    let contentModified = false;

    if (body.serviceName !== undefined) {
      const val = String(body.serviceName).trim();
      if (!val) {
        res.status(400).json({ success: false, message: "Service name cannot be empty" });
        return;
      }
      if (val !== service.serviceName) contentModified = true;
      service.serviceName = val;
    }

    if (body.category !== undefined) {
      const val = String(body.category).trim();
      if (!val) {
        res.status(400).json({ success: false, message: "Category cannot be empty" });
        return;
      }
      if (val !== service.category) contentModified = true;
      service.category = val;
    }

    if (body.description !== undefined) {
      const val = String(body.description).trim();
      if (!val) {
        res.status(400).json({ success: false, message: "Description cannot be empty" });
        return;
      }
      if (val !== service.description) contentModified = true;
      service.description = val;
    }

    if (body.price !== undefined) {
      const numericPrice = Number(body.price);
      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        res.status(400).json({ success: false, message: "Price must be non-negative" });
        return;
      }
      if (numericPrice !== service.price) contentModified = true;
      service.price = numericPrice;
    }

    if (body.location !== undefined) {
      const val = String(body.location).trim();
      if (!val) {
        res.status(400).json({ success: false, message: "Location cannot be empty" });
        return;
      }
      if (val !== service.location) contentModified = true;
      service.location = val;
    }

    if (Array.isArray(body.images) && body.images.length > 0) {
      service.images = body.images.map((img) => String(img).trim()).filter(Boolean);
      contentModified = true;
    }

    if (typeof body.isActive === "boolean") {
      if (body.isActive && !service.isActive) {
        const plan = await getVendorSubscriptionPlan(String(service.vendorId));
        const activeCount = await Service.countDocuments({
          _id: { $ne: service._id },
          vendorId: service.vendorId,
          isActive: true,
        });
        if (plan === "free" && activeCount >= FREE_PLAN_ACTIVE_LIMIT) {
          res.status(403).json({
            success: false,
            message:
              "Free plan allows a maximum of 3 active services. Upgrade to Premium for unlimited services.",
          });
          return;
        }
      }
      service.isActive = body.isActive;
    }

    // Re-submit for admin review if listing content was modified by a vendor
    if (contentModified && authUser.role === "vendor") {
      service.status = "pending";
    }

    await service.save();

    res.status(200).json({
      success: true,
      message: contentModified
        ? "Service updated and sent for admin approval"
        : "Service updated",
      data: service,
    });
  } catch (error) {
    console.error("Error updating service:", error);
    res.status(500).json({ success: false, message: "Failed to update service" });
  }
}

export async function deleteService(req: AuthRequest, res: Response): Promise<void> {
  try {
    const authUser = req.authUser!;
    const rawId = req.params.id;
    const id = String(Array.isArray(rawId) ? rawId[0] : rawId || "").trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid service ID" });
      return;
    }

    const service = await Service.findById(id);
    if (!service) {
      res.status(404).json({ success: false, message: "Service not found" });
      return;
    }

    if (String(service.vendorId) !== authUser.id && authUser.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "You cannot delete another vendor's service",
      });
      return;
    }

    await Service.deleteOne({ _id: service._id });

    res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting service:", error);
    res.status(500).json({ success: false, message: "Failed to delete service" });
  }
}

export async function getAdminAllServices(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const {
      search,
      q,
      category,
      location,
      status,
      sortBy,
      order = "desc",
    } = req.query;

    const filter: Record<string, unknown> = {};

    const searchQuery = String(search ?? q ?? "").trim();
    if (searchQuery) {
      const regex = new RegExp(escapeRegex(searchQuery), "i");
      filter.$or = [
        { serviceName: regex },
        { description: regex },
        { businessName: regex },
        { vendorName: regex },
      ];
    }

    if (category && String(category).trim() && String(category) !== "All") {
      filter.category = {
        $regex: new RegExp(`^${escapeRegex(String(category).trim())}$`, "i"),
      };
    }

    if (location && String(location).trim() && String(location) !== "All") {
      filter.location = {
        $regex: new RegExp(escapeRegex(String(location).trim()), "i"),
      };
    }

    if (status && String(status).trim() && String(status) !== "all") {
      filter.status = String(status).trim().toLowerCase();
    }

    let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
    const orderDir: 1 | -1 = String(order).toLowerCase() === "asc" ? 1 : -1;
    if (String(sortBy ?? "").toLowerCase() === "price") {
      sortOption = { price: orderDir, createdAt: -1 };
    }

    const services = await Service.find(filter).sort(sortOption).lean();

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("Error fetching admin services:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch services for admin",
    });
  }
}