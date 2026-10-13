"use client";

import { hasPermission, useMyPermissions } from "@/lib/auth";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { ReceiptLoadError } from "./ReceiptLoadError";

import type { PermissionCode } from "@/lib/auth";

/**
 * Chặn route màn phiếu nhận khi thiếu BẤT KỲ mã quyền nào trong `permissions` (mẫu
 * `SupplierPermissionGate`). Mọi trang cần `procurement-goods-receipts:VIEW_PAGE`; `READ` không
 * chặn route — trang tự hiện "không có quyền xem dữ liệu".
 * UI-only — Backend phải re-check (@RequiresPermission trên GoodsReceiptController, PR #62).
 */
export function ReceiptPermissionGate({
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
      return <ReceiptLoadError error={null} kind="network" onRetry={() => void refetch()} />;
    }
    return <PageSkeleton variant={variant} />;
  }
  if (isError) {
    return <ReceiptLoadError error={error} kind="permissions" onRetry={() => void refetch()} />;
  }
  if (!permissions.every((code) => hasPermission(data, code))) {
    return <ReceiptLoadError error={null} kind="forbidden" />;
  }
  return <>{children}</>;
}
