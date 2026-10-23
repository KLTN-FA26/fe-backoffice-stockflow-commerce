/**
 * Danh mục vai trò cho module khác (ô gán vai trò, lọc người dùng theo vai trò — SCRUM-458).
 *
 * Đặt ở `lib/` để feature người dùng dùng mà không import feature phân quyền (feature-architecture).
 * BE `GET /identity/roles` cần `identity-roles:READ`; thiếu quyền này thì tắt query và UI chỉ hiện mã vai trò.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

const roleOptionSchema = z.object({
  code: z.string().min(1),
  name: z.string(),
  description: z.string().nullish(),
  // BE `RoleResponse.system`: vai trò hệ thống không đổi tên / xoá được
  system: z.boolean().default(false),
  holderCount: z.number().int().nonnegative().default(0),
  dataScope: z.string().nullish(),
});

export type RoleOption = z.infer<typeof roleOptionSchema>;

export const roleOptionKeys = {
  all: ["references", "roles"] as const,
  list: () => [...roleOptionKeys.all, "list"] as const,
};

export async function fetchRoleOptions(signal?: AbortSignal): Promise<RoleOption[]> {
  const { data } = await api.get<unknown>("/identity/roles", { signal });
  return roleOptionSchema.array().parse(data);
}

export function useRoleOptions(enabled = true) {
  return useQuery({
    queryKey: roleOptionKeys.list(),
    queryFn: ({ signal }) => fetchRoleOptions(signal),
    enabled,
    ...QUERY_TIMES.master,
  });
}

/** Tên hiển thị của vai trò theo mã; không có trong danh mục thì giữ nguyên mã. */
export function roleLabel(roles: readonly RoleOption[] | undefined, code: string): string {
  return roles?.find((role) => role.code === code)?.name ?? code;
}
