"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { useAssignedWarehouses } from "@/lib/auth";
import { prefixOfLocation, WorkspaceRedirect } from "@/lib/workspace";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

const L = UI_LABELS.fulfillment;

/**
 * Link cũ của một task xuất kho → route trong tab theo kho (spec 2026-11-22 §5.5). Kho = `warehouseId` của task / phiên.
 * BE không trả kho (`warehouseId` null) thì: prefix khu chờ xuất của task (06 BR-10: mã vị trí bắt đầu bằng prefix kho)
 * → kho được gán duy nhất của người dùng (màn chi tiết vẫn hiện task không có kho — `InWorkspaceWarehouse`) → báo rõ
 * kèm link chọn kho, không đẩy thẳng về bước chọn kho mà không giải thích.
 */
export function TaskWorkspaceRedirect({
  warehouseId,
  locationCode,
  path,
}: {
  warehouseId: string | null | undefined;
  /** Mã vị trí thuộc kho của task (khu chờ xuất) — dùng khi thiếu `warehouseId`. */
  locationCode?: string | null;
  /** Đường dẫn của task trong tab (`WORKSPACE_PATHS.*`). */
  path: string;
}) {
  const assigned = useAssignedWarehouses();
  if (warehouseId) return <WorkspaceRedirect warehouseId={warehouseId} path={path} />;
  if (locationCode?.trim())
    return <WorkspaceRedirect prefix={prefixOfLocation(locationCode)} path={path} />;
  if (assigned.isLoading) return <PageSkeleton variant="detail" />;
  const sole =
    assigned.scope === "restricted" && assigned.warehouses.length === 1
      ? assigned.warehouses[0]?.prefix
      : undefined;
  if (sole) return <WorkspaceRedirect prefix={sole} path={path} />;
  return (
    <EmptyState
      title={L.noWarehouseTitle}
      description={L.noWarehouseDescription}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.warehouseMap.root}>
            {UI_LABELS.warehouseMap.workspace.backToChooser}
          </Link>
        </Button>
      }
    />
  );
}
