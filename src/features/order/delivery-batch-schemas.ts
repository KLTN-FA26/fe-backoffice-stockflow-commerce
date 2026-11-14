/**
 * Lịch giao của một đơn — DTO BE `DeliveryBatchService.Schedule` (`GET /orders/{id}/delivery-batches`, docs 17 §4.5,
 * §5.5, BR-28): đợt nào, cửa sổ hợp đồng + cửa sổ hiệu lực, trạng thái hiển thị, đã release chưa, thùng theo SKU, lịch
 * sử dời cửa sổ. Jackson `non_null`: field null bị bỏ → `.nullish()`. Trạng thái hiển thị lạ → "UNKNOWN" (không đoán).
 */

import { z } from "zod";

/** BE `DeliveryBatchService.BatchState` — trạng thái HIỂN THỊ của đợt (docs 17 §5.5), không phải trạng thái đơn. */
export const DELIVERY_BATCH_STATES = [
  "AWAITING_STOCK",
  "READY",
  "IN_DELIVERY",
  "DELIVERED",
  "CLOSED",
] as const;

/** BE `DeliveryBatchService.WindowChangeView` — một lần dời cửa sổ (BR-28): cửa sổ cũ / mới, lý do, bằng chứng, người. */
export const beWindowChangeSchema = z.object({
  id: z.string(),
  oldStart: z.string().nullish(),
  oldEnd: z.string().nullish(),
  newStart: z.string().nullish(),
  newEnd: z.string().nullish(),
  /** BE `WindowChangeReason`: CUSTOMER_REQUEST | SELLER_DELAY — mã lạ hiện nguyên văn. */
  reason: z.string(),
  note: z.string().nullish(),
  /** Bằng chứng là tệp: tên tệp; là tin nhắn chat: id tin nhắn — đúng một trong hai (BR-28). */
  evidenceFileName: z.string().nullish(),
  evidenceMessageId: z.string().nullish(),
  changedBy: z.string().nullish(),
  changedAt: z.string().nullish(),
});

export const beDeliveryBatchSchema = z.object({
  batchId: z.string(),
  seq: z.number().int(),
  /** Cửa sổ ghi trên hợp đồng đã ký — không đổi (docs 14 BR-14). */
  contractWindowStart: z.string().nullish(),
  contractWindowEnd: z.string().nullish(),
  /** Cửa sổ HIỆU LỰC (lần dời mới nhất, hoặc của hợp đồng khi chưa dời). */
  windowStart: z.string().nullish(),
  windowEnd: z.string().nullish(),
  state: z.enum([...DELIVERY_BATCH_STATES, "UNKNOWN"]).catch("UNKNOWN"),
  late: z.boolean().nullish(),
  /** Có = kho đã release đợt này. */
  releasedAt: z.string().nullish(),
  lines: z
    .array(
      z.object({
        orderLineId: z.string(),
        sku: z.string().nullish(),
        cartons: z.number().int(),
        heldCartons: z.number().int(),
      }),
    )
    .default([]),
  windowChanges: z.array(beWindowChangeSchema).default([]),
});

export const beDeliveryScheduleSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  contractNumber: z.string().nullish(),
  batches: z.array(beDeliveryBatchSchema).default([]),
});
