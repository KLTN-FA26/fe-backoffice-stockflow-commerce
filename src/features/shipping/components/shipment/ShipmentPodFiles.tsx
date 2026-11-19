"use client";

import { podFilesGate } from "@/features/shipping/attached-files-lifecycle";

import { AttachedFilesCard } from "../files/AttachedFilesCard";
import { useShippingActor } from "../useShippingActor";

import type { ShipmentRow } from "@/features/shipping/types";

/**
 * Biên bản giao nhận (POD) của lô giao (docs 09 §4.3 bước 2, BR-28; BE `ShipmentPodController`): danh sách, tải lên, tải
 * xuống. Quyền + trạng thái quyết định ở `podFilesGate` (`attached-files-lifecycle.ts`): chưa giao thì giải thích bằng tiếng
 * Việt. Đọc cần `fulfillment-shipments:READ` — màn lô giao đã đòi quyền đó. UI-only — Backend phải re-check (BR-28).
 */
export function ShipmentPodFiles({
  shipment,
}: {
  shipment: Pick<ShipmentRow, "shipmentId" | "status">;
}) {
  const { canUpload, blockedReason } = podFilesGate(shipment.status, useShippingActor());
  return (
    <AttachedFilesCard
      kind="pod"
      ownerId={shipment.shipmentId}
      canUpload={canUpload}
      uploadBlockedReason={blockedReason}
    />
  );
}
