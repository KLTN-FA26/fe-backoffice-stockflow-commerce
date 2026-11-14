/**
 * Lịch giao của một đơn — DTO BE `DeliveryBatchService.Schedule` (`GET /orders/{id}/delivery-batches`, docs 17 §4.5,
 * §5.5). Chỉ giữ phần màn release dùng: đợt nào, cửa sổ giao hiệu lực, trạng thái hiển thị, đã release chưa. Jackson
 * `non_null`: field null bị bỏ → `.nullish()`. Trạng thái hiển thị lạ → "UNKNOWN" (không đoán).
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

export const beDeliveryBatchSchema = z.object({
  batchId: z.string(),
  seq: z.number().int(),
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
        sku: z.string(),
        cartons: z.number().int(),
        heldCartons: z.number().int(),
      }),
    )
    .default([]),
});

export const beDeliveryScheduleSchema = z.object({
  orderId: z.string(),
  batches: z.array(beDeliveryBatchSchema).default([]),
});
