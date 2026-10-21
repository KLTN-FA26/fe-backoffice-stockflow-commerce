/**
 * Trạm đóng gói — action-gating (feature-architecture §6).
 *
 * BE (PR #136) gate KÉP: mã quyền `fulfillment-packages` (`@RequiresPermission`) VÀ vai trò
 * (`@PreAuthorize`). Xem phiên / hàng chờ: nhân viên kho, quản lý kho, QC (quyền READ). Thao tác
 * (nhận đơn, kiện, quét, hoàn tất): chỉ nhân viên kho / quản lý kho (quyền CREATE) — KHÔNG còn đòi là
 * người được gán lấy hàng như bản cũ; ai nhận đơn ở bàn đóng gói (`packerId`) mới là người đóng.
 * Người khác bị `PACKING_TAKEN`, trừ quản lý kho (không bị chặn, người nhận đơn không đổi). Kiểm tra
 * lại thiết kế: QC / quản lý kho. UI-only — Backend phải re-check (PackingController, PackingSession).
 */

import { FULFILLMENT_PACKAGE_PERMISSIONS, PACK_STATUS, STAFF_ROLE } from "@/constants";

import { hasStaffRole } from "./lifecycle";

import type { FulfillmentActor } from "./lifecycle";
import type { PackingSession } from "./packing-types";

const { QC_STAFF, WAREHOUSE_MANAGER, WAREHOUSE_STAFF } = STAFF_ROLE;

export interface PackingAccess {
  /** Quyền xem phiên (READ) — nhân viên kho, quản lý kho, QC. */
  canRead: boolean;
  /** Có quyền thao tác đóng gói nói chung (CREATE + vai trò nhân viên / quản lý kho). */
  canPack: boolean;
  isManager: boolean;
  /** Chính người này đã nhận đơn. */
  isOwner: boolean;
  /** Nhận đơn ở bàn đóng gói: phiên còn PENDING. */
  canStart: boolean;
  /** Quét, mở / niêm phong / huỷ kiện, hoàn tất: phiên PACKING và là người nhận đơn hoặc quản lý kho. */
  canWork: boolean;
  /** Đang có người khác đóng và người này không phải quản lý → chỉ xem (BE `PACKING_TAKEN`). */
  takenByOther: boolean;
  /** Quản lý kho thao tác trong phiên của người khác. */
  managerAssist: boolean;
  /** QC / quản lý kho kiểm tra lại thiết kế khi phiên bị giữ. */
  canReverify: boolean;
  /** Xem nhãn: nhân viên kho / quản lý kho có quyền READ (QC không được — `@PreAuthorize` của BE). */
  canLabel: boolean;
}

export function packingAccess(
  session: Pick<PackingSession, "packStatus" | "packerId">,
  actor: FulfillmentActor,
): PackingAccess {
  const canRead = actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.read);
  const floorRole = hasStaffRole(actor, [WAREHOUSE_STAFF, WAREHOUSE_MANAGER]);
  const canPack = actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.create) && floorRole;
  const isManager = hasStaffRole(actor, [WAREHOUSE_MANAGER]);
  const isOwner = actor.userId !== null && session.packerId === actor.userId;
  const packing = session.packStatus === PACK_STATUS.PACKING;
  return {
    canRead,
    canPack,
    isManager,
    isOwner,
    canStart: canPack && session.packStatus === PACK_STATUS.PENDING,
    canWork: canPack && packing && (isOwner || isManager),
    takenByOther: canPack && packing && !isOwner && !isManager,
    managerAssist: canPack && packing && isManager && !isOwner && !!session.packerId,
    canReverify:
      actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.create) &&
      session.packStatus === PACK_STATUS.ON_HOLD &&
      hasStaffRole(actor, [QC_STAFF, WAREHOUSE_MANAGER]),
    canLabel: canRead && floorRole,
  };
}
