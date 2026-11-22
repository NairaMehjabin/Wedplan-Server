import "dotenv/config";
import crypto from "node:crypto";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import mongoose from "mongoose";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { connectDB } from "./db";
import serviceRoutes from "./routes/serviceRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import subscriptionRoutes from "./routes/subscriptionRoutes";
import { handleStripeWebhook } from "./controllers/transactionController";

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  "wedplan-dev-jwt-secret";

const allowedOrigins = (
  process.env.CLIENT_URL || "http://localhost:3000"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const betterAuthClient = new mongoose.mongo.MongoClient(
  process.env.MONGODB_URI as string
);
const betterAuthDb = betterAuthClient.db();

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${PORT}`,
  secret: process.env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(betterAuthDb, { client: betterAuthClient }),
  trustedOrigins: [
    ...allowedOrigins,
    process.env.BETTER_AUTH_URL || `http://localhost:${PORT}`,
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      prompt: "select_account",
    },
  },
});

type UserRole = "customer" | "vendor" | "admin";

interface IAuthUser extends mongoose.Document {
  name: string;
  email: string;
  password: string;
  image?: string | null;
  role: UserRole;
  isBlocked: boolean;
  businessName?: string;
  subscriptionPlan: "free" | "premium";
  subscriptionExpiresAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const AuthUserSchema = new mongoose.Schema<IAuthUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false },
    image: { type: String, default: null },
    role: {
      type: String,
      enum: ["customer", "vendor", "admin"],
      default: "customer",
      index: true,
    },
    isBlocked: { type: Boolean, default: false, index: true },
    businessName: { type: String, trim: true },
    subscriptionPlan: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
    },
    subscriptionExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const AuthUser =
  mongoose.models.User || mongoose.model<IAuthUser>("User", AuthUserSchema);

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, "hex");
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;
  return Buffer.from(padded, "base64").toString("utf8");
}

function signJwt(payload: {
  userId: string;
  email: string;
  role: UserRole;
}): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  const unsigned = `${header}.${body}`;
  const sig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(unsigned)
    .digest();
  return `${unsigned}.${base64UrlEncode(sig)}`;
}

function verifyJwt(
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

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

function getDashboardPath(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/dashboard";
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
    return "Password must include at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter";
  }
  return null;
}

function serializeAuthUser(user: IAuthUser) {
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

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const decoded = verifyJwt(token);
  if (!decoded) {
    res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
    return;
  }

  const requester = (await AuthUser.findById(
    decoded.userId
  )) as IAuthUser | null;
  if (!requester) {
    res.status(401).json({ success: false, message: "User not found" });
    return;
  }

  if (requester.isBlocked) {
    res.status(403).json({ success: false, message: "Account is blocked" });
    return;
  }

  if (requester.role !== "admin") {
    res.status(403).json({ success: false, message: "Admin access required" });
    return;
  }

  next();
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Must come before app.use(express.json()) so Stripe webhook signature verification gets raw bytes
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Express v5 named wildcard syntax (*splat) before express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "WedPlan API is healthy" });
});

app.post("/api/auth/google-sync", async (req: Request, res: Response) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      res
        .status(401)
        .json({ success: false, message: "No active Google session found" });
      return;
    }

    const requestedRole = String(req.body?.role || "customer")
      .trim()
      .toLowerCase();
    const safeRole: UserRole =
      requestedRole === "vendor" ? "vendor" : "customer";

    let user = (await AuthUser.findOne({ email })) as IAuthUser | null;

    if (!user) {
      const randomSecretPw = hashPassword(
        crypto.randomBytes(24).toString("hex") + "Aa1!"
      );
      user = (await AuthUser.create({
        name: session?.user?.name?.trim() || email.split("@")[0],
        email,
        password: randomSecretPw,
        image: session?.user?.image ? String(session.user.image).trim() : null,
        role: safeRole,
        isBlocked: false,
        subscriptionPlan: "free",
        subscriptionExpiresAt: null,
      })) as IAuthUser;
    } else if (session?.user?.image && !user.image) {
      user.image = String(session.user.image).trim();
      await user.save();
    }

    if (user.isBlocked) {
      res
        .status(403)
        .json({ success: false, message: "Your account is blocked" });
      return;
    }

    const token = signJwt({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });

    res.status(200).json({
      success: true,
      message: "Google session synced",
      token,
      user: serializeAuthUser(user),
      redirectTo: getDashboardPath(user.role),
    });
  } catch (error) {
    console.error("Google sync error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to sync Google session" });
  }
});

app.post("/api/auth/sign-up", async (req: Request, res: Response) => {
  try {
    const { name, email, password, image, role, businessName } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Full name, email, and password are required",
      });
      return;
    }

    const pwError = validatePasswordRules(password);
    if (pwError) {
      res.status(400).json({ success: false, message: pwError });
      return;
    }

    const requestedRole = String(role || "customer").trim().toLowerCase();
    if (requestedRole !== "customer" && requestedRole !== "vendor") {
      res.status(400).json({
        success: false,
        message: "Public registration only supports 'customer' or 'vendor'",
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
        message: "Business name is required for vendor accounts",
      });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await AuthUser.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
      return;
    }

    const created = (await AuthUser.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashPassword(String(password)),
      image: image ? String(image).trim() : null,
      role: assignedRole,
      isBlocked: false,
      businessName:
        assignedRole === "vendor" ? String(businessName).trim() : undefined,
      subscriptionPlan: "free",
      subscriptionExpiresAt: null,
    })) as IAuthUser;

    const token = signJwt({
      userId: String(created._id),
      email: created.email,
      role: created.role,
    });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: serializeAuthUser(created),
      redirectTo: getDashboardPath(created.role),
    });
  } catch (error) {
    console.error("Sign-up error:", error);
    res.status(500).json({ success: false, message: "Failed to register" });
  }
});

app.post("/api/auth/sign-in", async (req: Request, res: Response) => {
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
    const user = (await AuthUser.findOne({ email: normalizedEmail }).select(
      "+password"
    )) as IAuthUser | null;

    if (
      !user ||
      !user.password ||
      !verifyPassword(String(password), user.password)
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({
        success: false,
        message: "Your account is blocked",
      });
      return;
    }

    const token = signJwt({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });

    res.status(200).json({
      success: true,
      message: "Signed in successfully",
      token,
      user: serializeAuthUser(user),
      redirectTo: getDashboardPath(user.role),
    });
  } catch (error) {
    console.error("Sign-in error:", error);
    res.status(500).json({ success: false, message: "Failed to sign in" });
  }
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const decoded = verifyJwt(token);
    if (!decoded) {
      res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });
      return;
    }

    const user = (await AuthUser.findById(decoded.userId)) as IAuthUser | null;
    if (!user) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({ success: false, message: "User is blocked" });
      return;
    }

    res.status(200).json({
      success: true,
      user: serializeAuthUser(user),
      redirectTo: getDashboardPath(user.role),
    });
  } catch (error) {
    console.error("Session check error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to verify session" });
  }
});

app.get("/api/auth/user/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }

    const user = (await AuthUser.findById(id)) as IAuthUser | null;
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
});

app.put("/api/auth/update-profile", async (req: Request, res: Response) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const decoded = verifyJwt(token);
    if (!decoded) {
      res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });
      return;
    }

    const requester = (await AuthUser.findById(
      decoded.userId
    )) as IAuthUser | null;
    if (!requester) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }

    if (requester.isBlocked) {
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

    const targetId = userId ? String(userId) : String(requester._id);
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }

    if (String(requester._id) !== targetId && requester.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "You cannot update another user's profile",
      });
      return;
    }

    const targetUser = (await AuthUser.findById(targetId).select(
      "+password"
    )) as IAuthUser | null;
    if (!targetUser) {
      res.status(404).json({ success: false, message: "Target user not found" });
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
      targetUser.password = hashPassword(String(password));
    }

    await targetUser.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: serializeAuthUser(targetUser),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update profile" });
  }
});

app.post("/api/auth/sign-out", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "Signed out" });
});

app.get(
  "/api/admin/users",
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const users = await AuthUser.find({})
        .select("-password")
        .sort({ createdAt: -1 })
        .lean();
      res.status(200).json({
        success: true,
        users: users.map((u) => ({
          id: String(u._id),
          _id: String(u._id),
          name: u.name,
          email: u.email,
          image: u.image ?? null,
          role: u.role,
          isBlocked: Boolean(u.isBlocked),
          businessName: u.businessName ?? "",
          subscriptionPlan: u.subscriptionPlan ?? "free",
          createdAt: u.createdAt,
        })),
      });
    } catch (error) {
      console.error("Admin get users error:", error);
      res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
  }
);

app.patch(
  "/api/admin/users/:id/block",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || "");
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, message: "Invalid user ID" });
        return;
      }

      const { isBlocked } = req.body as { isBlocked?: boolean };
      if (typeof isBlocked !== "boolean") {
        res
          .status(400)
          .json({ success: false, message: "isBlocked boolean is required" });
        return;
      }

      const updated = (await AuthUser.findByIdAndUpdate(
        id,
        { isBlocked },
        { new: true }
      ).select("-password")) as IAuthUser | null;

      if (!updated) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      res.status(200).json({
        success: true,
        message: isBlocked ? "User blocked" : "User unblocked",
        user: serializeAuthUser(updated),
      });
    } catch (error) {
      console.error("Admin block user error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update user status" });
    }
  }
);

app.patch(
  "/api/admin/services/:id/status",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || "");
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      const nextStatus = String(req.body?.status || "").toLowerCase();
      if (!["pending", "approved", "rejected"].includes(nextStatus)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid status value" });
        return;
      }

      const servicesCol = mongoose.connection.collection("services");
      const result = await servicesCol.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { status: nextStatus } },
        { returnDocument: "after" }
      );

      if (!result) {
        res.status(404).json({ success: false, message: "Service not found" });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Service status updated to ${nextStatus}`,
        service: result,
      });
    } catch (error) {
      console.error("Admin update service status error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update service status" });
    }
  }
);

app.get(
  "/api/admin/transactions",
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const txCol = mongoose.connection.collection("transactions");
      const rawTx = await txCol.find({}).sort({ createdAt: -1 }).toArray();
      const usersCol = mongoose.connection.collection("users");

      const vendorIds = [
        ...new Set(rawTx.map((t) => String(t.vendorId || "")).filter(Boolean)),
      ]
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      const vendors = vendorIds.length
        ? await usersCol.find({ _id: { $in: vendorIds } }).toArray()
        : [];
      const vendorMap = new Map(vendors.map((v) => [String(v._id), v]));

      const transactions = rawTx.map((t) => {
        const vendor = vendorMap.get(String(t.vendorId || ""));
        return {
          ...t,
          _id: String(t._id),
          vendorName: vendor?.name || t.vendorName || "Vendor",
          vendorEmail: vendor?.email || t.vendorEmail || "",
          businessName: vendor?.businessName || t.businessName || "",
        };
      });

      res.status(200).json({ success: true, transactions });
    } catch (error) {
      console.error("Admin get transactions error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch transactions" });
    }
  }
);

app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

async function startServer(): Promise<void> {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`WedPlan server running on http://localhost:${PORT}`);
  });
}

startServer();

// Why is deploy #2 missing from GitHub? 😭