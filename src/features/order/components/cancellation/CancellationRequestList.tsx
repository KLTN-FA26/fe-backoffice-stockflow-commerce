"use client";

import { ArrowLeft, Ban } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";

import {
  ADMIN_ROUTES,
  CANCELLATION_REQUEST_LABELS,
  CANCELLATION_REQUEST_PERMISSIONS,
  ORDER_PERMISSIONS,
  PAGE_SIZE,
  STORAGE_KEYS,
} from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { usePermissionChecker } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { allowedCancellationRequestActions } from "../../cancellation-request-lifecycle";
import { useCancellationRequests } from "../../queries";
import { HeaderLink } from "../HeaderLink";
import { OrderLoadError } from "../OrderLoadError";
import { OrderPermissionGate } from "../OrderPermissionGate";
import { OrderTableSkeleton } from "../OrderSkeletons";

import { buildCancellationRequestColumns, RequestRowActions } from "./columns";

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

  return (
    <>
      <PageHeader
        title={L.title}
        subtitle={L.subtitle}
        actions={
          canOpenOrder && (
            <HeaderLink href={ADMIN_ROUTES.orders.list}>
              <ArrowLeft className="size-3.5" /> {L.backToOrders}
            </HeaderLink>
          )
        }
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
            columns={columns}
            data={query.data.items}
            rowKey={(row) => row.requestId}
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
    </>
  );
}
