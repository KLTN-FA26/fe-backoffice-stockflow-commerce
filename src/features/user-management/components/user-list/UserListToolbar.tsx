"use client";

import { ListToolbar } from "@/components/shared/ListToolbar";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UI_LABELS, USER_STATUSES } from "@/constants";
import { roleLabel } from "@/lib/references/role-options";
import { statusLabelVi } from "@/lib/status-map";

import { USER_UI } from "../../constants";

import type { ReactNode } from "react";
import type { RoleOption } from "@/lib/references/role-options";
import type { UserStatus } from "../../types";
import type { UserListState } from "./useUserListState";

const ALL = "ALL";
const STATUS_OPTIONS = USER_STATUSES.map((value) => ({
  value,
  label: statusLabelVi(value) ?? value,
}));

/**
 * Toolbar data-table Mode A: tìm kiếm, lọc trạng thái (BE nhận MỘT trạng thái nên là chọn một), lọc vai trò
 * (hàng facet; ẩn khi không đọc được danh mục vai trò) và thanh cấu hình. `actions` = nút tạo mới.
 */
export function UserListToolbar({
  s,
  roles,
  actions,
}: {
  s: UserListState;
  roles: readonly RoleOption[] | null;
  actions?: ReactNode;
}) {
  const { filters, status } = s;
  const statusText = status ? (statusLabelVi(status) ?? status) : USER_UI.allStatuses;
  return (
    <ListToolbar<UserStatus, string, string>
      search={filters.q}
      onSearchChange={(value) => void filters.setQ(value)}
      searchPlaceholder={USER_UI.searchPlaceholder}
      statusOptions={STATUS_OPTIONS}
      selectedStatuses={status ? [status] : []}
      onToggleStatus={(value) => s.setStatus(status === value ? undefined : value)}
      onClearStatuses={() => s.setStatus(undefined)}
      hasStatusFilter={status !== undefined}
      facets={
        roles && (
          <Select
            value={s.role || ALL}
            onValueChange={(value) => s.setRole(value === ALL ? "" : value)}
          >
            <SelectTrigger
              aria-label={USER_UI.roleFilter}
              className={`${FORM_SELECT_CLASS} sm:w-64`}
            >
              <SelectValue />
            </SelectTrigger>
            <TitledSelectContent title={USER_UI.rolesLabel}>
              <SelectItem value={ALL}>{USER_UI.allRoles}</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.code} value={role.code}>
                  {role.name}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </Select>
        )
      }
      summaryItems={[
        {
          label: USER_UI.summarySearch,
          value: filters.q || UI_LABELS.common.notEntered,
          active: filters.q !== "",
          onClear: () => void filters.setQ(""),
        },
        {
          label: USER_UI.statusLabel,
          value: statusText,
          active: status !== undefined,
          onClear: () => s.setStatus(undefined),
        },
        {
          label: USER_UI.rolesLabel,
          value: s.role ? roleLabel(roles ?? undefined, s.role) : USER_UI.allRoles,
          active: s.role !== "",
          onClear: () => s.setRole(""),
        },
      ]}
      actions={actions}
      onResetAll={s.resetAll}
      resetDisabled={!s.hasFilters}
    />
  );
}
