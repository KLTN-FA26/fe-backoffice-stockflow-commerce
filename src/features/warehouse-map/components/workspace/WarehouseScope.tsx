"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { useAppStore } from "@/lib/store/use-app-store";
import { WorkspaceWarehouseProvider } from "@/lib/workspace";

import { useWarehouseByPrefix } from "@/features/warehouse-map/workspace";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import { WarehouseNotFound } from "./WarehouseNotFound";

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
  const loading = (
    <div role="status" aria-label={W.choose} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((key) => (
        <div key={key} className="bg-bg-muted h-28 animate-pulse rounded-(--card-radius)" />
      ))}
    </div>
  );
  // Quyền đang tải: `canRead` tạm là false — khung chờ, không nháy "chưa được cấp quyền"
  if (workspace.permissionsPending) return loading;
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
  if (!workspace.warehouses) return loading;
  return null;
}

/**
 * Phạm vi một kho của tab "Kho" (layout `[prefix]`): đổi prefix trên URL ra kho rồi cấp kho cho trang con qua
 * `lib/workspace`; prefix không có trong danh mục (gõ sai, kho bị ẩn quyền) → báo và dẫn về Danh mục kho để chọn kho.
 * KHÔNG kiểm kho được gán — bản đồ không giới hạn theo kho được gán (06); màn vận hành do `AssignedOnly` chặn.
 */
export function WarehouseScope({ prefix, children }: { prefix: string; children: ReactNode }) {
  const workspace = useWarehouseByPrefix(prefix);
  const canonical = workspace.warehouse?.prefix;
  const pathname = usePathname();
  const router = useRouter();
  const setWorkspacePrefix = useAppStore((state) => state.setWorkspacePrefix);
  // Nhớ kho vừa vào (đã khớp danh mục) → panel sidebar giữ trang của kho này khi sang Danh mục kho / Sức chứa kho
  useEffect(() => {
    if (canonical) setWorkspacePrefix(canonical);
  }, [canonical, setWorkspacePrefix]);
  // Prefix gõ chữ thường (`/bd/…`) → URL về prefix chuẩn của danh mục: link trong tab, panel và breadcrumb cùng một
  // dạng, đổi qua lại không dựng lại layout (mất bản nháp bản đồ…)
  useEffect(() => {
    if (!canonical || canonical === prefix) return;
    const from = `${ADMIN_ROUTES.warehouseMap.root}/${encodeURIComponent(prefix)}`;
    if (pathname.startsWith(from))
      router.replace(ADMIN_ROUTES.warehouseMap.page(canonical) + pathname.slice(from.length));
  }, [canonical, prefix, pathname, router]);
  const status = <WarehouseListStatus workspace={workspace} />;
  // Kiểm quyền trước: danh sách kho có thể còn trong cache dù quyền đọc đã bị gỡ
  if (workspace.permissionsPending || !workspace.canRead || !workspace.warehouses) return status;
  if (!workspace.warehouse) {
    const from = `${ADMIN_ROUTES.warehouseMap.root}/${encodeURIComponent(prefix)}`;
    const subPath = pathname.startsWith(from) ? pathname.slice(from.length + 1) : "";
    return (
      <WarehouseNotFound
        prefix={prefix}
        warehouses={workspace.warehouses}
        subPath={subPath}
        onlyChoice={(target) => router.replace(target)}
      />
    );
  }
  const { id, name } = workspace.warehouse;
  return (
    <WorkspaceWarehouseProvider value={{ id, prefix: workspace.warehouse.prefix, name }}>
      {children}
    </WorkspaceWarehouseProvider>
  );
}
