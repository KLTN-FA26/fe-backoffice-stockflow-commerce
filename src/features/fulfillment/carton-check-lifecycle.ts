/**
 * Trạm kiểm thùng & dán nhãn giao hàng — action-gating (feature-architecture §6).
 *
 * Bảng chuyển trạng thái phiên (`PACK_TRANSITIONS`) và thùng (`CARTON_TRANSITIONS`) nằm ở `lib/domain/lifecycle.ts`
 * (docs 08 §5.1, §5.2). Mỗi endpoint gate bằng MỘT mã quyền (BE `@RequiresPermission`), không đọc tên vai trò:
 * - xem hàng chờ / phiên: `fulfillment-packages:READ`;
 * - bắt đầu, quét LPN, dán nhãn, in lại, loại thùng, hoàn tất: `fulfillment-packing:UPDATE`; người khác ngoài người
 *   bắt đầu phiên bị `PACKING_TAKEN` trừ người có `fulfillment-packing:APPROVE` (quản lý kho, docs 08 BR-06);
 * - in PDF nhãn: `fulfillment-packing:READ`.
 * UI-only — Backend phải re-check (CartonCheckController, CartonCheckService, CartonCheck).
 */

import {
  CARTON_STATUS,
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PACKING_PERMISSIONS,
  PACK_STATUS,
} from "@/constants";
import { CARTON_TRANSITIONS, canTransition } from "@/lib/domain/lifecycle";

import type { FulfillmentActor } from "./lifecycle";
import type { Carton, CartonCheckSession } from "./carton-check-types";

const PACKING = FULFILLMENT_PACKING_PERMISSIONS;
/** Shipment còn ở kho (chưa rời): thùng vẫn in lại nhãn được (BE: "until the carton leaves"). */
const READY_SHIPMENT = "READY_TO_DISPATCH";

export interface CartonCheckAccess {
  /** Quyền xem phiên (packages:READ). */
  canRead: boolean;
  /** Có quyền thao tác kiểm thùng nói chung (packing:UPDATE). */
  canPack: boolean;
  /** Làm thay / tiếp quản phiên của người khác (packing:APPROVE — quản lý kho). */
  canTakeOver: boolean;
  /** Chính người này đã bắt đầu phiên. */
  isOwner: boolean;
  /** Bắt đầu kiểm: phiên còn Pending. */
  canStart: boolean;
  /** Quét, dán nhãn, loại thùng, hoàn tất: phiên In Progress và là người bắt đầu hoặc quản lý kho. */
  canWork: boolean;
  /** In lại nhãn: phiên In Progress hoặc Completed, và là người bắt đầu hoặc quản lý kho. */
  canReprint: boolean;
  /** Đang có người khác kiểm và người này không có quyền tiếp quản → chỉ xem (BE `PACKING_TAKEN`). */
  takenByOther: boolean;
  /** Quản lý kho thao tác trong phiên của người khác. */
  managerAssist: boolean;
  /** In PDF nhãn giao hàng (packing:READ). */
  canPrint: boolean;
}

export function cartonCheckAccess(
  session: Pick<CartonCheckSession, "status" | "startedBy">,
  actor: FulfillmentActor,
): CartonCheckAccess {
  const canRead = actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.read);
  const canPack = actor.can(PACKING.update);
  const canTakeOver = actor.can(PACKING.approve);
  const isOwner = actor.userId !== null && session.startedBy === actor.userId;
  const inProgress = session.status === PACK_STATUS.IN_PROGRESS;
  const mayAct = isOwner || canTakeOver;
  return {
    canRead,
    canPack,
    canTakeOver,
    isOwner,
    canStart: canPack && session.status === PACK_STATUS.PENDING,
    canWork: canPack && inProgress && mayAct,
    canReprint: canPack && (inProgress || session.status === PACK_STATUS.COMPLETED) && mayAct,
    takenByOther: canPack && inProgress && !isOwner && !canTakeOver,
    managerAssist: canPack && inProgress && canTakeOver && !isOwner && !!session.startedBy,
    canPrint: actor.can(PACKING.read),
  };
}

/** Thao tác khả dụng trên MỘT thùng — gộp trạng thái thùng, bảng chuyển trạng thái và quyền. */
export interface CartonActions {
  /** Dán nhãn riêng thùng này (To Check phải quét trước → chỉ Checked, và SKU đã có quy cách thùng). */
  label: boolean;
  /** In PDF nhãn của thùng đã dán nhãn. */
  print: boolean;
  /** In lại nhãn (nhãn cũ vô hiệu). */
  reprint: boolean;
  /** Loại thùng hư hỏng (chưa thuộc shipment). */
  remove: boolean;
}

const NONE: CartonActions = { label: false, print: false, reprint: false, remove: false };

export function cartonActions(
  carton: Carton,
  session: Pick<CartonCheckSession, "shipments" | "skusWithoutCartonSpec">,
  access: CartonCheckAccess,
): CartonActions {
  if (carton.status === "Unknown" || carton.status === CARTON_STATUS.REMOVED) return NONE;
  const unmeasured = session.skusWithoutCartonSpec.includes(carton.sku);
  const shipment = carton.shipmentId
    ? session.shipments.find((candidate) => candidate.shipmentId === carton.shipmentId)
    : undefined;
  // Thùng đã vào shipment: loại khỏi đơn chỉ qua shipment (BE `PACKAGE_SHIPPED`)
  const inShipment = !!carton.shipmentId;
  return {
    label:
      access.canWork &&
      carton.status === CARTON_STATUS.CHECKED &&
      canTransition(CARTON_TRANSITIONS, carton.status, CARTON_STATUS.LABELED) &&
      !unmeasured,
    print: access.canPrint && carton.status === CARTON_STATUS.LABELED,
    reprint:
      access.canReprint &&
      carton.status === CARTON_STATUS.LABELED &&
      (!shipment || shipment.status === READY_SHIPMENT),
    remove:
      access.canWork &&
      !inShipment &&
      canTransition(CARTON_TRANSITIONS, carton.status, CARTON_STATUS.REMOVED),
  };
}

/** Thùng Checked của SKU đã có quy cách — dán nhãn được ngay (BR-07 chặn cả loạt nếu lẫn thùng thiếu quy cách). */
export function labelableCartons(
  session: Pick<CartonCheckSession, "cartons" | "skusWithoutCartonSpec">,
): Carton[] {
  return session.cartons.filter(
    (carton) =>
      carton.status === CARTON_STATUS.CHECKED &&
      !session.skusWithoutCartonSpec.includes(carton.sku),
  );
}

/** Thùng đã dán nhãn chưa vào shipment — thứ `shipping-labels` in khi không chọn thùng, và thứ hoàn tất gom lại. */
export function printableCartons(session: Pick<CartonCheckSession, "cartons">): Carton[] {
  return session.cartons.filter(
    (carton) => carton.status === CARTON_STATUS.LABELED && !carton.shipmentId,
  );
}
