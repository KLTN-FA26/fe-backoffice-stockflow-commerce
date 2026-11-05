"use client";

import { hasPermission, useMyPermissions } from "@/lib/auth";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { ShippingLoadError } from "./ShippingLoadError";

import type { PermissionCode } from "@/lib/auth";

/**
 * Chặn route màn xếp xe & bàn giao khi thiếu BẤT KỲ mã quyền nào trong `permissions` (mẫu
 * `ReceiptPermissionGate`). `READ` không chặn route — trang tự hiện "không có quyền xem dữ liệu".
 * UI-only — Backend phải re-check (endpoint chuyến xe SCRUM-288, resource fulfillment-shipments).
 */
export function ShippingPermissionGate({
  permissions,
  variant = "detail",
  children,
}: {
  permissions: readonly PermissionCode[];
  variant?: "detail" | "list" | "form";
  children: React.ReactNode;
}) {
  const { data, isPending, isError, error, fetchStatus, refetch } = useMyPermissions();
  if (isPending) {
    if (fetchStatus === "paused") {
      return <ShippingLoadError error={null} kind="network" onRetry={() => void refetch()} />;
    }
    return <PageSkeleton variant={variant} />;
  }
  // Tải lại quyền nền thất bại nhưng đã có quyền cũ → giữ màn (form đang nhập, dialog đang mở)
  if (isError && !data) {
    return <ShippingLoadError error={error} kind="permissions" onRetry={() => void refetch()} />;
  }
  if (!permissions.every((code) => hasPermission(data, code))) {
    return <ShippingLoadError error={null} kind="forbidden" />;
  }
  return <>{children}</>;
}
