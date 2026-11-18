"use client";

import { FULFILLMENT_DISPATCH_PERMISSIONS, LOAD_STATUS } from "@/constants";
import { SHIPPING_FILE_LABELS } from "@/constants/shipping-files";
import { useCan } from "@/lib/auth";

import { AttachedFilesCard } from "../files/AttachedFilesCard";

import type { Load } from "@/features/shipping/types";

/** Chuyến đã ghi nhận đặt xe (đã có hãng) và còn sống — như thẻ Mã vận đơn: PLANNED là chưa đặt xe (huỷ đặt xe cũng về PLANNED). */
const isBooked = (status: Load["status"]) =>
  status === LOAD_STATUS.VEHICLE_BOOKED ||
  status === LOAD_STATUS.LOADING ||
  status === LOAD_STATUS.DISPATCHED;

/**
 * File vận đơn của chuyến (docs 09 §4.4, BR-28; BE `LoadWaybillController`): danh sách, tải lên, tải xuống. Tải lên cần
 * `fulfillment-dispatch:UPDATE` và chỉ khi chuyến đã đặt xe với hãng (Tú: chặn tới khi đã đặt xe; chưa đặt thì nói lý do); chuyến
 * đã huỷ chỉ xem / tải xuống (BE 409 INVALID_LOAD_TRANSITION). Đọc cần `fulfillment-shipments:READ` — màn chuyến đã đòi quyền đó.
 */
function uploadBlockedReason(status: Load["status"]): string | null {
  if (status === LOAD_STATUS.CANCELLED) return SHIPPING_FILE_LABELS.waybill.cancelled;
  return isBooked(status) ? null : SHIPPING_FILE_LABELS.waybill.notBooked;
}

export function LoadWaybillFiles({ load }: { load: Pick<Load, "loadId" | "status"> }) {
  const canUpload = useCan(FULFILLMENT_DISPATCH_PERMISSIONS.update);
  return (
    <AttachedFilesCard
      kind="waybill"
      ownerId={load.loadId}
      canUpload={canUpload}
      uploadBlockedReason={uploadBlockedReason(load.status)}
    />
  );
}
