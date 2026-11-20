import { Router } from "express";
import {
  signUp,
  signIn,
  getMe,
  getUserById,
  updateProfile,
  signOut,
} from "../controllers/authController";
import { verifyJWT } from "../middleware/authMiddleware";

const router = Router();

router.post("/sign-up", signUp);
router.post("/sign-in", signIn);
router.get("/me", verifyJWT, getMe);
router.get("/user/:id", getUserById);
router.put("/update-profile", verifyJWT, updateProfile);
router.post("/sign-out", signOut);

export default router;