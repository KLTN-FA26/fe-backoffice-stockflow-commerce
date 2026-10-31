"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import {
  ADMIN_ROUTES,
  UI_LABELS,
  WAREHOUSE_LOCATION_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useCan, usePermissionChecker } from "@/lib/auth";

import { warehouseMapActions } from "@/features/warehouse-map/lifecycle";

import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { WarehouseCreateDialog } from "./create/WarehouseCreateDialog";
import { buildWarehouseColumns } from "./list/columns";
import { useWarehouseListState } from "./list/useWarehouseListState";
import { WarehouseFilters } from "./list/WarehouseFilters";
import { WarehouseListBody } from "./list/WarehouseListBody";

const L = UI_LABELS.warehouseMap;

function WarehouseListContent() {
  const router = useRouter();
  const canRead = useCan(WAREHOUSE_PERMISSIONS.read);
  const canOpenMap = useCan(WAREHOUSE_LOCATION_PERMISSIONS.read);
  const actions = warehouseMapActions({ can: usePermissionChecker() });
  const s = useWarehouseListState(canRead);
  const [creating, setCreating] = useState(false);

  return (
    // Giao diện kiểu Vercel (`.surface-soft`): không title hiển thị — tên trang nằm ở breadcrumb topbar
    <div className="surface-soft">
      <h1 className="sr-only">{L.listTitle}</h1>
      {canRead && (
        <WarehouseFilters
          s={s}
          actions={
            actions.createWarehouse && (
              <Button
                size="sm"
                className={`${TOOLBAR_ACTION_CLASS} bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse`}
                onClick={() => setCreating(true)}
              >
                <Plus className="size-3.5" /> {L.create}
              </Button>
            )
          }
        />
      )}
      <WarehouseListBody
        s={s}
        columns={buildWarehouseColumns({ canOpenMap })}
        onRowClick={
          canOpenMap ? (row) => router.push(ADMIN_ROUTES.warehouseMap.of(row.prefix)) : undefined
        }
      />
      {creating && <WarehouseCreateDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

/**
 * Danh mục kho (docs 06 §4.1 bước 1): prefix, tên, địa chỉ, khung bản đồ, trạng thái. Xem cần
 * `warehouse-warehouses:VIEW_PAGE` + `:READ`; nút "Tạo kho" (mở modal khai báo kho) cần `:CREATE`; mở bản đồ cần
 * `warehouse-locations:READ` (UI-only — Backend phải re-check `@RequiresPermission`).
 */
export function WarehouseList() {
  return (
    <PermissionBoundary permissions={[WAREHOUSE_PERMISSIONS.viewPage]} variant="list">
      <WarehouseListContent />
    </PermissionBoundary>
  );
}
