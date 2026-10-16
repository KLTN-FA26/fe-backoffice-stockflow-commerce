/**
 * Fulfillment task — Input schema (dữ liệu form gửi đi), khớp request BE FulfillmentController.
 */

import { z } from "zod";

import { FULFILLMENT_FIELD_MESSAGES, FULFILLMENT_LIMITS } from "@/constants";

const MSG = FULFILLMENT_FIELD_MESSAGES;

/** BE `AssignmentRequest` — `assignedUserId` @NotNull. */
export const assignInputSchema = z.object({
  assignedUserId: z.string().min(1, MSG.assigneeRequired),
});

/** BE `CreateTaskRequest` — `orderId`, `assignedUserId` @NotNull. */
export const createTaskInputSchema = assignInputSchema.extend({
  orderId: z.string().min(1, MSG.orderRequired),
});

/**
 * BE `ReverificationRequest` — `resolutionNote` @NotBlank @Size(max = 1000).
 * X-CHK (BE docs business-design/04c): gỡ giữ phải ghi lại cách đã xử lý, không có nút bỏ qua.
 */
export const reverifyInputSchema = z.object({
  resolutionNote: z
    .string()
    .trim()
    .min(1, MSG.resolutionNoteRequired)
    .max(FULFILLMENT_LIMITS.resolutionNoteMax, MSG.resolutionNoteTooLong),
});
