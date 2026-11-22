import { Request, Response } from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import { AuthRequest } from "./bookingController";
import { Transaction } from "../models/transaction";
import { User } from "../models/user";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = new Stripe(stripeSecretKey);

const PREMIUM_PLAN_PRICE = Number(process.env.PREMIUM_PLAN_PRICE || 1999);
const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

function serializeUserDoc(
  userDoc: Record<string, unknown>,
  fallbackExpiresAt?: Date
) {
  return {
    id: String(userDoc._id),
    name: String(userDoc.name || ""),
    email: String(userDoc.email || ""),
    image: (userDoc.image as string | null) ?? null,
    role: String(userDoc.role || "vendor"),
    isBlocked: Boolean(userDoc.isBlocked),
    businessName: String(userDoc.businessName || ""),
    subscriptionPlan:
      (userDoc.subscriptionPlan as "free" | "premium") || "free",
    subscriptionExpiresAt:
      (userDoc.subscriptionExpiresAt as Date | null) ?? fallbackExpiresAt ?? null,
  };
}

export async function finalizePaidCheckoutSession(
  session: Stripe.Checkout.Session,
  fallbackVendorId?: string
) {
  const vendorIdStr = String(
    session.metadata?.vendorId ||
      session.client_reference_id ||
      fallbackVendorId ||
      ""
  ).trim();

  if (!vendorIdStr || !mongoose.Types.ObjectId.isValid(vendorIdStr)) {
    return null;
  }

  const vendorObjectId = new mongoose.Types.ObjectId(vendorIdStr);
  const vendorDoc = await User.findById(vendorObjectId).lean();
  if (!vendorDoc) {
    return null;
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const amount =
    typeof session.amount_total === "number"
      ? session.amount_total / 100
      : Number(session.metadata?.amount || PREMIUM_PLAN_PRICE);

  const currency = String(
    session.currency || session.metadata?.currency || STRIPE_CURRENCY
  ).toUpperCase();

  await User.findByIdAndUpdate(vendorObjectId, {
    $set: {
      subscriptionPlan: "premium",
      subscriptionExpiresAt: expiresAt,
      stripeCustomerId: session.customer ? String(session.customer) : undefined,
      updatedAt: new Date(),
    },
  });

  const tx = await Transaction.findOneAndUpdate(
    { stripeSessionId: session.id },
    {
      $setOnInsert: {
        vendorId: vendorObjectId,
        vendorName: String(vendorDoc.name || ""),
        vendorEmail: String(
          session.customer_details?.email || vendorDoc.email || ""
        ),
        businessName: String(vendorDoc.businessName || ""),
        plan: "premium" as const,
        amount,
        currency,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent
          ? String(session.payment_intent)
          : "",
        stripeCustomerId: session.customer ? String(session.customer) : "",
        paidAt: new Date(),
      },
      $set: {
        status: "completed" as const,
      },
    },
    { upsert: true, new: true }
  );

  const updatedUserDoc = await User.findById(vendorObjectId).lean();

  return {
    transaction: tx,
    user: updatedUserDoc
      ? serializeUserDoc(
          updatedUserDoc as unknown as Record<string, unknown>,
          expiresAt
        )
      : undefined,
  };
}

export async function createSubscriptionCheckoutSession(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!stripeSecretKey) {
      res.status(500).json({
        success: false,
        message: "STRIPE_SECRET_KEY is not configured on the server",
      });
      return;
    }

    const authUser = req.authUser;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (authUser.role !== "vendor") {
      res.status(403).json({
        success: false,
        message: "Only vendor accounts can purchase a vendor subscription plan",
      });
      return;
    }

    const vendorObjectId = new mongoose.Types.ObjectId(authUser.id);
    const vendorDoc = await User.findById(vendorObjectId).lean();
    if (!vendorDoc) {
      res.status(404).json({ success: false, message: "Vendor not found" });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: String(vendorObjectId),
      customer_email: String(vendorDoc.email || authUser.email),
      line_items: [
        {
          price_data: {
            currency: STRIPE_CURRENCY,
            product_data: {
              name: "WedPlan Vendor Premium Plan",
              description:
                "Unlimited active wedding services & Premium vendor badge (30 days)",
            },
            unit_amount: Math.round(PREMIUM_PLAN_PRICE * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        vendorId: String(vendorObjectId),
        plan: "premium",
        amount: String(PREMIUM_PLAN_PRICE),
        currency: STRIPE_CURRENCY.toUpperCase(),
      },
      success_url: `${CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/payment/cancel`,
    });

    res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Create checkout session error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create Stripe checkout session",
    });
  }
}

export async function verifySubscriptionSession(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!stripeSecretKey) {
      res.status(500).json({
        success: false,
        message: "STRIPE_SECRET_KEY is not configured on the server",
      });
      return;
    }

    const sessionId = String(req.query.session_id || "").trim();
    if (!sessionId) {
      res.status(400).json({
        success: false,
        message: "session_id query param is required",
      });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      res.status(400).json({
        success: false,
        message: `Payment status is '${session.payment_status}'. Payment not completed.`,
      });
      return;
    }

    const authUser = req.authUser!;
    const result = await finalizePaidCheckoutSession(session, authUser.id);

    if (!result) {
      res
        .status(404)
        .json({ success: false, message: "Vendor account not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Subscription payment confirmed and recorded",
      user: result.user,
      transaction: result.transaction,
    });
  } catch (error) {
    console.error("Verify checkout session error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify Stripe session",
    });
  }
}

export async function getSubscriptionSessionStatus(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const sessionId = String(req.query.session_id || "").trim();
    const userDoc = await User.findById(authUser.id).lean();
    if (!userDoc) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const transaction = sessionId
      ? await Transaction.findOne({
          stripeSessionId: sessionId,
          vendorId: new mongoose.Types.ObjectId(authUser.id),
        }).lean()
      : null;

    res.status(200).json({
      success: true,
      user: serializeUserDoc(userDoc as unknown as Record<string, unknown>),
      transaction,
    });
  } catch (error) {
    console.error("Get session status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check subscription status",
    });
  }
}

export async function handleStripeWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    res.status(500).send("Webhook secret not configured");
    return;
  }

  if (typeof sig !== "string") {
    res.status(400).send("Webhook Error: Missing stripe-signature header");
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    res
      .status(400)
      .send(
        `Webhook Error: ${err instanceof Error ? err.message : "Invalid payload"}`
      );
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        await finalizePaidCheckoutSession(session);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handling error:", error);
    res.status(500).json({ received: false });
  }
}