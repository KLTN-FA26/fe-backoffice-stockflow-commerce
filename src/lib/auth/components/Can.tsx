/**
 * <Can> — declarative permission gate.
 *
 * Nhận hai loại quyền:
 *  - Mã quyền thật của BE `<resource>:<ACTION>` (vd "procurement-suppliers:CREATE") — đọc từ
 *    `GET /identity/me/permissions` (BE PR #39). Dùng cho module mới.
 *  - Quyền cũ `<module>.<action>` (vd "product.create") — bảng cứng theo vai trò trong
 *    `permissions.ts`. Giữ để không đổi hành vi module cũ; chuyển dần sang mã quyền thật.
 *
 * @example
 *   <Can permission="procurement-suppliers:CREATE">
 *     <Button>Thêm nhà cung cấp</Button>
 *   </Can>
 */

"use client";

import React from "react";

import { useAuthStore } from "../auth-store";
import { hasPermission, isPermissionCode, useMyPermissions } from "../me-permissions";
import { can } from "../permissions";

import type { PermissionCode } from "../me-permissions";
import type { Permission } from "../permissions";

interface CanProps {
  /** Mã quyền BE ("procurement-suppliers:CREATE") hoặc quyền cũ ("po.create"). */
  permission: Permission | PermissionCode;
  /** Fallback UI when permission is denied. Defaults to null (render nothing). */
  fallback?: React.ReactNode;
  /** Children to render when permission is granted. */
  children: React.ReactNode;
}

export function Can({ permission, fallback = null, children }: CanProps) {
  const allowed = useCan(permission);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Hook version — use when you need the boolean in logic, not just rendering.
 *
 * @example
 *   const canCreate = useCan("procurement-suppliers:CREATE");
 */
export function useCan(permission: Permission | PermissionCode): boolean {
  const effectiveRoles = useAuthStore((s) => s.effectiveRoles);
  const isCode = isPermissionCode(permission);
  // Chỉ gọi /me/permissions khi dùng mã quyền thật — quyền cũ không cần request
  const { data } = useMyPermissions(isCode);
  if (isCode) return hasPermission(data, permission);
  return effectiveRoles().some((role) => can(role, permission as Permission));
}

/** Trả hàm `(code) => boolean` để truyền vào logic thuần (vd `allowedSupplierActions`). */
export function usePermissionChecker(): (code: PermissionCode) => boolean {
  const { data } = useMyPermissions();
  return (code) => hasPermission(data, code);
}
