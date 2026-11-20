import "dotenv/config";
import crypto from "node:crypto";
import mongoose from "mongoose";

const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "Admin123";
const ADMIN_IMAGE =
  "https://i.pinimg.com/736x/33/74/31/3374315482f8552b98b7e2d86b69cc79.jpg";

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

async function seedAdmin() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing in .env");
  }

  const dbName = process.env.MONGODB_DB_NAME;
  await mongoose.connect(mongoUri, dbName ? { dbName } : undefined);

  const normalizedEmail = ADMIN_EMAIL.trim().toLowerCase();
  const hashedPassword = hashPassword(ADMIN_PASSWORD);

  const upserted = (await AuthUser.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: {
        name: "Admin",
        email: normalizedEmail,
        password: hashedPassword,
        image: ADMIN_IMAGE,
        role: "admin",
        isBlocked: false,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  )) as IAuthUser;

  const check = (await AuthUser.findById(upserted._id).select(
    "+password"
  )) as IAuthUser | null;
  const valid = check?.password
    ? verifyPassword(ADMIN_PASSWORD, check.password)
    : false;

  console.log("Seeded admin:", {
    db: mongoose.connection.name,
    id: String(upserted._id),
    email: upserted.email,
    role: upserted.role,
    scryptVerifyMatches: valid,
  });

  await mongoose.disconnect();
}

seedAdmin().catch(async (err) => {
  console.error("Seed error:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});