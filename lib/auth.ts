import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

const client = new MongoClient(process.env.MONGODB_URI as string);
const db = client.db(process.env.MONGODB_DB_NAME || "wedplan_db");

const clientOrigins = (
  process.env.CLIENT_URL || "http://localhost:3000,https://wedplan-alpha.vercel.app"
)
  .split(",")
  .map((o) => normalizeOrigin(o))
  .filter(Boolean);

const betterAuthUrl = normalizeOrigin(
  process.env.BETTER_AUTH_URL || "http://localhost:5000"
);

const isHttps =
  process.env.NODE_ENV === "production" || betterAuthUrl.startsWith("https://");

export const auth = betterAuth({
  baseURL: betterAuthUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(db, { client }),
  trustedOrigins: [...clientOrigins, betterAuthUrl],
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
    defaultCookieAttributes: isHttps
      ? {
          sameSite: "none",
          secure: true,
          httpOnly: true,
          path: "/",
        }
      : undefined,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      prompt: "select_account",
    },
  },
});