/**
 * Quản lý người dùng — mutations. Mọi thay đổi invalidate `userKeys.all` (danh sách + chi tiết) và
 * `roleOptionKeys.all` khi đổi vai trò (số người giữ vai trò `holderCount` đổi theo).
 *
 * Lỗi KHÔNG toast chung: màn hiện lỗi ngay trong dialog / thẻ bằng `identityErrorMessage`.
 * Lỗi "dữ liệu đã đổi" / "trạng thái không còn hợp lệ" tải lại tài khoản để lần thử sau dùng bản mới.
 */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { createMutation } from "@/lib/api/query-factory";
import { roleOptionKeys } from "@/lib/references/role-options";

import {
  assignRole,
  assignWarehouses,
  changeUserStatus,
  createUser,
  resetPassword,
  revokeRole,
  updateUser,
} from "./api";
import { userKeys } from "./queries";

const STALE_CODES = new Set([
  "OPTIMISTIC_LOCK",
  "INVALID_USER_STATUS_TRANSITION",
  "USER_NOT_FOUND",
]);

/** Lỗi "bản đang xem đã cũ" → tải lại tài khoản (truyền vào `onError` của hook). */
function useStaleRefresh() {
  const client = useQueryClient();
  return (error: ApiError) => {
    if (STALE_CODES.has(error.code)) void client.invalidateQueries({ queryKey: userKeys.all });
  };
}

const base = { invalidate: [userKeys.all], showErrorToast: false } as const;
const withRoles = { ...base, invalidate: [userKeys.all, roleOptionKeys.all] };
const T = TOAST_MESSAGES.user;

/**
 * Mutation mang mật khẩu: `variables` giữ mật khẩu người quản trị gõ, `data` giữ mật khẩu tạm BE sinh (hiện đúng
 * một lần). `gcTime: 0` bỏ chúng khỏi MutationCache ngay khi form / hộp thoại gỡ, không để ~5 phút mặc định.
 */
const SECRET_OPTIONS = { gcTime: 0 } as const;

export const useCreateUser = createMutation(createUser, {
  ...withRoles,
  successMessage: T.created,
  options: SECRET_OPTIONS,
});

const useUpdateUserBase = createMutation(updateUser, { ...base, successMessage: T.updated });
export function useUpdateUser() {
  return useUpdateUserBase({ onError: useStaleRefresh() });
}

const useAssignWarehousesBase = createMutation(
  ({ userId, warehouseIds }: { userId: string; warehouseIds: string[] }) =>
    assignWarehouses(userId, warehouseIds),
  { ...base, successMessage: T.warehousesSaved },
);
export function useAssignWarehouses() {
  return useAssignWarehousesBase({ onError: useStaleRefresh() });
}

const useChangeUserStatusBase = createMutation(changeUserStatus, base);
export function useChangeUserStatus() {
  return useChangeUserStatusBase({ onError: useStaleRefresh() });
}

const useResetPasswordBase = createMutation(resetPassword, {
  ...base,
  successMessage: T.passwordReset,
  options: SECRET_OPTIONS,
});
export function useResetPassword() {
  return useResetPasswordBase({ onError: useStaleRefresh() });
}

type RoleOfUser = { userId: string; roleCode: string };
const useAssignRoleBase = createMutation(
  ({ userId, roleCode }: RoleOfUser) => assignRole(userId, roleCode),
  { ...withRoles, successMessage: T.roleAssigned },
);
export function useAssignRole() {
  return useAssignRoleBase({ onError: useStaleRefresh() });
}

const useRevokeRoleBase = createMutation(
  ({ userId, roleCode }: RoleOfUser) => revokeRole(userId, roleCode),
  { ...withRoles, successMessage: T.roleRevoked },
);
export function useRevokeRole() {
  return useRevokeRoleBase({ onError: useStaleRefresh() });
}

/** Toast thành công theo hành động đổi trạng thái (màn gọi sau `mutateAsync`). */
export const STATUS_SUCCESS_MESSAGES = {
  lock: T.locked,
  unlock: T.unlocked,
  disable: T.disabled,
  enable: T.enabled,
} as const;
