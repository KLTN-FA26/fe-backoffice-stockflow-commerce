"use client";

import { hasPermission, useMyPermissions } from "@/lib/auth";

import { OrderLoadError } from "./OrderLoadError";
import { OrderDetailSkeleton, OrderListPageSkeleton } from "./OrderSkeletons";

import type { PermissionCode } from "@/lib/auth";

interface OrderPermissionGateProps {
  permissions: readonly PermissionCode[];
  variant?: "detail" | "list";
  children: React.ReactNode;
}

/**
 * Chặn route trang đơn hàng khi thiếu BẤT KỲ mã quyền nào trong `permissions` (thường là
 * `sales-orders:VIEW_PAGE` — BE Action.VIEW_PAGE, ADR-0004), cùng cách `SupplierPermissionGate`.
 * Chặn ở đây thì trang không gọi API rồi mới nhận 403. Đang tải quyền → skeleton (không nháy
 * màn "không có quyền"). UI-only — Backend phải re-check (@RequiresPermission).
 */
export function OrderPermissionGate({
  permissions,
  variant = "detail",
  children,
}: OrderPermissionGateProps) {
  const { data, isPending, isError, error, fetchStatus, refetch } = useMyPermissions();

  if (isPending) {
    // Offline → query quyền bị pause: báo mất kết nối thay vì skeleton vô hạn
    if (fetchStatus === "paused") {
      return <OrderLoadError error={null} kind="network" onRetry={() => void refetch()} />;
    }
    return variant === "list" ? <OrderListPageSkeleton /> : <OrderDetailSkeleton />;
  }
  if (isError) {
    // Lỗi tải quyền (vd BE chưa có endpoint) KHÔNG phải "không tìm thấy đơn"
    return <OrderLoadError error={error} kind="permissions" onRetry={() => void refetch()} />;
  }
  if (!permissions.every((code) => hasPermission(data, code))) {
    return <OrderLoadError error={null} kind="forbidden" />;
  }
  return <>{children}</>;
}
