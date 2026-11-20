import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, UserRole } from "../models/user";

const JWT_SECRET =
  process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "dev-secret-change-me";

export interface JwtPayloadData {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  authUser?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role: UserRole;
    isBlocked: boolean;
    businessName?: string;
    subscriptionPlan: "free" | "premium";
  };
}

export function signAuthToken(payload: JwtPayloadData): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export async function verifyJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;
    const cookieToken = req.cookies?.wedplan_token || null;
    const token = bearerToken || cookieToken;

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: Missing authentication token",
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayloadData;
    const dbUser = await User.findById(decoded.userId).lean();

    if (!dbUser) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User account no longer exists",
      });
      return;
    }

    if (dbUser.isBlocked) {
      res.status(403).json({
        success: false,
        message: "Forbidden: Your account has been blocked",
      });
      return;
    }

    req.authUser = {
      id: String(dbUser._id),
      name: dbUser.name,
      email: dbUser.email,
      image: dbUser.image ?? null,
      role: dbUser.role,
      isBlocked: dbUser.isBlocked,
      businessName: dbUser.businessName,
      subscriptionPlan: dbUser.subscriptionPlan,
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or expired token",
    });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
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

    if (!allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({
        success: false,
        message: "Forbidden: Insufficient permissions for this resource",
      });
      return;
    }

    next();
  };
}