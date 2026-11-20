import { Router } from "express";
import { signUp, signIn, getMe, signOut } from "../controllers/authController";
import { verifyJWT } from "../middleware/authMiddleware";

const router = Router();

router.post("/sign-up", signUp);
router.post("/sign-in", signIn);
router.get("/me", verifyJWT, getMe);
router.post("/sign-out", signOut);

export default router;