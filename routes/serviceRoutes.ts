import { Router } from "express";
import {
  getAllServices,
  getAdminAllServices,
  getServiceById,
  getVendorServices,
  createService,
  updateService,
  deleteService,
} from "../controllers/serviceController";
import { requireAuth, requireRole } from "../controllers/bookingController";

const router = Router();

router.get("/", getAllServices);
router.get("/admin/all", requireAuth, requireRole("admin"), getAdminAllServices);
router.get("/vendor/mine", requireAuth, requireRole("vendor"), getVendorServices);
router.get("/:id", getServiceById);
router.post("/", requireAuth, requireRole("vendor"), createService);
router.patch("/:id", requireAuth, requireRole("vendor", "admin"), updateService);
router.delete("/:id", requireAuth, requireRole("vendor", "admin"), deleteService);

export default router;