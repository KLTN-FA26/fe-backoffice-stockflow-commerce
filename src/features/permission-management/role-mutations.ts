/**
 * Vai trò tuỳ chỉnh — mutations (BE PR #72, SCRUM-455). Lỗi không toast chung: hộp thoại hiện lỗi
 * bằng `identityErrorMessage`. Sau khi đổi vai trò, danh mục dùng chung (`roleOptionKeys`) tải lại để
 * màn Người dùng thấy ngay vai trò mới / đổi tên / đã xoá.
 */

import { useQueryClient } from "@tanstack/react-query";

import { TOAST_MESSAGES } from "@/constants";
import { isStaleError } from "@/lib/api/identity-errors";
import { createMutation } from "@/lib/api/query-factory";
import { meKeys } from "@/lib/auth/me-permissions";
import { roleOptionKeys } from "@/lib/references/role-options";

import { createRole, deleteRole, updateRole } from "./api";
import { permissionManagementKeys } from "./queries";

const base = {
  invalidate: [permissionManagementKeys.roles(), roleOptionKeys.all],
  showErrorToast: false,
} as const;

export const useCreateRole = createMutation(createRole, {
  ...base,
  successMessage: TOAST_MESSAGES.role.created,
});

const useUpdateRoleBase = createMutation(updateRole, {
  ...base,
  // Tên hiển thị của ma trận (`roleLabel`) và quyền của chính người gọi có thể đổi theo
  invalidate: [...base.invalidate, permissionManagementKeys.all, meKeys.permissions()],
  successMessage: TOAST_MESSAGES.role.updated,
});

/** OPTIMISTIC_LOCK / ROLE_NOT_FOUND: the role list is stale — reload it so the next attempt uses the current version. */
export function useUpdateRole() {
  const client = useQueryClient();
  return useUpdateRoleBase({
    onError: (error) => {
      if (isStaleError(error) || error.code === "ROLE_NOT_FOUND")
        void client.invalidateQueries({ queryKey: permissionManagementKeys.all });
    },
  });
}

export const useDeleteRole = createMutation(deleteRole, {
  ...base,
  invalidate: [...base.invalidate, permissionManagementKeys.all],
  successMessage: TOAST_MESSAGES.role.deleted,
});
