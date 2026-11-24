"use client";

import { PackageX } from "lucide-react";
import { useMemo } from "react";

import {
  ADMIN_ROUTES,
  DELIVERY_FAILURE_LABELS,
  DELIVERY_FAILURE_LIMITS,
  ORDER_PERMISSIONS,
  PAGE_SIZE,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { isUndecidedCase, newestFirst } from "../../delivery-failure-lifecycle";
import { useDeliveryFailures } from "../../delivery-failure-queries";
import { OrderLoadError } from "../OrderLoadError";
import { OrderPermissionGate } from "../OrderPermissionGate";
import { OrderTableSkeleton } from "../OrderSkeletons";

import { buildDeliveryFailureColumns } from "./columns";

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
  const query = useDeliveryFailures({});
  // UI-only — Backend phải re-check (DeliveryFailureController @RequiresPermission sales-orders:READ)
  const columns = buildDeliveryFailureColumns(canOpenOrder);
  const rows = useMemo(() => (query.data ? newestFirst(query.data) : []), [query.data]);
  // BE trả cũ nhất trước và cắt ở `limit`: chạm trần thì hồ sơ mới nhất có thể không có trong danh sách
  const truncated = rows.length >= DELIVERY_FAILURE_LIMITS.listLimit;

  return (
    <div className="surface-soft space-y-4">
      <h1 className="sr-only">{L.title}</h1>
      <p className="text-ink-secondary max-w-[68ch] text-[0.8125rem]">{L.subtitle}</p>
      {query.isError ? (
        <OrderLoadError inline error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <OrderTableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<PackageX className="size-8" />}
          title={L.emptyAll.title}
          description={L.emptyAll.description}
        />
      ) : (
        <>
          <RefetchBar active={query.isFetching} label="Đang tải lại danh sách" />
          {truncated && (
            <p role="status" className="text-warning-ink text-xs">
              {L.truncated(DELIVERY_FAILURE_LIMITS.listLimit)}
            </p>
          )}
          <DataTable
            stickyHeader
            columns={columns}
            data={rows}
            rowKey={(row) => row.caseId}
            flagRow={isUndecidedCase}
            caption={L.caption(rows.length)}
            pageSize={PAGE_SIZE.md}
          />
        </>
      )}
    </div>
  );
}
