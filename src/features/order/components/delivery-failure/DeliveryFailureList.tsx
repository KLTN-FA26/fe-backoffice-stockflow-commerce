"use client";

import { PackageX } from "lucide-react";
import { useMemo } from "react";

import {
  ADMIN_ROUTES,
  DELIVERY_FAILURE_LABELS,
  DELIVERY_FAILURE_LIMITS,
  ORDER_PERMISSIONS,
  PAGE_SIZE,
  STORAGE_KEYS,
} from "@/constants";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useCan } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { isUndecidedCase, newestFirst } from "../../delivery-failure-lifecycle";
import { useDeliveryFailures } from "../../delivery-failure-queries";
import { matchesDeliveryFailure } from "../../list-filters";
import { FilteredEmpty } from "../FilteredEmpty";
import { OrderLoadError } from "../OrderLoadError";
import { OrderPermissionGate } from "../OrderPermissionGate";
import { OrderTableSkeleton } from "../OrderSkeletons";

import {
  buildDeliveryFailureColumns,
  DELIVERY_FAILURE_COLUMNS,
  DELIVERY_FAILURE_LOCKED,
} from "./columns";
import { failureReasonLabel } from "./DeliveryFailureStatus";
import {
  DeliveryFailureToolbar,
  deliveryFailureHeaderFilters,
  useDeliveryFailureFilters,
} from "./DeliveryFailureToolbar";

const L = DELIVERY_FAILURE_LABELS;
const ROUTE_SEGMENT = ADMIN_ROUTES.orders.deliveryFailures.split("/").at(-1);

/**
 * "Lô hàng hoàn về" (WF-05 BO-01; BE `GET /orders/delivery-failures`): lịch sử CHỈ ĐỌC các lô hãng mang về đã được kho
 * nhận lại, mọi trạng thái. Từ BE #377 không còn hồ sơ chờ Sale quyết (hàng đợi OPEN luôn rỗng) và không còn "Giao lại";
 * "Huỷ phần chưa giao" của đơn cũ ở chi tiết đơn. Đọc cần `sales-orders:READ`.
 */
export function DeliveryFailureList() {
  useBreadcrumbLabel(ROUTE_SEGMENT, L.title);
  return (
    <OrderPermissionGate permissions={[ORDER_PERMISSIONS.read]} variant="list">
      <DeliveryFailureListContent />
    </OrderPermissionGate>
  );
}

function DeliveryFailureListContent() {
  const canOpenOrder = useCan(ORDER_PERMISSIONS.read);
  const filters = useDeliveryFailureFilters();
  const query = useDeliveryFailures({ status: filters.status ?? undefined });
  const columnState = useColumnVisibility(
    STORAGE_KEYS.adminDeliveryFailuresColumns,
    DELIVERY_FAILURE_COLUMNS,
    { locked: DELIVERY_FAILURE_LOCKED },
  );
  // UI-only — Backend phải re-check (DeliveryFailureController @RequiresPermission sales-orders:READ)
  const columns = withHeaderFilters(
    buildDeliveryFailureColumns(canOpenOrder).filter((column) =>
      columnState.visible.some((key) => key === column.key),
    ),
    deliveryFailureHeaderFilters(filters),
  );
  const all = useMemo(() => (query.data ? newestFirst(query.data) : []), [query.data]);
  // Ô tìm + lọc cột chạy ở FE trên mọi hồ sơ đã tải (BE không có tham số tìm) — gõ chữ không gọi lại API
  const rows = filters.rowFilterActive
    ? all.filter((row) =>
        matchesDeliveryFailure(
          row,
          filters.q,
          failureReasonLabel(row.failureReason),
          filters.columns.values,
        ),
      )
    : all;
  // BE trả cũ nhất trước và cắt ở `limit`: chạm trần thì hồ sơ mới nhất có thể không có trong danh sách
  const truncated = all.length >= DELIVERY_FAILURE_LIMITS.listLimit;

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.title}</h1>
      <DeliveryFailureToolbar filters={filters} columns={columnState} />
      {query.isError ? (
        <OrderLoadError inline error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <OrderTableSkeleton />
      ) : all.length === 0 && !filters.active ? (
        <EmptyState
          icon={<PackageX className="size-8" />}
          title={L.emptyAll.title}
          description={L.emptyAll.description}
        />
      ) : (
        <>
          <RefetchBar active={query.isFetching} label="Đang tải lại danh sách" />
          {truncated && (
            <p role="status" className="text-warning-ink mb-2 text-xs">
              {L.truncated(DELIVERY_FAILURE_LIMITS.listLimit)}
            </p>
          )}
          <DataTable
            stickyHeader
            columns={columns}
            data={rows}
            rowKey={(row) => row.caseId}
            flagRow={isUndecidedCase}
            emptyState={<FilteredEmpty description={L.list.noMatch} onClear={filters.clear} />}
            caption={
              filters.rowFilterActive
                ? L.list.filteredCaption(rows.length, all.length)
                : L.caption(all.length)
            }
            pageSize={PAGE_SIZE.md}
          />
        </>
      )}
    </div>
  );
}
