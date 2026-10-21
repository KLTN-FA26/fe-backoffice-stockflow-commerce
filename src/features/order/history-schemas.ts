/**
 * Order — lịch sử đơn (`GET /orders/{id}/history`): DTO BE + mục đã phân loại cho UI.
 */

import { z } from "zod";

import { ORDER_HISTORY_ENTRY_TYPES } from "@/constants/labels-order";
import { ORDER_STATUSES } from "@/constants/statuses";

import { orderStatusDtoSchema } from "./schemas";

/**
 * BE `OrderStatusChangeResponse` (BE PR #150, "review of #150"): mỗi mục có `type` — `STATUS_CHANGE`
 * (trạng thái đi `from` → `to`) hoặc `PARTIAL_SHIPMENT_DECISION` (Sales bật / tắt giao một phần,
 * `from` / `to` null, `partialShipmentAllowed`, `reason` = ghi chú của Sales). Mục thứ hai chỉ nhân viên
 * thấy. `type` vắng (BE cũ) = STATUS_CHANGE; giá trị lạ → "UNKNOWN".
 */
export const orderHistoryEntryDtoSchema = z.object({
  type: z
    .enum([...ORDER_HISTORY_ENTRY_TYPES, "UNKNOWN"])
    .default("STATUS_CHANGE")
    .catch("UNKNOWN"),
  from: orderStatusDtoSchema.nullish(),
  to: orderStatusDtoSchema.nullish(),
  reason: z.string().nullish(),
  occurredAt: z.string(),
  actorId: z.string().nullish(),
  actorName: z.string().nullish(),
  partialShipmentAllowed: z.boolean().nullish(),
});

export const orderHistoryDtoSchema = z.array(orderHistoryEntryDtoSchema);

const historyEntryBase = {
  occurredAt: z.string(),
  reason: z.string().nullable(),
  /** Tên người thực hiện; null với hệ thống / bước ghi trước G3-2. */
  actorName: z.string().nullable(),
};

/** Mục lịch sử đã phân loại — UI render theo `kind`, không đọc `type` thô. */
export const orderHistoryEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    ...historyEntryBase,
    kind: z.literal("status-change"),
    /** null ở bước đầu (đơn vừa được đặt). */
    from: z.enum(ORDER_STATUSES).nullable(),
    to: z.enum(ORDER_STATUSES),
  }),
  z.object({
    ...historyEntryBase,
    kind: z.literal("partial-shipment"),
    /** true = Sales bật giao một phần; false = tắt. */
    allowed: z.boolean(),
  }),
  z.object({ ...historyEntryBase, kind: z.literal("unknown") }),
]);
