"use client";

import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";

import { ADMIN_ROUTES } from "@/constants";
import { useUrlFilters } from "@/hooks/use-url-filters";

import { USER_LIMITS, USER_SORT_FIELDS, USER_STATUSES } from "../../constants";
import { useUsers } from "../../queries";
import { singleStatus } from "../../selectors";

import type { UserDto, UserSortField, UserStatus } from "../../types";

type SortDir = "asc" | "desc";

function isSortField(value: string): value is UserSortField {
  return (USER_SORT_FIELDS as readonly string[]).includes(value);
}

/** URL `sort=username,asc` → state cho `DataTable.serverSorting`. */
function parseSort(raw: string): { key: UserSortField | null; direction: SortDir } {
  const [key = "", dir] = raw.split(",");
  return { key: isSortField(key) ? key : null, direction: dir === "desc" ? "desc" : "asc" };
}

/**
 * State trang danh sách người dùng — tìm kiếm / trạng thái / vai trò / sắp xếp / trang nằm trên URL
 * (nuqs, state-persistence.md); lọc, sắp xếp và phân trang chạy ở server (BE `GET /identity/users`).
 */
export function useUserListState(canRead: boolean) {
  const router = useRouter();
  const filters = useUrlFilters(USER_STATUSES);
  const [role, setRoleState] = useQueryState("role", parseAsString.withDefault(""));
  const [size, setSize] = useState<number>(USER_LIMITS.defaultPageSize);
  const sort = parseSort(filters.sort);
  const status = singleStatus<UserStatus>(filters.status);

  const query = useUsers(
    {
      page: Math.max(0, filters.page - 1),
      size,
      q: filters.debouncedQ,
      status,
      role: role || undefined,
      sort: sort.key ? `${sort.key},${sort.direction}` : undefined,
    },
    { enabled: canRead },
  );

  const hasFilters = filters.q.trim() !== "" || status !== undefined || role !== "";
  const page = query.data;
  const emptyState = !page
    ? "none"
    : page.totalElements === 0
      ? hasFilters
        ? "no-results"
        : "no-users"
      : page.items.length === 0
        ? "invalid-page"
        : "none";

  return {
    canRead,
    query,
    filters,
    status,
    role,
    size,
    sort,
    hasFilters,
    emptyState,
    setStatus: (next: UserStatus | undefined) => void filters.setStatus(next ? [next] : []),
    setRole: (next: string) => {
      void setRoleState(next || null);
      void filters.setPage(1);
    },
    changeSort: (key: string, direction: SortDir) => {
      if (!isSortField(key)) return;
      void filters.setSort(`${key},${direction}`);
      void filters.setPage(1);
    },
    changePageSize: (next: number) => {
      setSize(next);
      void filters.setPage(1);
    },
    resetAll: () => {
      filters.reset();
      void setRoleState(null);
    },
    openDetail: (user: UserDto) => router.push(ADMIN_ROUTES.users.detail(user.userId)),
  };
}

export type UserListState = ReturnType<typeof useUserListState>;
