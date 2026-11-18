"use client";

import { FULFILLMENT_DISPATCH_PERMISSIONS, LOAD_STATUS } from "@/constants";
import { SHIPPING_FILE_LABELS } from "@/constants/shipping-files";
import { useCan } from "@/lib/auth";

import { AttachedFilesCard } from "../files/AttachedFilesCard";

import type { Load } from "@/features/shipping/types";

/**
 * File vận đơn của chuyến (docs 09 §4.4, BR-28; BE `LoadWaybillController`): danh sách, tải lên, tải xuống. Tải lên cần
 * `fulfillment-dispatch:UPDATE`; BE nhận file ở mọi trạng thái trừ chuyến đã huỷ (409 INVALID_LOAD_TRANSITION) nên chuyến
 * huỷ chỉ xem / tải xuống. Đọc cần `fulfillment-shipments:READ` — màn chuyến đã đòi quyền đó.
 */
export function LoadWaybillFiles({ load }: { load: Pick<Load, "loadId" | "status"> }) {
  const canUpload = useCan(FULFILLMENT_DISPATCH_PERMISSIONS.update);
  return (
    <AttachedFilesCard
      kind="waybill"
      ownerId={load.loadId}
      canUpload={canUpload}
      uploadBlockedReason={
        load.status === LOAD_STATUS.CANCELLED ? SHIPPING_FILE_LABELS.waybill.cancelled : null
      }
    />
  );
}
