"use client";

import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";

import {
  ADMIN_ROUTES,
  CANCELLATION_REQUEST_LABELS,
  CANCELLATION_REQUEST_PERMISSIONS,
  ORDER_PERMISSIONS,
  PAGE_SIZE,
  STORAGE_KEYS,
} from "@/constants";
import {
  columnSummaryItem,
  columnToolbarProps,
  useColumnVisibility,
} from "@/hooks/use-column-visibility";
import { usePageConfig } from "@/hooks/use-page-config";
import { usePermissionChecker } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { allowedCancellationRequestActions } from "../../cancellation-request-lifecycle";
import { useCancellationRequests } from "../../queries";
import { OrderLoadError } from "../OrderLoadError";
import { OrderPermissionGate } from "../OrderPermissionGate";
import { OrderTableSkeleton } from "../OrderSkeletons";

import {
  buildCancellationRequestColumns,
  CANCELLATION_QUEUE_COLUMNS,
  CANCELLATION_QUEUE_LABELS,
  CANCELLATION_QUEUE_LOCKED,
  RequestRowActions,
} from "./columns";

const L = CANCELLATION_REQUEST_LABELS;
const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];
interface RequestPageConfig {
  pageSize: number;
}
const DEFAULT_CONFIG: RequestPageConfig = { pageSize: PAGE_SIZE.md };

/** Bỏ page size lạ trong localStorage cũ. */
function mergeConfig(
  stored: Partial<RequestPageConfig>,
  fallback: RequestPageConfig,
): RequestPageConfig {
  return stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
    ? { pageSize: stored.pageSize }
    : fallback;
}

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
  const { config, updateConfig } = usePageConfig<RequestPageConfig>(
    STORAGE_KEYS.adminCancellationRequestsConfig,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  const query = useCancellationRequests({
    status: "PENDING",
    page: Math.max(0, page - 1),
    size: config.pageSize,
  });
  const columns = buildCancellationRequestColumns(
    (row) =>
      allowedCancellationRequestActions(row.status, can).length > 0 ? (
        <RequestRowActions row={row} canOpenOrder={canOpenOrder} />
      ) : null,
    canOpenOrder,
  );
  const columnState = useColumnVisibility(
    STORAGE_KEYS.adminCancellationRequestsColumns,
    CANCELLATION_QUEUE_COLUMNS,
    { locked: CANCELLATION_QUEUE_LOCKED },
  );
  const visibleColumns = columns.filter((column) =>
    columnState.visible.some((key) => key === column.key),
  );

  return (
    <div className="surface-soft">
      {/* Trang danh sách kiểu Vercel (data-table-mode-a §1): không tiêu đề / nút quay lại — breadcrumb là tên trang. */}
      <h1 className="sr-only">{L.title}</h1>
      {/* BE chỉ lọc theo trạng thái / đơn (hàng đợi luôn PENDING): không có search — toolbar còn Ẩn hiện cột. */}
      <ListToolbar
        {...columnToolbarProps(columnState, CANCELLATION_QUEUE_LABELS, CANCELLATION_QUEUE_COLUMNS)}
        summaryItems={[columnSummaryItem(columnState)]}
        onResetAll={columnState.reset}
        resetDisabled={!columnState.hasColumnConfig}
      />
      {query.isError ? (
        <OrderLoadError inline error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <OrderTableSkeleton />
      ) : query.data.totalElements === 0 ? (
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
            data={query.data.items}
            rowKey={(row) => row.requestId}
            stickyHeader
            // Mở dòng = tới thẻ yêu cầu huỷ trên chi tiết đơn (đủ bối cảnh: tiền, sản xuất, lịch sử) — BO-UX-34
            onRowClick={
              canOpenOrder
                ? (row) => router.push(ADMIN_ROUTES.orders.cancellationRequest(row.orderId))
                : undefined
            }
            flagRow={() => true}
            caption={L.caption(query.data.items.length, query.data.totalElements)}
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
