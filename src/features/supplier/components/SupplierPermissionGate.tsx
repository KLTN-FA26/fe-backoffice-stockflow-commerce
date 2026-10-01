"use client";

import { useMyPermissions, hasPermission } from "@/lib/auth";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { SupplierLoadError } from "./SupplierLoadError";

import type { PermissionCode } from "@/lib/auth";

/**
 * Chặn cả trang khi thiếu mã quyền (vd mở thẳng URL tạo/sửa NCC).
 * Đang tải quyền → skeleton, để không nháy màn "không có quyền".
 * UI-only — Backend phải re-check (BE @RequiresPermission, PR #36).
 */
export function SupplierPermissionGate({
  permission,
  variant = "detail",
  children,
}: {
  permission: PermissionCode;
  variant?: "detail" | "list";
  children: React.ReactNode;
}) {
  const { data, isPending, isError, error, fetchStatus, refetch } = useMyPermissions();
  if (isPending) {
    // Offline → query quyền bị pause: báo mất kết nối thay vì skeleton vô hạn
    if (fetchStatus === "paused") {
      return <SupplierLoadError error={null} kind="network" onRetry={() => void refetch()} />;
    }
    return <PageSkeleton variant={variant} />;
  }
  if (isError) return <SupplierLoadError error={error} onRetry={() => void refetch()} />;
  if (!hasPermission(data, permission)) return <SupplierLoadError error={null} kind="forbidden" />;
  return <>{children}</>;
}
