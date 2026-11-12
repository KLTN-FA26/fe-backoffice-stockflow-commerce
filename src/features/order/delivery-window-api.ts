/**
 * Dời cửa sổ giao — API layer (BE `DeliveryBatchController#changeWindow`, docs 17 §4.5, BR-28).
 * POST /orders/{orderId}/delivery-batches/{batchId}/window-change — `sales-contracts:UPDATE` (Sale).
 * Body `WindowChangeRequest`: {windowStart, windowEnd, reasonCode, note, evidenceMessageId} (đúng một bằng chứng).
 * Trả lịch giao hiệu lực mới (`Schedule`) kèm lịch sử dời.
 */

import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { beDeliveryScheduleSchema } from "./delivery-batch-schemas";
import { orderPath } from "./api";

import type { DeliverySchedule } from "./delivery-batch-api";
import type { WindowChangeValues } from "./delivery-window-schemas";

export type ChangeDeliveryWindowInput = WindowChangeValues & {
  orderId: string;
  batchId: string;
  idempotencyKey?: string;
};

export async function changeDeliveryWindow(
  input: ChangeDeliveryWindowInput,
): Promise<DeliverySchedule> {
  const { orderId, batchId, idempotencyKey, ...body } = input;
  const { data } = await api.post<unknown>(
    orderPath(orderId, `/delivery-batches/${encodeURIComponent(batchId)}/window-change`),
    {
      windowStart: body.windowStart,
      windowEnd: body.windowEnd,
      reasonCode: body.reasonCode,
      note: body.note,
      evidenceMessageId: body.evidenceMessageId,
    },
    idempotencyRequestConfig(idempotencyKey),
  );
  return beDeliveryScheduleSchema.parse(data);
}
