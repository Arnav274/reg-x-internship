import { insertTicket, Ticket } from "../db/models/ticket.model";
import { ValidatedTicketBody } from "../middleware/validate.middleware";

export async function createTicket(
  identity: { username: string; email: string },
  payload: ValidatedTicketBody
): Promise<Ticket> {
  return insertTicket({
    username: identity.username,
    email: identity.email,
    product_name: payload.product_name,
    category: payload.category,
    issue_description: payload.issue_description,
  });
}
