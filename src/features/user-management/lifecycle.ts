import { USER_STATUS_ACTIONS } from "./constants";

import type { UserDto, UserStatus } from "./types";

export type UserStatusAction = (typeof USER_STATUS_ACTIONS)[number];

/**
 * Chuyển trạng thái tài khoản — chép từ `User.lock/unlock/disable/enable` (BE PR #72, SCRUM-456):
 * - lock: ACTIVE → LOCKED (khoá lại tài khoản đã khoá là no-op; DISABLED phải kích hoạt trước);
 * - unlock: LOCKED → ACTIVE, và kết thúc sớm đợt khoá do sai mật khẩu của tài khoản ACTIVE;
 * - disable: mọi trạng thái → DISABLED (giữ lại để lịch sử còn tên);
 * - enable: DISABLED → ACTIVE (tài khoản LOCKED phải "mở khoá", không "kích hoạt").
 * Terminal không có: DISABLED vẫn kích hoạt lại được.
 */
export const USER_TRANSITIONS: Record<UserStatus, readonly UserStatusAction[]> = {
  ACTIVE: ["lock", "disable"],
  LOCKED: ["unlock", "disable"],
  DISABLED: ["enable"],
};

/** Còn đợt khoá tự động do nhập sai mật khẩu (`lockedUntil` ở tương lai). */
export function hasTemporaryLock(user: Pick<UserDto, "lockedUntil">, now = new Date()): boolean {
  return !!user.lockedUntil && new Date(user.lockedUntil) > now;
}

/** Hành động đổi trạng thái hợp lệ của tài khoản — UI-only, BE re-check (BE `INVALID_USER_STATUS_TRANSITION`). */
export function allowedStatusActions(
  user: Pick<UserDto, "status" | "lockedUntil">,
  now = new Date(),
): UserStatusAction[] {
  const actions = [...USER_TRANSITIONS[user.status]];
  if (user.status === "ACTIVE" && hasTemporaryLock(user, now)) actions.unshift("unlock");
  return actions;
}
