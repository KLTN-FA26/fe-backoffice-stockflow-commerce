/**
 * Quyền thao tác trên danh mục loại xe — mã quyền từ `/identity/me/permissions`, không theo tên vai
 * trò. Hai trạng thái ACTIVE ⇄ INACTIVE chuyển được hai chiều (không có trạng thái kết thúc, không có
 * xoá — loại xe mặc định không bao giờ xoá). UI-only — Backend phải re-check (`fulfillment-vehicle-types`
 * UPDATE trên POST / PUT, BE PR #153).
 */

import { VEHICLE_TYPE_PERMISSIONS, VEHICLE_TYPE_STATUS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { VehicleType } from "./types";

export interface VehicleTypeActor {
  can: (code: PermissionCode) => boolean;
}

/** Trạng thái đích của nút bật / tắt: ACTIVE → INACTIVE và ngược lại. */
export const VEHICLE_TYPE_TRANSITIONS = {
  ACTIVE: [VEHICLE_TYPE_STATUS.INACTIVE],
  INACTIVE: [VEHICLE_TYPE_STATUS.ACTIVE],
} as const satisfies Record<VehicleType["status"], readonly VehicleType["status"][]>;

export interface VehicleTypeActions {
  /** Thêm loại xe mới. */
  create: boolean;
  /** Sửa thông tin (mã không bao giờ sửa được — kể cả loại xe mặc định). */
  edit: boolean;
  /** Trạng thái chuyển tới được từ dòng này; rỗng khi không có quyền cập nhật. */
  statusTargets: readonly VehicleType["status"][];
}

export function vehicleTypeActions(
  row: Pick<VehicleType, "status"> | null,
  actor: VehicleTypeActor,
): VehicleTypeActions {
  const canUpdate = actor.can(VEHICLE_TYPE_PERMISSIONS.update);
  return {
    create: canUpdate,
    edit: canUpdate && row !== null,
    statusTargets: canUpdate && row ? VEHICLE_TYPE_TRANSITIONS[row.status] : [],
  };
}
