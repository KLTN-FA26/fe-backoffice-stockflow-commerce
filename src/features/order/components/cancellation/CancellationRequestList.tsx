"use client";

import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";

import {
  ADMIN_ROUTES,
  CANCELLATION_REQUEST_LABELS,
  CANCELLATION_REQUEST_PERMISSIONS,
  ORDER_PERMISSIONS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { allowedCancellationRequestActions } from "../../cancellation-request-lifecycle";
import { matchesCancellationRequest } from "../../list-filters";
import { useCancellationRequests } from "../../queries";
import { FilteredEmpty } from "../FilteredEmpty";
import { OrderLoadError } from "../OrderLoadError";
import { OrderPermissionGate } from "../OrderPermissionGate";
import { OrderTableSkeleton } from "../OrderSkeletons";

import { CancellationRequestToolbar } from "./CancellationRequestToolbar";
import { buildCancellationRequestColumns, RequestRowActions } from "./columns";
import { queueColumns } from "./queue-columns";
import { useCancellationFilters } from "./useCancellationFilters";
import { PAGE_SIZE_OPTIONS, useQueuePrefs } from "./useQueuePrefs";

const L = CANCELLATION_REQUEST_LABELS;
/** Segment cuối của route — breadcrumb hiện tên trang thay vì "cancellation-requests". */
const ROUTE_SEGMENT = ADMIN_ROUTES.orders.cancellationRequests.split("/").at(-1);

/**
 * Hàng đợi yêu cầu huỷ đang chờ (`GET /orders/cancellation-requests?status=PENDING`, docs 17 §4.8 bước 28): Sale mở
 * từ đây để duyệt / từ chối. Đọc cần `sales-order-cancellations:READ`; nút quyết định cần `…:UPDATE`. Duyệt xong yêu cầu
 * rời hàng đợi — kết quả tiền xem ở chi tiết đơn.
 */
export function CancellationRequestList() {
  useBreadcrumbLabel(ROUTE_SEGMENT, L.title);
  return (
    <OrderPermissionGate permissions={[CANCELLATION_REQUEST_PERMISSIONS.read]} variant="list">
      <CancellationRequestListContent />
    </OrderPermissionGate>
  );
}

function CancellationRequestListContent() {
  const router = useRouter();
  const can = usePermissionChecker();
  // UI-only — Backend phải re-check (CancellationRequestController @RequiresPermission READ / UPDATE)
  const canOpenOrder = can(ORDER_PERMISSIONS.read);
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const { config, updateConfig, columnState } = useQueuePrefs();
  const filters = useCancellationFilters();
  const query = useCancellationRequests({
    status: filters.status,
    page: Math.max(0, page - 1),
    size: config.pageSize,
  });
  const columns = buildCancellationRequestColumns(
    (row) =>
      allowedCancellationRequestActions(row.status, can).length > 0 ? (
        <RequestRowActions row={row} />
      ) : null,
    canOpenOrder,
  );
  const visibleColumns = queueColumns(columns, columnState.visible, filters);
  const items = query.data?.items ?? [];
  // BE không có tham số tìm → ô tìm + lọc cột chỉ xét trang đang xem; gõ chữ không gọi lại API
  const rows = filters.rowFilterActive
    ? items.filter((row) => matchesCancellationRequest(row, filters.q, filters.columns.values))
    : items;

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{L.title}</h1>
      <CancellationRequestToolbar filters={filters} columns={columnState} />
      {query.isError ? (
        <OrderLoadError inline error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <OrderTableSkeleton />
      ) : query.data.totalElements === 0 && !filters.active ? (
        <EmptyState
          icon={<Ban className="size-8" />}
          title={L.empty.title}
          description={L.empty.description}
        />
      ) : (
        <>
          <RefetchBar active={query.isFetching} label="Đang tải lại danh sách" />
          <DataTable
            columns={visibleColumns}
            data={rows}
            emptyState={
              <FilteredEmpty
                description={filters.rowFilterActive ? L.list.noMatch : L.list.noMatchStatus}
                onClear={filters.clear}
              />
            }
            rowKey={(row) => row.requestId}
            stickyHeader
            // Mở dòng = tới thẻ yêu cầu huỷ trên chi tiết đơn (đủ bối cảnh: tiền, sản xuất, lịch sử) — BO-UX-34
            onRowClick={
              canOpenOrder
                ? (row) => router.push(ADMIN_ROUTES.orders.cancellationRequest(row.orderId))
                : undefined
            }
            flagRow={(row) => row.status === "PENDING"}
            caption={
              filters.rowFilterActive
                ? L.list.pageCaption(rows.length, items.length)
                : L.caption(items.length, query.data.totalElements)
            }
            pageSize={config.pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            serverPagination={{
              page: query.data.page,
              size: query.data.size,
              totalElements: query.data.totalElements,
              totalPages: query.data.totalPages,
              hasNext: query.data.hasNext,
              hasPrevious: query.data.hasPrevious,
              onPageChange: (p) => void setPage(p + 1),
              onPageSizeChange: (pageSize) => {
                updateConfig(() => ({ pageSize }));
                void setPage(1);
              },
            }}
          />
        </>
      )}
    </div>
  );
}
