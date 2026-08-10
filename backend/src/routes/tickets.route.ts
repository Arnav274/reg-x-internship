import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateMiddleware } from "../middleware/validate.middleware";
import { rateLimitMiddleware } from "../middleware/rateLimit.middleware";
import { createTicketController } from "../controllers/tickets.controller";

const router = Router();

// Order matters. auth first, because the limiter keys on a verified identity
// and throws without one. validate before the limiter, because the 429 promises
// a number of tickets per hour, so a request rejected as malformed never became
// a submission and must not spend the user's quota. Validation touches no
// database and makes no AI call, so running it on unthrottled traffic is cheap.
router.post(
  "/create",
  authMiddleware,
  validateMiddleware,
  rateLimitMiddleware,
  createTicketController
);

export default router;
