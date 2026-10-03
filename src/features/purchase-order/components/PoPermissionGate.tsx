"use client";

import { hasPermission, useMyPermissions } from "@/lib/auth";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { PoLoadError } from "./PoLoadError";

import type { PermissionCode } from "@/lib/auth";

/**
 * Chặn route màn PO khi thiếu BẤT KỲ mã quyền nào trong `permissions` (theo mẫu
 * `SupplierPermissionGate`). Mọi trang PO cần `VIEW_PAGE`; trang tạo cần thêm `CREATE`.
 * `READ` không chặn route — trang tự hiện "không có quyền xem dữ liệu".
 * UI-only — Backend phải re-check (@RequiresPermission trên PurchaseOrderController).
 */
export function PoPermissionGate({
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
      return <PoLoadError error={null} kind="network" onRetry={() => void refetch()} />;
    }
    return <PageSkeleton variant={variant} />;
  }
  if (isError) {
    return <PoLoadError error={error} kind="permissions" onRetry={() => void refetch()} />;
  }
  if (!permissions.every((code) => hasPermission(data, code))) {
    return <PoLoadError error={null} kind="forbidden" />;
  }
  return <>{children}</>;
}
