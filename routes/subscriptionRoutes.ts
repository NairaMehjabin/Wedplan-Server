import { Router } from "express";
import { requireAuth, requireRole } from "../controllers/bookingController";
import {
  createSubscriptionCheckoutSession,
  verifySubscriptionSession,
} from "../controllers/transactionController";

const router = Router();

router.post(
  "/create-checkout-session",
  requireAuth,
  requireRole("vendor"),
  createSubscriptionCheckoutSession
);

router.get(
  "/verify-session",
  requireAuth,
  requireRole("vendor"),
  verifySubscriptionSession
);

export default router;