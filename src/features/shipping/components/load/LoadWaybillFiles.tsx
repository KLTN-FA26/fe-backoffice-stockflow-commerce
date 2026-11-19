"use client";

import { waybillFilesGate } from "@/features/shipping/attached-files-lifecycle";

import { AttachedFilesCard } from "../files/AttachedFilesCard";
import { useShippingActor } from "../useShippingActor";

import type { Load } from "@/features/shipping/types";

/**
 * File vận đơn của chuyến (docs 09 §4.4, BR-28; BE `LoadWaybillController`): danh sách, tải lên, tải xuống. Quyền + trạng thái
 * quyết định ở `waybillFilesGate` (`attached-files-lifecycle.ts`). Đọc cần `fulfillment-shipments:READ` — màn chuyến đã đòi
 * quyền đó. UI-only — Backend phải re-check (BR-28).
 */
export function LoadWaybillFiles({ load }: { load: Pick<Load, "loadId" | "status"> }) {
  const { canUpload, blockedReason } = waybillFilesGate(load.status, useShippingActor());
  return (
    <AttachedFilesCard
      kind="waybill"
      ownerId={load.loadId}
      canUpload={canUpload}
      uploadBlockedReason={blockedReason}
    />
  );
}
