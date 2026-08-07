import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateMiddleware } from "../middleware/validate.middleware";
import { createTicketController } from "../controllers/tickets.controller";

const router = Router();

router.post("/create", authMiddleware, validateMiddleware, createTicketController);

export default router;
