import { Router } from "express";
import {
  getAllServices,
  getServiceById,
  createService,
} from "../controllers/serviceController";

const router = Router();

router.get("/", getAllServices);
router.get("/:id", getServiceById);
router.post("/", createService);

export default router;