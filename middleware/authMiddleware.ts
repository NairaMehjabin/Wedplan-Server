import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, TokenExpiredError } from "jsonwebtoken";
import mongoose from "mongoose";
import { User, UserRole } from "../models/user";

function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }
  if (process.env.NODE_ENV !== "production") {
    return "dev-secret-change-me";
  }
  return null;
}

export interface JwtPayloadData extends JwtPayload {
  userId?: string;
  id?: string;
  sub?: string;
  email?: string;
  role?: UserRole | string;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
  isBlocked: boolean;
  businessName?: string;
  subscriptionPlan: "free" | "premium";
  subscriptionExpiresAt?: Date | string | null;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function signAuthToken(payload: {
  userId: string;
  email: string;
  role: UserRole;
}): string {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error("JWT_SECRET or BETTER_AUTH_SECRET is not configured");
  }
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) return token;
  }

  const cookieToken =
    req.cookies?.wedplan_token ||
    req.cookies?.token ||
    req.cookies?.accessToken ||
    null;

  if (typeof cookieToken === "string" && cookieToken.trim()) {
    return cookieToken.replace(/^Bearer\s+/i, "").trim();
  }

  return null;
}

function normalizeRole(role?: unknown): UserRole | null {
  if (typeof role !== "string") return null;
  const r = role.trim().toLowerCase();
  if (r === "admin" || r === "vendor" || r === "customer") {
    return r;
  }
  return null;
}

export async function verifyJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: Missing authentication token",
      });
      return;
    }

    const secret = getJwtSecret();
    if (!secret) {
      res.status(500).json({
        success: false,
        message: "Server authentication secret is not configured",
      });
      return;
    }

    const decoded = jwt.verify(token, secret) as JwtPayloadData;
    const candidateId = String(
      decoded.userId || decoded.id || decoded.sub || ""
    ).trim();

    let dbUser = null;
    if (candidateId && mongoose.Types.ObjectId.isValid(candidateId)) {
      dbUser = await User.findById(candidateId).select("-password").lean();
    }

    if (!dbUser && typeof decoded.email === "string" && decoded.email.trim()) {
      dbUser = await User.findOne({
        email: decoded.email.trim().toLowerCase(),
      })
        .select("-password")
        .lean();
    }

    if (!dbUser) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User account no longer exists",
      });
      return;
    }

    if (Boolean(dbUser.isBlocked)) {
      res.status(403).json({
        success: false,
        message: "Forbidden: Your account has been blocked",
      });
      return;
    }

    const resolvedRole =
      normalizeRole(dbUser.role) || normalizeRole(decoded.role) || "customer";

    const rawPlan = String(dbUser.subscriptionPlan || "free").toLowerCase();
    const resolvedPlan: "free" | "premium" =
      rawPlan === "premium" ? "premium" : "free";

    req.authUser = {
      id: String(dbUser._id),
      name: dbUser.name,
      email: dbUser.email,
      image: dbUser.image ?? null,
      role: resolvedRole,
      isBlocked: false,
      businessName: dbUser.businessName,
      subscriptionPlan: resolvedPlan,
      subscriptionExpiresAt: dbUser.subscriptionExpiresAt ?? null,
    };

    next();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[verifyJWT] Token verification failed:", err);
    }
    const isExpired = err instanceof TokenExpiredError;
    res.status(401).json({
      success: false,
      message: isExpired
        ? "Unauthorized: Session expired, please sign in again"
        : "Unauthorized: Invalid or expired token",
    });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  const allowedSet = new Set(
    allowedRoles.map((role) => String(role).toLowerCase())
  );

  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.authUser) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: Authentication required",
      });
      return;
    }

    if (req.authUser.isBlocked) {
      res.status(403).json({
        success: false,
        message: "Forbidden: Your account has been blocked",
      });
      return;
    }

    const currentRole = String(req.authUser.role).toLowerCase();
    if (!allowedSet.has(currentRole)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Requires ${Array.from(allowedSet).join(" or ")} role`,
      });
      return;
    }

    next();
  };
}