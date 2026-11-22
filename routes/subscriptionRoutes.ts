import { Router } from "express";
import { requireAuth, requireRole } from "../controllers/bookingController";
import {
  createSubscriptionCheckoutSession,
  getSubscriptionSessionStatus,
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

router.get(
  "/session-status",
  requireAuth,
  requireRole("vendor"),
  getSubscriptionSessionStatus
);

export default router;