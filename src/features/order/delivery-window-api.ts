/**
 * Dời cửa sổ giao — API layer (BE `DeliveryBatchController#changeWindow`, docs 17 §4.5, BR-28).
 * POST /orders/{orderId}/delivery-batches/{batchId}/window-change — `sales-contracts:UPDATE` (Sale).
 * Body `WindowChangeRequest`: {windowStart, windowEnd, reasonCode, note, evidenceUploadId | evidenceMessageId} (đúng một
 * bằng chứng). Trả lịch giao hiệu lực mới (`Schedule`) kèm lịch sử dời.
 *
 * Bằng chứng là tin nhắn chat của khách: GET …/window-change/evidence/messages (`sales-contracts:UPDATE`) liệt kê tin
 * khách đã gửi (mới nhất trước, chữ + giờ), người dùng chọn một rồi `evidenceMessageId` đi trong request đổi cửa sổ.
 *
 * Bằng chứng là tệp: POST …/window-change/evidence/uploads (`sales-contracts:UPDATE`) xin đường tải thẳng lên kho
 * (`lib/api/direct-upload.ts`), rồi `evidenceUploadId` đi trong request đổi cửa sổ.
 */

import { z } from "zod";

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

/**
 * Một tin nhắn của khách dùng được làm bằng chứng (BE `DeliveryBatchService.ConsentMessageView`): `kind` TEXT | ATTACHMENT,
 * `text` null khi tin chỉ có tệp, `subject` = chủ đề cuộc chat của tin nhắn.
 */
export const consentMessageSchema = z.object({
  messageId: z.string(),
  kind: z.string().nullish(),
  text: z.string().nullish(),
  subject: z.string().nullish(),
  sentAt: z.string(),
});
export type ConsentMessage = z.infer<typeof consentMessageSchema>;

/** Tin nhắn của khách trong chat về đơn này (hoặc chưa gắn đơn), mới nhất trước — để Sale chọn làm bằng chứng. */
export async function getWindowConsentMessages(
  orderId: string,
  batchId: string,
  signal?: AbortSignal,
): Promise<ConsentMessage[]> {
  const { data } = await api.get<unknown>(
    orderPath(
      orderId,
      `/delivery-batches/${encodeURIComponent(batchId)}/window-change/evidence/messages`,
    ),
    { signal },
  );
  return z.array(consentMessageSchema).parse(data);
}
