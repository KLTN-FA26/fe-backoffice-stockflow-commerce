/**
 * Quyền của người đang đăng nhập — đọc từ BE `GET /identity/me/permissions` (BE PR #39).
 *
 * Mã quyền dạng `<resource>:<ACTION>` (vd `procurement-suppliers:CREATE`). Admin tick quyền trên
 * màn Phân quyền là có hiệu lực ngay, nên FE không gắn cứng theo tên vai trò.
 * Đây là server state → React Query, không lưu zustand/localStorage. Tải lại khi gặp 403
 * (xem `query-client.ts`).
 *
 * UI-only: ẩn/hiện nút. Backend luôn re-check từng request.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";

import { useAuthStore } from "./auth-store";

export const PERMISSION_ACTIONS = [
  "VIEW_PAGE",
  "READ",
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "EXPORT",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
export type PermissionCode = `${string}:${PermissionAction}`;

const MY_PERMISSIONS_PATH = "/identity/me/permissions";
const MY_PERMISSIONS_STALE_MS = 5 * 60_000;

export const myPermissionsSchema = z.object({
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  dataScope: z.string().nullish(),
});

export type MyPermissions = z.infer<typeof myPermissionsSchema>;

export const meKeys = {
  all: ["identity", "me"] as const,
  permissions: () => [...meKeys.all, "permissions"] as const,
};

export function isPermissionCode(value: string): value is PermissionCode {
  const action = value.split(":")[1];
  return (PERMISSION_ACTIONS as readonly string[]).includes(action ?? "");
}

export async function fetchMyPermissions(signal?: AbortSignal): Promise<MyPermissions> {
  const { data } = await api.get<unknown>(MY_PERMISSIONS_PATH, { signal });
  return myPermissionsSchema.parse(data);
}

/** Đang tải / lỗi / parse sai → coi như không có quyền (ẩn nút, không nháy nút rồi mất). */
export function hasPermission(perms: MyPermissions | undefined, code: PermissionCode): boolean {
  return perms?.permissions.includes(code) ?? false;
}

export function useMyPermissions(enabled = true) {
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  // Đổi vai trò giả lập (RoleSwitcher, chỉ demo) → key đổi → tải lại quyền
  const impersonatedRole = useAuthStore((s) => s.impersonatedRole);
  return useQuery({
    queryKey: [...meKeys.permissions(), userId, impersonatedRole],
    queryFn: ({ signal }) => fetchMyPermissions(signal),
    enabled: enabled && userId !== null,
    staleTime: MY_PERMISSIONS_STALE_MS,
  });
}
