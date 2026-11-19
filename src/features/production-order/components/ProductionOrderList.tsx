"use client";

import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";

import {
  ADMIN_ROUTES,
  PRODUCER_PERMISSIONS,
  PRODUCTION_LABELS,
  PRODUCTION_ORDER_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useProducerDirectory } from "@/lib/references/producer-options";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";

import { buildProductionOrderColumns } from "./list/columns";
import { ProductionOrderToolbar } from "./list/ProductionOrderToolbar";
import { useProductionOrderListState } from "./list/useProductionOrderListState";

const L = PRODUCTION_LABELS.order;

function ProductionOrderListContent() {
  const router = useRouter();
  const can = usePermissionChecker();
  const canRead = can(PRODUCTION_ORDER_PERMISSIONS.read);
  const s = useProductionOrderListState(canRead);
  const producers = useProducerDirectory(can(PRODUCER_PERMISSIONS.read));
  // Điều phối sản xuất không đọc được danh mục kho (BE) → bỏ ô lọc kho, cột kho dùng mã từ bảng sức chứa
  const warehouses = useWarehouseDirectory(can(WAREHOUSE_PERMISSIONS.read));
  const producerOptions = (producers.query.data ?? []).map((p) => ({
    value: p.id,
    label: `${p.code} · ${p.name}`,
  }));
  const warehouseOptions = (warehouses.data ?? []).map((w) => ({
    value: w.warehouseId,
    label: `${w.code} · ${w.name}`,
  }));

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.pageTitle}</h1>
      {canRead && (
        <ProductionOrderToolbar
          s={s}
          producerOptions={producerOptions}
          warehouseOptions={warehouseOptions}
          canCreate={can(PRODUCTION_ORDER_PERMISSIONS.create)}
        />
      )}
      <ServerTableBody
        query={s.query}
        canRead={canRead}
        columns={buildProductionOrderColumns(producers.byId)}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(ADMIN_ROUTES.productionOrders.detail(row.id))}
        noun={L.noun}
        errorCopy={L.errorCopy}
        hasFilters={s.hasFilters}
        onClearFilters={s.clearFilters}
        empty={{
          icon: <ClipboardList className="size-8" />,
          title: L.emptyTitle,
          description: L.emptyDescription,
        }}
        pageSize={s.pageSize}
        onPageChange={s.setPage}
        onPageSizeChange={s.changePageSize}
        stickyHeader
      />
    </div>
  );
}

/**
 * Danh sách Đơn sản xuất (docs 17 §4.3): mới nhất trước, lọc trạng thái / đơn vị / kho nhận. Lập mới đi từ đợt giao còn
 * thiếu (BR-05). Xem cần `production-orders:READ` (Quản lý kho chỉ thấy kho mình — BE lọc). UI-only — Backend re-check.
 */
export function ProductionOrderList() {
  return (
    <PermissionBoundary permissions={[PRODUCTION_ORDER_PERMISSIONS.viewPage]} variant="list">
      <ProductionOrderListContent />
    </PermissionBoundary>
  );
}
