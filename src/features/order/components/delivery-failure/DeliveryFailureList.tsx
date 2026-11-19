"use client";

import { PackageX } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ADMIN_ROUTES, DELIVERY_FAILURE_LABELS, ORDER_PERMISSIONS, PAGE_SIZE } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { RefetchBar } from "@/components/shared/RefetchBar";
import { Button } from "@/components/ui/button";

import { useDeliveryFailures } from "../../delivery-failure-queries";
import { OrderLoadError } from "../OrderLoadError";
import { OrderPermissionGate } from "../OrderPermissionGate";
import { OrderTableSkeleton } from "../OrderSkeletons";

import { buildDeliveryFailureColumns } from "./columns";

const L = DELIVERY_FAILURE_LABELS;
/** `?scope=all` hiện cả hồ sơ đã quyết; mặc định chỉ hồ sơ chờ Sale (OPEN). */
const SCOPES = ["open", "all"] as const;
const ROUTE_SEGMENT = ADMIN_ROUTES.orders.deliveryFailures.split("/").at(-1);

/**
 * Hàng đợi "Giao thất bại" (WF-05 GH-1; BE `GET /orders/delivery-failures`): lô hãng mang về đã được kho nhận lại, chờ
 * Sale giao lại hoặc huỷ phần chưa giao. Đọc cần `sales-orders:READ`; nút theo `allowedDeliveryFailureActions`.
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
  const can = usePermissionChecker();
  const [scope, setScope] = useQueryState(
    "scope",
    parseAsStringLiteral(SCOPES).withDefault("open"),
  );
  const query = useDeliveryFailures(scope === "open" ? { status: "OPEN" } : {});
  // UI-only — Backend phải re-check (DeliveryFailureController @RequiresPermission sales-orders:READ)
  const columns = buildDeliveryFailureColumns(can, can(ORDER_PERMISSIONS.read));
  const empty = scope === "open" ? L.empty : L.emptyAll;

  return (
    <div className="surface-soft space-y-4">
      <h1 className="sr-only">{L.title}</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-secondary max-w-[68ch] text-[0.8125rem]">{L.subtitle}</p>
        <div role="group" aria-label={L.filter.label} className="flex gap-1.5">
          {SCOPES.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={scope === value ? "default" : "outline"}
              aria-pressed={scope === value}
              onClick={() => void setScope(value)}
            >
              {value === "open" ? L.filter.open : L.filter.all}
            </Button>
          ))}
        </div>
      </div>
      {query.isError ? (
        <OrderLoadError inline error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <OrderTableSkeleton />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={<PackageX className="size-8" />}
          title={empty.title}
          description={empty.description}
        />
      ) : (
        <>
          <RefetchBar active={query.isFetching} label="Đang tải lại danh sách" />
          <DataTable
            stickyHeader
            columns={columns}
            data={query.data}
            rowKey={(row) => row.caseId}
            flagRow={(row) => row.status === "OPEN"}
            caption={L.caption(query.data.length)}
            pageSize={PAGE_SIZE.md}
          />
        </>
      )}
    </div>
  );
}
