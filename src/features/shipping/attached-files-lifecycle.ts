/**
 * Shipping — action-gating file đính kèm (feature-architecture §6): khi nào tải lên được file vận đơn của chuyến / biên bản
 * giao nhận (POD) của lô giao. Quyền + trạng thái quyết định; trả lý do tiếng Việt khi trạng thái chưa cho.
 *
 * - File vận đơn (docs 09 §4.4, BR-28): `fulfillment-dispatch:UPDATE`; chỉ khi chuyến đã đặt xe với hãng (Tú đã chốt, câu
 *   RTM-WAYBILLFILE); chuyến đã huỷ không nhận thêm (BE 409 INVALID_LOAD_TRANSITION).
 * - POD (docs 09 §4.3 bước 2, BR-28, E16): `fulfillment-delivery-outcomes:UPDATE` (không cần APPROVE); chỉ lô đã giao
 *   (BE 409 SHIPMENT_STATE_CONFLICT).
 *
 * UI-only — Backend phải re-check (quyền, phạm vi kho, trạng thái; docs 09 BR-28).
 */

import {
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS,
  FULFILLMENT_DISPATCH_PERMISSIONS,
  LOAD_STATUS,
  PACK_SHIPMENT_STATUS,
} from "@/constants";
import { SHIPPING_FILE_LABELS } from "@/constants/shipping-files";

import type { ShippingActor } from "./lifecycle";
import type { Load, ShipmentRow } from "./types";

export interface AttachedFilesGate {
  /** Có quyền tải lên (nút / hộp tải lên chỉ hiện khi true). */
  readonly canUpload: boolean;
  /** Câu tiếng Việt khi người có quyền nhưng trạng thái chưa cho tải lên; `null` = tải lên được. */
  readonly blockedReason: string | null;
}

/** Chuyến đã ghi nhận đặt xe (đã có hãng) và còn sống: PLANNED là chưa đặt xe (huỷ đặt xe cũng về PLANNED). */
const isBooked = (status: Load["status"]) =>
  status === LOAD_STATUS.VEHICLE_BOOKED ||
  status === LOAD_STATUS.LOADING ||
  status === LOAD_STATUS.DISPATCHED;

export function waybillFilesGate(status: Load["status"], actor: ShippingActor): AttachedFilesGate {
  const L = SHIPPING_FILE_LABELS.waybill;
  let blockedReason: string | null = null;
  if (status === LOAD_STATUS.CANCELLED) blockedReason = L.cancelled;
  else if (!isBooked(status)) blockedReason = L.notBooked;
  return { canUpload: actor.can(FULFILLMENT_DISPATCH_PERMISSIONS.update), blockedReason };
}

export function podFilesGate(
  status: ShipmentRow["status"],
  actor: ShippingActor,
): AttachedFilesGate {
  const L = SHIPPING_FILE_LABELS.pod;
  const canUpload = actor.can(FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS.update);
  let blockedReason: string | null = null;
  if (status === PACK_SHIPMENT_STATUS.DELIVERED) blockedReason = null;
  // Đã hoàn về kho / đã huỷ: không còn đường tới "đã giao" nên không có biên bản
  else if (status === PACK_SHIPMENT_STATUS.RETURNED || status === PACK_SHIPMENT_STATUS.CANCELLED)
    blockedReason = L.notApplicable;
  else blockedReason = L.notDelivered;
  // Người không có quyền chỉ xem danh sách: không nhắc họ phải ghi nhận giao
  return { canUpload, blockedReason: canUpload ? blockedReason : null };
}
