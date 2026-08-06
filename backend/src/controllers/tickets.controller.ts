import { Request, Response } from "express";
import { createTicket } from "../services/tickets.service";
import { ValidatedTicketBody } from "../middleware/validate.middleware";

export async function createTicketController(
  req: Request,
  res: Response
): Promise<void> {
  // auth.middleware always runs before this controller (wired in M1-7),
  // so identity is guaranteed to be set by the time we get here.
  const identity = req.identity!;
  const payload = req.body as ValidatedTicketBody;

  const ticket = await createTicket(identity, payload);

  res.status(201).json({
    status: "success",
    message: "Ticket created successfully",
    data: {
      ticket_id: ticket.ticket_id,
      datetime: ticket.datetime,
      product_name: ticket.product_name,
      category: ticket.category,
      username: ticket.username,
    },
  });
}
