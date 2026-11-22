"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { WorkspaceWarehouseProvider } from "@/lib/workspace";

import { useWarehouseByPrefix } from "@/features/warehouse-map/workspace";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";
import type { useWorkspaceWarehouses } from "@/features/warehouse-map/workspace";

const W = UI_LABELS.warehouseMap.workspace;

/**
 * Trạng thái khi chưa có danh mục kho để dùng: thiếu quyền đọc, lỗi tải (kèm Thử lại), đang tải
 * (khung thẻ đúng hình) — `null` khi đã có danh sách.
 */
export function WarehouseListStatus({
  workspace,
}: {
  workspace: ReturnType<typeof useWorkspaceWarehouses>;
}) {
  if (!workspace.canRead)
    return (
      <EmptyState
        title={UI_LABELS.warehouseMap.noReadTitle}
        description={UI_LABELS.warehouseMap.noReadDescription}
      />
    );
  if (workspace.list.isError && !workspace.warehouses)
    return (
      <EmptyState
        title={W.loadFailed}
        action={
          <Button size="sm" variant="outline" onClick={() => void workspace.list.refetch()}>
            {W.retry}
          </Button>
        }
      />
    );
  if (!workspace.warehouses)
    return (
      <div role="status" aria-label={W.choose} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className="bg-bg-muted h-28 animate-pulse rounded-(--card-radius)" />
        ))}
      </div>
    );
  return null;
}

/**
 * Phạm vi một kho của tab "Kho & bản đồ" (layout `[prefix]`): đổi prefix trên URL ra kho rồi cấp kho cho trang con qua
 * `lib/workspace`; prefix không có trong danh mục (gõ sai, kho bị ẩn quyền) → báo và dẫn về Danh mục kho để chọn kho.
 * KHÔNG kiểm kho được gán — bản đồ không giới hạn theo kho được gán (06); màn vận hành do `AssignedOnly` chặn.
 */
export function WarehouseScope({ prefix, children }: { prefix: string; children: ReactNode }) {
  const workspace = useWarehouseByPrefix(prefix);
  const status = <WarehouseListStatus workspace={workspace} />;
  // Kiểm quyền trước: danh sách kho có thể còn trong cache dù quyền đọc đã bị gỡ
  if (!workspace.canRead || !workspace.warehouses) return status;
  if (!workspace.warehouse)
    return (
      <EmptyState
        title={W.notFoundTitle(prefix.toUpperCase())}
        description={W.notFoundDescription}
        action={
          <Button asChild size="sm">
            <Link href={ADMIN_ROUTES.warehouses.list}>{W.backToChooser}</Link>
          </Button>
        }
      />
    );
  const { id, name } = workspace.warehouse;
  return (
    <WorkspaceWarehouseProvider value={{ id, prefix: workspace.warehouse.prefix, name }}>
      {children}
    </WorkspaceWarehouseProvider>
  );
}
