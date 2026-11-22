import { Router, Response } from "express";
import mongoose from "mongoose";
import { requireAuth, requireRole, AuthRequest } from "../controllers/bookingController";
import { Transaction } from "../models/transaction";

const router = Router();

const PREMIUM_PLAN_PRICE = Number(process.env.PREMIUM_PLAN_PRICE || 1999);

router.post(
  "/upgrade",
  requireAuth,
  requireRole("vendor"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const authUser = req.authUser!;
      const usersCol = mongoose.connection.collection("users");
      const vendorObjectId = new mongoose.Types.ObjectId(authUser.id);

      const vendorDoc = await usersCol.findOne({ _id: vendorObjectId });
      if (!vendorDoc) {
        res.status(404).json({ success: false, message: "Vendor not found" });
        return;
      }

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await usersCol.updateOne(
        { _id: vendorObjectId },
        {
          $set: {
            subscriptionPlan: "premium",
            subscriptionExpiresAt: expiresAt,
            updatedAt: new Date(),
          },
        }
      );

      const tx = await Transaction.create({
        vendorId: vendorObjectId,
        vendorName: String(vendorDoc.name || authUser.name || ""),
        vendorEmail: String(vendorDoc.email || authUser.email || ""),
        businessName: String(vendorDoc.businessName || ""),
        plan: "premium",
        amount: PREMIUM_PLAN_PRICE,
        currency: "BDT",
        status: "completed",
      });

      const updatedUser = await usersCol.findOne({ _id: vendorObjectId });

      res.status(200).json({
        success: true,
        message: "Upgraded to Premium plan! You can now publish unlimited services.",
        transaction: tx,
        user: updatedUser
          ? {
              id: String(updatedUser._id),
              name: updatedUser.name,
              email: updatedUser.email,
              image: updatedUser.image ?? null,
              role: updatedUser.role,
              isBlocked: Boolean(updatedUser.isBlocked),
              businessName: updatedUser.businessName ?? "",
              subscriptionPlan: updatedUser.subscriptionPlan ?? "premium",
              subscriptionExpiresAt: updatedUser.subscriptionExpiresAt ?? expiresAt,
            }
          : undefined,
      });
    } catch (error) {
      console.error("Subscription upgrade error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process subscription upgrade",
      });
    }
  }
);

export default router;