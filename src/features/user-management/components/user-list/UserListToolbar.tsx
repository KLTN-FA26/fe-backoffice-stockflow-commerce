"use client";

import { FilterBar } from "@/components/shared/FilterBar";
import { SearchBar } from "@/components/shared/SearchBar";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { USER_STATUS_LABELS } from "@/constants";

import { USER_STATUSES, USER_UI } from "../../constants";

import type { RoleOption } from "@/lib/references/role-options";
import type { UserListState } from "./useUserListState";

const ALL = "ALL";
const STATUS_CHIPS = [
  { label: USER_UI.allStatuses, value: ALL },
  ...USER_STATUSES.map((status) => ({ label: USER_STATUS_LABELS[status], value: status })),
];

/** Tìm kiếm + lọc trạng thái (chip, chọn một) + lọc vai trò. Bộ lọc vai trò ẩn khi không đọc được danh mục vai trò. */
export function UserListToolbar({
  s,
  roles,
}: {
  s: UserListState;
  roles: readonly RoleOption[] | null;
}) {
  const { filters } = s;
  return (
    <FilterBar
      className="mb-4"
      chips={STATUS_CHIPS}
      active={s.status ?? ALL}
      onChange={(value) => s.setStatus(USER_STATUSES.find((status) => status === value))}
    >
      <SearchBar
        value={filters.q}
        onChange={(value) => void filters.setQ(value)}
        placeholder={USER_UI.searchPlaceholder}
        aria-label={USER_UI.searchPlaceholder}
      />
      {roles && (
        <Select
          value={s.role || ALL}
          onValueChange={(value) => s.setRole(value === ALL ? "" : value)}
        >
          <SelectTrigger aria-label={USER_UI.roleFilter} className={`${FORM_SELECT_CLASS} sm:w-56`}>
            <SelectValue />
          </SelectTrigger>
          <TitledSelectContent title="Vai trò">
            <SelectItem value={ALL}>{USER_UI.allRoles}</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.code} value={role.code}>
                {role.name}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
      )}
      {s.hasFilters && (
        <Button type="button" variant="ghost" size="sm" onClick={s.resetAll}>
          {USER_UI.clearFilters}
        </Button>
      )}
    </FilterBar>
  );
}
