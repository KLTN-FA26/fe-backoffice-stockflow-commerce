/** BE-12: a single-use, 30 s ticket a STOMP CONNECT redeems in place of the HttpOnly session token. */

import { z } from "zod";

import { api } from "@/lib/api/client";

const socketTicketSchema = z.object({
  ticket: z.string().min(1),
  expiresIn: z.number().optional(),
});

/** `POST /chat/socket-tickets` (perm `chat-conversations:READ`, 30 per 60 s per user). Never reuse a ticket. */
export async function fetchSocketTicket(signal?: AbortSignal): Promise<string> {
  const { data } = await api.post<unknown>("/chat/socket-tickets", undefined, { signal });
  return socketTicketSchema.parse(data).ticket;
}
