"use client";

import { hasPermission, useMyPermissions } from "@/lib/auth";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { TransferLoadError } from "./TransferLoadError";

import type { PermissionCode } from "@/lib/auth";

/**
 * Chặn route màn chuyển kho khi thiếu BẤT KỲ mã quyền nào trong `permissions` (mẫu
 * `ReceiptPermissionGate`). `READ` không chặn route — trang tự hiện "không có quyền xem dữ liệu".
 * UI-only — Backend phải re-check (@RequiresPermission trên TransferOrderController).
 */
export function TransferPermissionGate({
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
      return <TransferLoadError error={null} kind="network" onRetry={() => void refetch()} />;
    }
    return <PageSkeleton variant={variant} />;
  }
  // Tải lại quyền nền thất bại nhưng đã có quyền cũ → giữ màn (form đang nhập, dialog đang mở)
  if (isError && !data) {
    return <TransferLoadError error={error} kind="permissions" onRetry={() => void refetch()} />;
  }
  if (!permissions.every((code) => hasPermission(data, code))) {
    return <TransferLoadError error={null} kind="forbidden" />;
  }
  return <>{children}</>;
}
