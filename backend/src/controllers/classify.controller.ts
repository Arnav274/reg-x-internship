import { Request, Response } from "express";
import { classifyIssue } from "../services/aiClassifier.service";

export async function classifyController(
  req: Request,
  res: Response
): Promise<void> {
  // Shape and length are guaranteed by validateClassify.middleware, which runs
  // ahead of this controller in the route chain, the same way
  // createTicketController trusts validate.middleware.
  const { issue_description } = req.body as { issue_description: string };

  const suggestedCategory = await classifyIssue(issue_description);

  if (suggestedCategory === null) {
    res.status(502).json({
      error: "AI classification is currently unavailable. Please choose a category manually.",
    });
    return;
  }

  res.status(200).json({ suggested_category: suggestedCategory });
}
