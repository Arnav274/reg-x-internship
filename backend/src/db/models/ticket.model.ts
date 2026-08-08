import { pool } from "../index";

export const ALLOWED_CATEGORIES = ["High", "Medium", "Low", "Suggestion", "Request"] as const;
export type TicketCategory = (typeof ALLOWED_CATEGORIES)[number];

export interface Ticket {
  ticket_id: string;
  username: string;
  email: string;
  datetime: Date;
  product_name: string;
  category: TicketCategory;
  issue_description: string;
}

export interface NewTicket {
  username: string;
  email: string;
  product_name: string;
  category: TicketCategory;
  issue_description: string;
}

export async function insertTicket(ticket: NewTicket): Promise<Ticket> {
  const result = await pool.query<Ticket>(
    `INSERT INTO tickets (username, email, product_name, category, issue_description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      ticket.username,
      ticket.email,
      ticket.product_name,
      ticket.category,
      ticket.issue_description,
    ]
  );

  return result.rows[0];
}
