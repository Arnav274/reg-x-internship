import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { classifyController } from "../controllers/classify.controller";

const router = Router();

router.post("/classify", authMiddleware, classifyController);

export default router;
