"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { canEnterWarehouse, useAssignedWarehouses } from "@/lib/auth";
import { useWorkspaceWarehouse } from "@/lib/workspace";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

const W = UI_LABELS.warehouseMap.workspace;

/**
 * Lớp `(operations)` của tab theo kho: màn vận hành (cất hàng, lấy hàng, kiểm kê…) và Gợi ý vị trí chỉ mở ở kho được
 * gán (docs 05/07/08/11/20 "chỉ trong phạm vi kho được gán"). Bản đồ nằm ngoài lớp này vì bản đồ và vị trí không giới
 * hạn theo kho được gán (06). Kho không được gán → không render màn con, nên không gọi API của màn.
 * UI-only — Backend phải re-check (BR-SEC-002 `WarehouseScope`).
 */
export function AssignedOnly({ children }: { children: ReactNode }) {
  const warehouse = useWorkspaceWarehouse();
  const assigned = useAssignedWarehouses();
  if (assigned.isLoading) return <PageSkeleton variant="list" />;
  if (!canEnterWarehouse(assigned, warehouse.prefix))
    return (
      <EmptyState
        title={W.notAssignedTitle}
        description={W.notAssignedDescription}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link href={ADMIN_ROUTES.warehouseMap.of(warehouse.prefix)}>{W.openMap}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={ADMIN_ROUTES.warehouseMap.root}>{W.backToChooser}</Link>
            </Button>
          </div>
        }
      />
    );
  return children;
}
