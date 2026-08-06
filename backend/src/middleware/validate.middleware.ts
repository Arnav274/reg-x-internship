import { Request, Response, NextFunction } from "express";

const ALLOWED_CATEGORIES = ["High", "Medium", "Low", "Suggestion", "Request"] as const;
const ALLOWED_FIELDS = ["product_name", "category", "issue_description"] as const;

const PRODUCT_NAME_MAX_LENGTH = 100;
const ISSUE_DESCRIPTION_MAX_LENGTH = 5000;

export interface ValidatedTicketBody {
  product_name: string;
  category: (typeof ALLOWED_CATEGORIES)[number];
  issue_description: string;
}

export function validateMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body: unknown = req.body;

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    res.status(400).json({ error: "Request body must be a JSON object" });
    return;
  }

  const unexpectedFields = Object.keys(body).filter(
    (key) => !ALLOWED_FIELDS.includes(key as (typeof ALLOWED_FIELDS)[number])
  );
  if (unexpectedFields.length > 0) {
    res.status(400).json({
      error: `Unexpected field(s): ${unexpectedFields.join(", ")}`,
    });
    return;
  }

  const { product_name, category, issue_description } = body as Record<string, unknown>;

  if (typeof product_name !== "string" || product_name.trim().length === 0) {
    res.status(400).json({
      error: "product_name is required and must be a non-empty string",
    });
    return;
  }
  if (product_name.length > PRODUCT_NAME_MAX_LENGTH) {
    res.status(400).json({
      error: `product_name must be at most ${PRODUCT_NAME_MAX_LENGTH} characters`,
    });
    return;
  }

  if (
    typeof category !== "string" ||
    !ALLOWED_CATEGORIES.includes(category as (typeof ALLOWED_CATEGORIES)[number])
  ) {
    res.status(400).json({
      error: `category must be one of: ${ALLOWED_CATEGORIES.join(", ")}`,
    });
    return;
  }

  if (typeof issue_description !== "string" || issue_description.trim().length === 0) {
    res.status(400).json({
      error: "issue_description is required and must be a non-empty string",
    });
    return;
  }
  if (issue_description.length > ISSUE_DESCRIPTION_MAX_LENGTH) {
    res.status(400).json({
      error: `issue_description must be at most ${ISSUE_DESCRIPTION_MAX_LENGTH} characters`,
    });
    return;
  }

  next();
}
