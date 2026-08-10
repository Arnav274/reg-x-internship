import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateMiddleware } from "../middleware/validate.middleware";
import { rateLimitMiddleware } from "../middleware/rateLimit.middleware";
import {
  createTicketController,
  listTicketsController,
} from "../controllers/tickets.controller";

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

// Read side. Authenticated like every other protected route, and deliberately
// NOT rate limited: the limiter counts ticket submissions, so putting it here
// would let ten refreshes of the admin table exhaust a user's quota for
// actually filing tickets, and its own 429 message would then be untrue.
//
// Any valid token reads every ticket, including other users'. That is an
// accepted limitation rather than an oversight: the specification asks for JWT
// verification on all endpoints and never mentions roles, so this is
// authentication without authorization, recorded as such in docs/security.md.
router.get("/", authMiddleware, listTicketsController);

export default router;
