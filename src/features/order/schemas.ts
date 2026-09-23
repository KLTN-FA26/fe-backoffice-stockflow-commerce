/**
 * Order — zod schemas + BR traceability.
 *
 * Nguồn BE: OrderController#adminCancel — AdminCancelOrderRequest
 * (record AdminCancelOrderRequest(@NotBlank(message = "reason is required") String reason)).
 */

import { z } from "zod";

/* ── Admin cancel input ──────────────────────────────────────────────── */

export const adminCancelOrderSchema = z.object({
  reason: z.string().min(1, "Lý do huỷ là bắt buộc"),
});

export type AdminCancelOrderInput = z.infer<typeof adminCancelOrderSchema>;
