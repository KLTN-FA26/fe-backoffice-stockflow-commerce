/**
 * Fulfillment task — Input schema (dữ liệu form gửi đi), khớp request BE FulfillmentController.
 */

import { z } from "zod";

import {
  FULFILLMENT_FIELD_MESSAGES,
  PICK_DESTINATION,
  PICK_DESTINATIONS,
  PICK_LINE_LIMITS,
} from "@/constants";

const MSG = FULFILLMENT_FIELD_MESSAGES;

/** BE `AssignmentRequest` — `assignedUserId` @NotNull. */
export const assignInputSchema = z.object({
  assignedUserId: z.string().min(1, MSG.assigneeRequired),
});

/**
 * BE `CreateTaskRequest` — `orderId`, `assignedUserId` @NotNull; `destination` mặc định DISPATCH (docs 07 §3 "Đích
 * lấy hàng"); `stagingLocationCode` @Size(max = 64) là khu chờ xuất của task STAGING — có thể bỏ khi kho chỉ có đúng
 * một khu chờ xuất đang hoạt động (BE `stagingAreaFor`, 422 STAGING_AREA_INVALID nếu không phải khu của kho).
 * Khu chờ xuất chỉ gửi khi đích là STAGING (đích DISPATCH thì BE bỏ qua).
 */
export const createTaskInputSchema = assignInputSchema.extend({
  orderId: z.string().min(1, MSG.orderRequired),
  destination: z.enum(PICK_DESTINATIONS).default(PICK_DESTINATION.DISPATCH),
  stagingLocationCode: z.string().trim().max(PICK_LINE_LIMITS.codeMax, MSG.codeTooLong).optional(),
});
