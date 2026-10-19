"use client";

import { UI_LABELS } from "@/constants";
import { MOVE_LABELS } from "@/constants/move";

import { hasPermission, useMyPermissions } from "@/lib/auth";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import type { PermissionCode } from "@/lib/auth";

const { loadError } = UI_LABELS;

/**
 * Chặn màn di chuyển theo mã quyền BE (theo mẫu `InventoryPermissionGate`): đang tải → skeleton,
 * không tải được quyền → báo lỗi + thử lại, thiếu quyền → từ chối. Không suy từ tên vai trò.
 * UI-only — Backend phải re-check (@RequiresPermission inventory-stock-items:UPDATE).
 */
export function MovePermissionGate({
  permission,
  children,
}: {
  permission: PermissionCode;
  children: React.ReactNode;
}) {
  const { data, isPending, isError, fetchStatus, refetch } = useMyPermissions();
  if (isPending && fetchStatus !== "paused") return <PageSkeleton variant="form" />;
  if (isPending || isError) {
    const copy = isError
      ? { title: loadError.permissionsTitle, description: loadError.permissionsDescription }
      : { title: loadError.networkTitle, description: loadError.networkDescription };
    return (
      <EmptyState
        title={copy.title}
        description={copy.description}
        action={
          <Button
            className="rounded-[var(--r-sm)]"
            type="button"
            variant="outline"
            onClick={() => void refetch()}
          >
            {MOVE_LABELS.retry}
          </Button>
        }
      />
    );
  }
  if (!hasPermission(data, permission)) {
    return <EmptyState title={MOVE_LABELS.denied} description={MOVE_LABELS.deniedDescription} />;
  }
  return <>{children}</>;
}
