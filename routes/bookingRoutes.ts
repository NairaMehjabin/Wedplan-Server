import { Router } from "express";
import {
  requireAuth,
  requireRole,
  createBooking,
  getMyBookings,
  cancelMyBooking,
  deleteMyBooking,
  getVendorBookings,
  updateVendorBookingStatus,
} from "../controllers/bookingController";

const router = Router();

router.post("/", requireAuth, requireRole("customer"), createBooking);
router.get("/my", requireAuth, requireRole("customer"), getMyBookings);
router.patch(
  "/:id/cancel",
  requireAuth,
  requireRole("customer"),
  cancelMyBooking
);
router.delete(
  "/:id",
  requireAuth,
  requireRole("customer"),
  deleteMyBooking
);

router.get("/vendor", requireAuth, requireRole("vendor"), getVendorBookings);
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("vendor", "admin"),
  updateVendorBookingStatus
);

export default router;