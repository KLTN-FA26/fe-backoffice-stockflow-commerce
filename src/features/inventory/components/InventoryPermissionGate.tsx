"use client";

import { UI_LABELS } from "@/constants";
import { INVENTORY_LABELS } from "@/constants/inventory";

import { hasPermission, useMyPermissions } from "@/lib/auth";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { InventoryDenied } from "./InventoryFeedback";

import type { PermissionCode } from "@/lib/auth";

const { loadError } = UI_LABELS;

/**
 * Chặn màn tồn kho theo mã quyền BE (theo mẫu `PoPermissionGate`): đang tải → skeleton,
 * không tải được quyền → báo lỗi + thử lại, thiếu quyền → từ chối. Không suy từ tên vai trò.
 * UI-only — Backend phải re-check (@RequiresPermission trên StockOperationsController).
 */
export function InventoryPermissionGate({
  permission,
  variant = "detail",
  children,
}: {
  /** One code, or a list of which any one opens the screen. */
  permission: PermissionCode | readonly PermissionCode[];
  variant?: "detail" | "list" | "form";
  children: React.ReactNode;
}) {
  const { data, isPending, isError, fetchStatus, refetch } = useMyPermissions();
  if (isPending && fetchStatus !== "paused") return <PageSkeleton variant={variant} />;
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
            {INVENTORY_LABELS.retry}
          </Button>
        }
      />
    );
  }
  const anyOf: readonly PermissionCode[] =
    typeof permission === "string" ? [permission] : permission;
  if (!anyOf.some((code) => hasPermission(data, code))) return <InventoryDenied />;
  return <>{children}</>;
}
