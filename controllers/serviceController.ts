import { Request, Response } from "express";
import mongoose from "mongoose";
import { Service } from "../models/service";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    const { id } = req.params;

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

export async function createService(req: Request, res: Response): Promise<void> {
  try {
    const {
      vendorId,
      vendorName,
      businessName,
      serviceName,
      category,
      description,
      price,
      location,
      images,
    } = req.body;

    if (
      !vendorId ||
      !serviceName ||
      !category ||
      !description ||
      price === undefined ||
      !location
    ) {
      res.status(400).json({
        success: false,
        message:
          "vendorId, serviceName, category, description, price, and location are required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(String(vendorId))) {
      res.status(400).json({
        success: false,
        message: "Invalid vendorId",
      });
      return;
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      res.status(400).json({
        success: false,
        message: "Price must be a valid non-negative number",
      });
      return;
    }

    const service = await Service.create({
      vendorId,
      vendorName,
      businessName,
      serviceName: String(serviceName).trim(),
      category: String(category).trim(),
      description: String(description).trim(),
      price: numericPrice,
      location: String(location).trim(),
      images: Array.isArray(images) ? images : images ? [String(images)] : [],
      status: "pending",
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