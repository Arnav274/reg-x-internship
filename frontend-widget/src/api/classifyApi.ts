import { TicketCategory } from "./ticketsApi";
import { API_BASE_URL } from "./config";

export interface ClassifyRequest {
  issue_description: string;
}

interface ClassifySuccessBody {
  suggested_category: TicketCategory;
}

interface ErrorBody {
  error: string;
}

export async function classifyText(
  issueDescription: string,
  token: string
): Promise<TicketCategory> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/classify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ issue_description: issueDescription } satisfies ClassifyRequest),
  });

  const body = (await response.json()) as ClassifySuccessBody | ErrorBody;

  if (!response.ok) {
    const message = "error" in body ? body.error : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return (body as ClassifySuccessBody).suggested_category;
}
