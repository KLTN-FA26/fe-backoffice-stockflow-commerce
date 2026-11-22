import { PACK_SHIPMENT_STATUS } from "@/constants/statuses";

import type { Shipment } from "./types";

/** BE `ShipmentEventJpaEntity.source` của bước hãng báo qua webhook (docs 09 BR-02). */
export const WEBHOOK_SOURCE = "CARRIER_WEBHOOK";

/**
 * Bước "Giao thất bại" do hãng báo qua webhook mang nguyên văn lý do của hãng (docs 09 §4.1 / §4.3 bước 3: lý do hãng
 * được ánh xạ sang mã nội bộ và lý do gốc được lưu kèm làm ghi chú). Chỉ bước này mới là "lý do gốc của hãng".
 */
export function isCarrierOriginalWording(step: Shipment["timeline"][number]): boolean {
  return (
    step.source === WEBHOOK_SOURCE &&
    step.status === PACK_SHIPMENT_STATUS.DELIVERY_FAILED &&
    Boolean(step.note)
  );
}

/** Ghi chú của lô giao thất bại là nguyên văn lý do của hãng (cùng chữ với bước webhook) — để gắn nhãn đúng. */
export function failureNoteIsCarrierWording(data: Shipment): boolean {
  return (
    Boolean(data.failureNote) &&
    data.timeline.some((step) => isCarrierOriginalWording(step) && step.note === data.failureNote)
  );
}
