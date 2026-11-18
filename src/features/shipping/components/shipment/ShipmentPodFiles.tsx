"use client";

import { FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS } from "@/constants";
import { SHIPPING_FILE_LABELS } from "@/constants/shipping-files";
import { useCan } from "@/lib/auth";

import { AttachedFilesCard } from "../files/AttachedFilesCard";

import type { ShipmentRow } from "@/features/shipping/types";

const L = SHIPPING_FILE_LABELS.pod;

/** Vì sao lô này chưa nhận biên bản (BE `ShipmentPodFiles`: chỉ lô `DELIVERED`, 409 SHIPMENT_STATE_CONFLICT); `null` = nhận được. */
export function podBlockedReason(status: ShipmentRow["status"]): string | null {
  if (status === "DELIVERED") return null;
  // Đã hoàn về kho / đã huỷ: không còn đường tới "đã giao" nên không có biên bản
  if (status === "RETURNED" || status === "CANCELLED") return L.notApplicable;
  return L.notDelivered;
}

/**
 * Biên bản giao nhận (POD) của lô giao (docs 09 §4.3 bước 2, BR-28; BE `ShipmentPodController`): danh sách, tải lên, tải
 * xuống. Tải lên cần `fulfillment-delivery-outcomes:UPDATE` (không cần APPROVE) và chỉ khi lô đã giao thành công; chưa giao
 * thì giải thích bằng tiếng Việt. Người không có quyền tải lên chỉ thấy danh sách. Đọc cần `fulfillment-shipments:READ` —
 * màn lô giao đã đòi quyền đó.
 */
export function ShipmentPodFiles({
  shipment,
}: {
  shipment: Pick<ShipmentRow, "shipmentId" | "status">;
}) {
  const canUpload = useCan(FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS.update);
  return (
    <AttachedFilesCard
      kind="pod"
      ownerId={shipment.shipmentId}
      canUpload={canUpload}
      uploadBlockedReason={canUpload ? podBlockedReason(shipment.status) : null}
    />
  );
}
