import mongoose from "mongoose";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User, UserRole } from "../models/user";
import { AuthenticatedRequest, signAuthToken } from "../middleware/authMiddleware";

export function getDashboardRouteByRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "vendor":
      return "/dashboard/vendor";
    case "customer":
    default:
      return "/dashboard/customer";
  }
}

function validatePasswordRules(password: string): string | null {
  if (typeof password !== "string" || password.length < 6) {
    return "Password must be at least 6 characters long";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  return null;
}

function serializeUser(user: {
  _id: unknown;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
  isBlocked: boolean;
  businessName?: string;
  subscriptionPlan?: "free" | "premium";
  subscriptionExpiresAt?: Date | null;
}) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role: user.role,
    isBlocked: user.isBlocked,
    businessName: user.businessName ?? "",
    subscriptionPlan: user.subscriptionPlan ?? "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
  };
}

function attachTokenCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("wedplan_token", token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export async function signUp(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, image, role, businessName } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Full name, email, and password are required",
      });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const pwError = validatePasswordRules(password);
    if (pwError) {
      res.status(400).json({ success: false, message: pwError });
      return;
    }

    // Public registration only allows "customer" or "vendor" (never "admin")
    const requestedRole = String(role || "customer").trim().toLowerCase();
    if (requestedRole !== "customer" && requestedRole !== "vendor") {
      res.status(400).json({
        success: false,
        message: "Role must be either 'customer' or 'vendor'",
      });
      return;
    }
    const assignedRole: UserRole = requestedRole;

    if (
      assignedRole === "vendor" &&
      (!businessName || !String(businessName).trim())
    ) {
      res.status(400).json({
        success: false,
        message: "Business name is required for vendor registration",
      });
      return;
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const createdUser = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      image: image ? String(image).trim() : null,
      role: assignedRole,
      isBlocked: false,
      businessName:
        assignedRole === "vendor" ? String(businessName).trim() : undefined,
      subscriptionPlan: "free",
      subscriptionExpiresAt: null,
    });

    const token = signAuthToken({
      userId: String(createdUser._id),
      email: createdUser.email,
      role: createdUser.role,
    });

    attachTokenCookie(res, token);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: serializeUser(createdUser),
      redirectTo: getDashboardRouteByRole(createdUser.role),
    });
  } catch (error) {
    console.error("Sign-up error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register account",
    });
  }
}

export async function signIn(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password"
    );

    if (!user || !user.password) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({
        success: false,
        message: "Your account is blocked. Please contact support.",
      });
      return;
    }

    const isMatch = await bcrypt.compare(String(password), user.password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const token = signAuthToken({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });

    attachTokenCookie(res, token);

    res.status(200).json({
      success: true,
      message: "Signed in successfully",
      token,
      user: serializeUser(user),
      redirectTo: getDashboardRouteByRole(user.role),
    });
  } catch (error) {
    console.error("Sign-in error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sign in",
    });
  }
}

export async function getMe(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.authUser) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  res.status(200).json({
    success: true,
    user: req.authUser,
    redirectTo: getDashboardRouteByRole(req.authUser.role),
  });
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }

    const user = await User.findById(id).lean();
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name,
        image: user.image ?? null,
        role: user.role,
        businessName: user.businessName ?? "",
      },
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
}

export async function updateProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (req.authUser.isBlocked) {
      res.status(403).json({ success: false, message: "Account is blocked" });
      return;
    }

    const { userId, name, businessName, image, password } = req.body as {
      userId?: string;
      name?: string;
      businessName?: string;
      image?: string | null;
      password?: string;
    };

    const requesterId = String(req.authUser.id);
    const targetId = userId ? String(userId) : requesterId;

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }

    if (requesterId !== targetId && req.authUser.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "You are not allowed to update another user's profile",
      });
      return;
    }

    const targetUser = await User.findById(targetId).select("+password");
    if (!targetUser) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        res.status(400).json({ success: false, message: "Name is required" });
        return;
      }
      targetUser.name = trimmedName;
    }

    if (businessName !== undefined && targetUser.role === "vendor") {
      targetUser.businessName = String(businessName).trim();
    }

    if (image !== undefined) {
      targetUser.image = image ? String(image).trim() : null;
    }

    if (password && String(password).trim() !== "") {
      const pwError = validatePasswordRules(String(password));
      if (pwError) {
        res.status(400).json({ success: false, message: pwError });
        return;
      }
      targetUser.password = await bcrypt.hash(String(password), 12);
    }

    // Never allow users to change their own role or subscription fields via profile update
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: serializeUser(targetUser),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update profile" });
  }
}

export async function signOut(_req: Request, res: Response): Promise<void> {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("wedplan_token", {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/",
  });

  res.status(200).json({
    success: true,
    message: "Signed out successfully",
  });
}