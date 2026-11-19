/**
 * Quyền thao tác trên danh mục đơn vị sản xuất — theo mã quyền từ `/identity/me/permissions`, không theo tên vai trò.
 * ACTIVE ⇄ INACTIVE chuyển hai chiều qua form sửa (không có trạng thái kết thúc, không có xoá).
 * UI-only — Backend phải re-check (`@RequiresPermission` sales-producers CREATE / UPDATE, docs 17 §4.3).
 */

import { PRODUCER_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";

export interface ProducerActor {
  can: (code: PermissionCode) => boolean;
}

export interface ProducerActions {
  read: boolean;
  /** Thêm đơn vị — Điều phối sản xuất (chốt 2026-11-07). */
  create: boolean;
  /** Sửa / ngừng dùng / dùng lại. Mã không bao giờ sửa được. */
  edit: boolean;
}

export function producerActions(actor: ProducerActor): ProducerActions {
  return {
    read: actor.can(PRODUCER_PERMISSIONS.read),
    create: actor.can(PRODUCER_PERMISSIONS.create),
    edit: actor.can(PRODUCER_PERMISSIONS.update),
  };
}
