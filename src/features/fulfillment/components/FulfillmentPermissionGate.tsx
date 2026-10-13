"use client";

import { hasPermission, useMyPermissions } from "@/lib/auth";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { FulfillmentLoadError } from "./FulfillmentLoadError";

import type { PermissionCode } from "@/lib/auth";
import type { FulfillmentScope } from "./primitives";

/**
 * Chặn route màn xuất kho khi thiếu BẤT KỲ mã quyền nào trong `permissions` (mẫu
 * `ReceiptPermissionGate`). Lấy hàng cần `fulfillment-pick-lists:VIEW_PAGE`, đóng gói cần
 * `fulfillment-packages:VIEW_PAGE`; `READ` không chặn route — trang tự hiện "không có quyền xem".
 * UI-only — Backend phải re-check (@RequiresPermission + @PreAuthorize trên FulfillmentController).
 */
export function FulfillmentPermissionGate({
  scope,
  permissions,
  variant = "detail",
  children,
}: {
  scope: FulfillmentScope;
  permissions: readonly PermissionCode[];
  variant?: "detail" | "list";
  children: React.ReactNode;
}) {
  const { data, isPending, isError, error, fetchStatus, refetch } = useMyPermissions();
  if (isPending) {
    if (fetchStatus === "paused") {
      return (
        <FulfillmentLoadError
          scope={scope}
          error={null}
          kind="network"
          onRetry={() => void refetch()}
        />
      );
    }
    return <PageSkeleton variant={variant} />;
  }
  if (isError) {
    return (
      <FulfillmentLoadError
        scope={scope}
        error={error}
        kind="permissions"
        onRetry={() => void refetch()}
      />
    );
  }
  if (!permissions.every((code) => hasPermission(data, code))) {
    return <FulfillmentLoadError scope={scope} error={null} kind="forbidden" />;
  }
  return <>{children}</>;
}
