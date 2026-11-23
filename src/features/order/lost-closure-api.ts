/**
 * Đóng phần thất lạc — API (WF-05 Q-12, BE-17; contract F-5 + PR-0 `sales-lost-shipment-closures:APPROVE`):
 *
 *   POST /orders/{orderId}/shipments/{shipmentId}/lost-closure/evidence/uploads
 *        {fileName, contentType, sizeBytes, sha256} → `UploadSlot` (tải thẳng lên kho, `lib/api/direct-upload.ts`)
 *   POST /orders/{orderId}/shipments/{shipmentId}/lost-closure  {note, evidenceUploadId, version} → `OrderResponse`
 *        409 ORDER_SHIPMENT_NOT_LOST_CLOSABLE · 409 OPTIMISTIC_LOCK (`version` khác phiên bản đơn hiện tại, BE
 *        `LostShipmentClosures.closeLocked`) · 400 ORDER_SHIPMENT_LOSS_EVIDENCE_REQUIRED · 403 FORBIDDEN
 *
 * Tệp xác nhận đi theo đúng mẫu tải tệp bằng chứng sẵn có (slot → PUT → `…UploadId` trong request của lệnh). Đường slot và
 * field `evidenceUploadId` là hợp đồng FE đề nghị G1 (PR-0 chỉ nói "tệp lưu qua common storage").
 */

import { api } from "@/lib/api/client";
import { uploadSlotSchema } from "@/lib/api/direct-upload";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { orderPath, toOrder } from "./api";
import { orderDtoSchema } from "./schemas";

import type { UploadDeclaration, UploadSlot } from "@/lib/api/direct-upload";
import type { LostClosureValues } from "./delivery-failure-schemas";
import type { Order } from "./types";

const lostClosurePath = (orderId: string, shipmentId: string, suffix = "") =>
  orderPath(orderId, `/shipments/${encodeURIComponent(shipmentId)}/lost-closure${suffix}`);

/** Bước 1 của tải tệp xác nhận thất lạc: khai báo tệp, nhận đường PUT ngắn hạn. */
export async function beginLostEvidenceUpload(
  orderId: string,
  shipmentId: string,
  declaration: UploadDeclaration,
  signal?: AbortSignal,
): Promise<UploadSlot> {
  const { data } = await api.post<unknown>(
    lostClosurePath(orderId, shipmentId, "/evidence/uploads"),
    declaration,
    { signal },
  );
  return uploadSlotSchema.parse(data);
}

export type LostClosureInput = LostClosureValues & {
  orderId: string;
  shipmentId: string;
  /** `Order.version` lúc đọc (BE 6bbfa15b); null = BE không trả → không gửi, BE không kiểm. */
  version: number | null;
  idempotencyKey?: string;
};

/** Đóng phần hàng của lô thất lạc; tiền tính ngay (Q-2/Q-12). Trả đơn sau khi đóng. */
export async function closeLostShipment(input: LostClosureInput): Promise<Order> {
  const { orderId, shipmentId, idempotencyKey, note, evidenceUploadId, version } = input;
  const { data } = await api.post<unknown>(
    lostClosurePath(orderId, shipmentId),
    { note, evidenceUploadId, ...(version == null ? {} : { version }) },
    idempotencyRequestConfig(idempotencyKey),
  );
  return toOrder(orderDtoSchema.parse(data));
}
