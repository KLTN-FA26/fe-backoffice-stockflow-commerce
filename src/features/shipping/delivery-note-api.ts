/**
 * Biên bản giao nhận của MỘT lô giao dạng PDF (BE `GET /fulfillment/shipments/{id}/delivery-note`,
 * `fulfillment-shipments:READ`): mã vạch / QR mã lô, đơn, địa chỉ giao, kiện theo SKU, ba chữ ký. In được từ
 * READY_TO_DISPATCH; lô đã huỷ → 409 SHIPMENT_STATE_CONFLICT. Lỗi vẫn là JSON envelope — `lib/api/client` đọc body Blob ra
 * trước khi map `ApiError`.
 */

import { api } from "@/lib/api/client";

import { SHIPMENTS_PATH } from "./shipment-api";

/** Tên file tải về dựng từ mã lô (không phụ thuộc header Content-Disposition có được lộ ra hay không). */
export const deliveryNoteFileName = (shipmentCode: string): string =>
  `bien-ban-giao-nhan-${shipmentCode.trim().replace(/[^\w.-]+/g, "_")}.pdf`;

export async function downloadDeliveryNote(shipmentId: string): Promise<Blob> {
  const { data } = await api.get<Blob>(
    `${SHIPMENTS_PATH}/${encodeURIComponent(shipmentId)}/delivery-note`,
    { responseType: "blob", headers: { Accept: "application/pdf, application/json" } },
  );
  return data;
}
