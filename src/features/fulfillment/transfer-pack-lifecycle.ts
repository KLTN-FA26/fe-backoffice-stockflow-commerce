/**
 * Đóng gói chuyển kho — action-gating (feature-architecture §6).
 *
 * BE `TransferPackController` (SCRUM-287 PR T, BE PR #164) dùng đúng mã quyền của trạm đóng gói đơn, không quyền mới:
 * - Xem phiên: `fulfillment-packages:READ`.
 * - Thao tác (mở phiên, kiện, đóng bộ, quét, niêm phong, huỷ kiện, nguyên thùng, hoàn tất): `fulfillment-packing:UPDATE`;
 *   người mở phiên (`packerId`) là người đóng — người khác bị `PACKING_TAKEN`, trừ người có `fulfillment-packing:APPROVE`
 *   (quản lý kho: làm hộ / tiếp quản).
 * UI-only — Backend phải re-check (TransferPackService, phạm vi kho nguồn `OUT_OF_DATA_SCOPE`).
 */

import {
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PACKING_PERMISSIONS,
  PACK_STATUS,
} from "@/constants";

import type { FulfillmentActor } from "./lifecycle";
import type { TransferPackSession } from "./transfer-pack-types";

const PACKING = FULFILLMENT_PACKING_PERMISSIONS;

export interface TransferPackAccess {
  /** Quyền xem phiên (packages:READ). */
  canRead: boolean;
  /** Có quyền thao tác đóng gói nói chung (packing:UPDATE). */
  canPack: boolean;
  /** Làm hộ / tiếp quản phiên của người đóng khác (packing:APPROVE). */
  canTakeOver: boolean;
  /** Chính người này đã mở phiên. */
  isOwner: boolean;
  /** Quét, mở / niêm phong / huỷ kiện, đóng bộ, nguyên thùng, hoàn tất: phiên PACKING và là người đóng hoặc quản lý kho. */
  canWork: boolean;
  /** Đang có người khác đóng và người này không có quyền tiếp quản → chỉ xem (BE `PACKING_TAKEN`). */
  takenByOther: boolean;
  /** Người có quyền tiếp quản thao tác trong phiên của người khác. */
  managerAssist: boolean;
  /** Xem / in nhãn kiện (packing:READ — BE `GET …/label`). */
  canLabel: boolean;
}

export function transferPackAccess(
  session: Pick<TransferPackSession, "packStatus" | "packerId">,
  actor: FulfillmentActor,
): TransferPackAccess {
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
    canWork: canPack && packing && (isOwner || canTakeOver),
    takenByOther: canPack && packing && !isOwner && !canTakeOver,
    managerAssist: canPack && packing && canTakeOver && !isOwner && !!session.packerId,
    canLabel: actor.can(PACKING.read),
  };
}
