import { Request, Response } from "express";
import { classifyIssue } from "../services/aiClassifier.service";

export async function classifyController(
  req: Request,
  res: Response
): Promise<void> {
  const { issue_description } = req.body as Record<string, unknown>;

  if (typeof issue_description !== "string" || issue_description.trim().length === 0) {
    res.status(400).json({
      error: "issue_description is required and must be a non-empty string",
    });
    return;
  }

  const suggestedCategory = await classifyIssue(issue_description);

  if (suggestedCategory === null) {
    res.status(502).json({
      error: "AI classification is currently unavailable. Please choose a category manually.",
    });
    return;
  }

  res.status(200).json({ suggested_category: suggestedCategory });
}
