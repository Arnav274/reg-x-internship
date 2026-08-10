import { Request, Response, NextFunction } from "express";
import { rateLimitMaxPerHour } from "../config/env";

const WINDOW_MS = 60 * 60 * 1000;

interface RequestWindow {
  count: number;
  startedAt: number;
}

// In-memory by design, per architecture.md section 6.3: fine for the single
// backend instance this project runs, and a known simplification rather than an
// oversight. Two consequences worth being explicit about, both recorded in
// docs/security.md: the counts reset whenever the process restarts, and a second
// instance would keep its own separate counts, so the effective limit would
// double.
const windows = new Map<string, RequestWindow>();

export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const identity = req.identity;

  // Deliberately not the `req.identity!` assertion tickets.controller uses. If
  // this middleware is ever wired ahead of auth.middleware, that assertion would
  // make the limiter silently count everyone under one undefined key or skip
  // entirely, which is a security control failing open without a sound. Throwing
  // makes the misconfiguration immediate and loud instead.
  if (identity === undefined) {
    throw new Error(
      "rateLimitMiddleware requires a verified identity: it must be mounted after authMiddleware"
    );
  }

  // Keyed on a claim from the verified token, never on the request body and
  // never on IP. Body fields are attacker-controlled, and IP would limit a whole
  // office to 10 tickets an hour while letting one user bypass the limit by
  // changing network. Email rather than username because it is the claim more
  // likely to be unique per person.
  const key = identity.email;
  const now = Date.now();
  const current = windows.get(key);

  // Fixed window: the first request starts the hour, and the hour resets whole
  // rather than sliding. This is what "hourly reset" in the spec describes, and
  // it accepts a known edge case, that a user can send the limit twice across a
  // window boundary.
  if (current === undefined || now - current.startedAt >= WINDOW_MS) {
    windows.set(key, { count: 1, startedAt: now });
    next();
    return;
  }

  if (current.count >= rateLimitMaxPerHour) {
    res.status(429).json({
      error: `Rate limit exceeded. You may submit up to ${rateLimitMaxPerHour} tickets per hour.`,
    });
    return;
  }

  current.count += 1;
  next();
}
