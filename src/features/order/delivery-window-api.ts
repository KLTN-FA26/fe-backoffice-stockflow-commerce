/**
 * Dời cửa sổ giao — API layer (BE `DeliveryBatchController#changeWindow`, docs 17 §4.5, BR-28).
 * POST /orders/{orderId}/delivery-batches/{batchId}/window-change — `sales-contracts:UPDATE` (Sale).
 * Body `WindowChangeRequest`: {windowStart, windowEnd, reasonCode, note, evidenceUploadId | evidenceMessageId} (đúng một
 * bằng chứng). Trả lịch giao hiệu lực mới (`Schedule`) kèm lịch sử dời.
 *
 * Bằng chứng là tệp: POST …/window-change/evidence/uploads (`sales-contracts:UPDATE`) xin đường tải thẳng lên kho
 * (`lib/api/direct-upload.ts`), rồi `evidenceUploadId` đi trong request đổi cửa sổ.
 */

import { api } from "@/lib/api/client";
import { uploadSlotSchema } from "@/lib/api/direct-upload";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { beDeliveryScheduleSchema } from "./delivery-batch-schemas";
import { orderPath } from "./api";

import type { UploadDeclaration } from "@/lib/api/direct-upload";
import type { DeliverySchedule } from "./delivery-batch-api";
import type { WindowChangeValues } from "./delivery-window-schemas";

/** Đúng MỘT bằng chứng (`WindowChangeValues` đã mang đúng một trong hai ô). */
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
      ...("evidenceUploadId" in body
        ? { evidenceUploadId: body.evidenceUploadId }
        : { evidenceMessageId: body.evidenceMessageId }),
    },
    idempotencyRequestConfig(idempotencyKey),
  );
  return beDeliveryScheduleSchema.parse(data);
}

/** Bước 1 của tải tệp bằng chứng: khai báo tệp, nhận đường PUT ngắn hạn (trả body BE chưa parse để `uploadFileDirect` parse). */
export async function beginWindowEvidenceUpload(
  orderId: string,
  batchId: string,
  declaration: UploadDeclaration,
  signal?: AbortSignal,
): Promise<ReturnType<typeof uploadSlotSchema.parse>> {
  const { data } = await api.post<unknown>(
    orderPath(
      orderId,
      `/delivery-batches/${encodeURIComponent(batchId)}/window-change/evidence/uploads`,
    ),
    declaration,
    { signal },
  );
  return uploadSlotSchema.parse(data);
}
