/**
 * Trạm đóng gói — action-gating (feature-architecture §6).
 *
 * BE PR #148: mỗi endpoint gate bằng một mã quyền, không còn `@PreAuthorize` theo vai trò.
 * - Xem hàng chờ / phiên: `fulfillment-packages:READ`.
 * - Thao tác (nhận đơn, kiện, quét, niêm phong, hoàn tất): `fulfillment-packing:UPDATE` — không đòi là
 *   người được gán lấy hàng; ai nhận đơn ở bàn đóng gói (`packerId`) mới là người đóng. Người khác bị
 *   `PACKING_TAKEN`, trừ người có `fulfillment-packing:APPROVE` (làm hộ / tiếp quản, người nhận đơn
 *   không đổi — seed: quản lý kho).
 * - Nhãn kiện: `fulfillment-packing:READ`.
 * - Kiểm tra lại thiết kế (docs 08): `fulfillment-design-reverification:UPDATE` (seed: QC, quản lý kho).
 * UI-only — Backend phải re-check (PackingController, PackingSession).
 */

import {
  FULFILLMENT_DESIGN_REVERIFICATION_PERMISSIONS,
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PACKING_PERMISSIONS,
  PACK_STATUS,
} from "@/constants";

import type { FulfillmentActor } from "./lifecycle";
import type { PackingSession } from "./packing-types";

const PACKING = FULFILLMENT_PACKING_PERMISSIONS;

export interface PackingAccess {
  /** Quyền xem phiên (packages:READ). */
  canRead: boolean;
  /** Có quyền thao tác đóng gói nói chung (packing:UPDATE). */
  canPack: boolean;
  /** Làm hộ / tiếp quản phiên của người đóng khác (packing:APPROVE). */
  canTakeOver: boolean;
  /** Chính người này đã nhận đơn. */
  isOwner: boolean;
  /** Nhận đơn ở bàn đóng gói: phiên còn PENDING. */
  canStart: boolean;
  /** Quét, mở / niêm phong / huỷ kiện, hoàn tất: phiên PACKING và là người nhận đơn hoặc có quyền tiếp quản. */
  canWork: boolean;
  /** Đang có người khác đóng và người này không có quyền tiếp quản → chỉ xem (BE `PACKING_TAKEN`). */
  takenByOther: boolean;
  /** Người có quyền tiếp quản thao tác trong phiên của người khác. */
  managerAssist: boolean;
  /** Kiểm tra lại thiết kế khi phiên bị giữ (design-reverification:UPDATE). */
  canReverify: boolean;
  /** Xem nhãn kiện (packing:READ). */
  canLabel: boolean;
}

export function packingAccess(
  session: Pick<PackingSession, "packStatus" | "packerId">,
  actor: FulfillmentActor,
): PackingAccess {
  const canRead = actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.read);
  const canPack = actor.can(PACKING.update);
  const canTakeOver = actor.can(PACKING.approve);
  const isOwner = actor.userId !== null && session.packerId === actor.userId;
  const packing = session.packStatus === PACK_STATUS.PACKING;
  return {
    canRead,
    canPack,
    canTakeOver,
    isOwner,
    canStart: canPack && session.packStatus === PACK_STATUS.PENDING,
    canWork: canPack && packing && (isOwner || canTakeOver),
    takenByOther: canPack && packing && !isOwner && !canTakeOver,
    managerAssist: canPack && packing && canTakeOver && !isOwner && !!session.packerId,
    canReverify:
      actor.can(FULFILLMENT_DESIGN_REVERIFICATION_PERMISSIONS.update) &&
      session.packStatus === PACK_STATUS.ON_HOLD,
    canLabel: actor.can(PACKING.read),
  };
}
