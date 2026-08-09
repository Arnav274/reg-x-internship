const API_BASE_URL = "http://localhost:3000";

export const CATEGORIES = ["High", "Medium", "Low", "Suggestion", "Request"] as const;
export type TicketCategory = (typeof CATEGORIES)[number];

export interface CreateTicketRequest {
  product_name: string;
  category: TicketCategory;
  issue_description: string;
  // Both are required rather than optional: omission is reserved as a
  // "pre-AI client" signal server-side, so this widget always states them.
  ai_suggested_category: TicketCategory | null;
  ai_mode_enabled: boolean;
}

export interface CreateTicketResponseData {
  ticket_id: string;
  datetime: string;
  product_name: string;
  category: TicketCategory;
  username: string;
}

interface CreateTicketSuccessBody {
  status: "success";
  message: string;
  data: CreateTicketResponseData;
}

interface ErrorBody {
  error: string;
}

export async function createTicket(
  payload: CreateTicketRequest,
  token: string
): Promise<CreateTicketResponseData> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as CreateTicketSuccessBody | ErrorBody;

  if (!response.ok) {
    const message = "error" in body ? body.error : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return (body as CreateTicketSuccessBody).data;
}
