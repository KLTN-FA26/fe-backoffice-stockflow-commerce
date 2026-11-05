"use client";

import { useMyPermissions, hasPermission } from "@/lib/auth";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { SupplierLoadError } from "./SupplierLoadError";

import type { PermissionCode } from "@/lib/auth";

/**
 * Chặn route trang NCC khi thiếu BẤT KỲ mã quyền nào trong `permissions`.
 * Mọi trang NCC cần `VIEW_PAGE` ("Open the screen at all: … the route guard" — BE Action.java,
 * ADR-0004); trang tạo/sửa cần thêm quyền thao tác. `READ` (đọc dữ liệu) KHÔNG chặn route — trang
 * tự kiểm và hiện "không có quyền xem dữ liệu".
 * Đang tải quyền → skeleton, để không nháy màn "không có quyền".
 * UI-only — Backend phải re-check (BE @RequiresPermission, PR #36).
 */
export function SupplierPermissionGate({
  permissions,
  variant = "detail",
  children,
}: {
  permissions: readonly PermissionCode[];
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
  if (isError) {
    // Lỗi tải quyền (vd BE chưa có endpoint → 404) KHÔNG phải "không tìm thấy NCC"
    return <SupplierLoadError error={error} kind="permissions" onRetry={() => void refetch()} />;
  }
  if (!permissions.every((code) => hasPermission(data, code))) {
    return <SupplierLoadError error={null} kind="forbidden" />;
  }
  return <>{children}</>;
}
