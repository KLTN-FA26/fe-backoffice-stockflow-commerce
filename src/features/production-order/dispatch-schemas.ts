/** Phiếu gửi, các lần gửi mail và lịch giao của đơn bán (BE `ProductionOrderDispatchController`) — tách khỏi `schemas.ts`. */

import { z } from "zod";

import { PRODUCER_CHANNELS } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/** BE `DownloadLink` — link vài phút, không log. */
export const downloadLinkDto = z.object({ url: z.string(), expiresAt: z.string().nullish() });

/** BE `ProductionOrderMessageAttempt`. */
export const dispatchMessageDto = z.object({
  message: z.string(),
  status: z.string(),
  attemptedAt: z.string().nullish(),
  sentAt: z.string().nullish(),
  failure: z.string().nullish(),
  attemptNumber: z.number().int(),
  recipient: z.string().nullish(),
  generation: z.number().int(),
});

/** BE `ProductionOrderDispatch`: kênh, phiếu đã gửi (vắng khi chưa duyệt) và các lần gửi mail. */
export const dispatchDto = z.object({
  channel: z.enum(PRODUCER_CHANNELS),
  slip: z
    .object({ sha256: z.string(), sizeBytes: z.number().int(), createdAt: z.string() })
    .nullish(),
  messages: bePageSchema(dispatchMessageDto),
});

/** Phần lịch giao của đơn bán FE cần để hiện số đơn + cửa sổ giao (`GET /orders/{id}/delivery-batches`). */
export const salesOrderBatchesDto = z.object({
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  batches: z
    .array(
      z.object({
        batchId: z.string(),
        seq: z.number().int(),
        windowStart: z.string().nullish(),
        windowEnd: z.string().nullish(),
      }),
    )
    .default([]),
});
