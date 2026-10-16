"use client";

import { ArrowLeft, ShieldAlert } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";

import {
  ADMIN_ROUTES,
  CREDIT_HOLD_PERMISSIONS,
  ORDER_PERMISSIONS,
  PAGE_SIZE,
  STORAGE_KEYS,
  UI_LABELS,
} from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { usePermissionChecker } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { RefetchBar } from "@/components/shared/RefetchBar";

import { allowedOrderActions } from "../../lifecycle";
import { useCreditHolds } from "../../queries";
import { OrderLoadError } from "../OrderLoadError";
import { OrderPermissionGate } from "../OrderPermissionGate";
import { OrderTableSkeleton } from "../OrderSkeletons";
import { HeaderLink } from "../HeaderLink";

import { buildCreditHoldColumns } from "./columns";
import { CreditApproveAction } from "./CreditApproveAction";
import { CreditRejectAction } from "./CreditRejectAction";

import type { CreditHold } from "../../types";

const TITLE = UI_LABELS.order.creditHoldsTitle;
const PAGE_SIZE_OPTIONS: number[] = [PAGE_SIZE.sm, PAGE_SIZE.md, PAGE_SIZE.lg, PAGE_SIZE.xl];
interface CreditHoldPageConfig {
  pageSize: number;
}
const DEFAULT_CONFIG: CreditHoldPageConfig = { pageSize: PAGE_SIZE.md };

/** Bỏ page size lạ trong localStorage cũ. */
function mergeConfig(
  stored: Partial<CreditHoldPageConfig>,
  fallback: CreditHoldPageConfig,
): CreditHoldPageConfig {
  return stored.pageSize && PAGE_SIZE_OPTIONS.includes(stored.pageSize)
    ? { pageSize: stored.pageSize }
    : fallback;
}

/** Segment cuối của route — breadcrumb hiện tên trang thay vì "credit-holds". */
const ROUTE_SEGMENT = ADMIN_ROUTES.orders.creditHolds.split("/").at(-1);

/**
 * Hàng đợi đơn công nợ vượt hạn mức (SCRUM-427, `GET /orders/credit-holds`, cũ nhất trước).
 * Sales / Coordinator xem; chỉ ACCOUNTANT (sales-order-credit-holds:APPROVE) duyệt / từ chối.
 */
export function CreditHoldList() {
  useBreadcrumbLabel(ROUTE_SEGMENT, TITLE);
  return (
    <OrderPermissionGate permissions={[CREDIT_HOLD_PERMISSIONS.viewPage]} variant="list">
      <CreditHoldListContent />
    </OrderPermissionGate>
  );
}

function CreditHoldListContent() {
  const can = usePermissionChecker();
  // UI-only — Backend phải re-check (CreditHoldController @RequiresPermission READ / APPROVE)
  const canRead = can(CREDIT_HOLD_PERMISSIONS.read);
  // ACCOUNTANT xem hàng đợi nhưng không có sales-orders:VIEW_PAGE → không dẫn tới trang đơn bị chặn
  const canOpenOrders = can(ORDER_PERMISSIONS.viewPage);
  // Trang trên URL (nuqs); số dòng/trang là sở thích cá nhân → localStorage (state-persistence)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const { config, updateConfig } = usePageConfig<CreditHoldPageConfig>(
    STORAGE_KEYS.adminCreditHoldsConfig,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  const query = useCreditHolds(
    { page: Math.max(0, page - 1), size: config.pageSize },
    { enabled: canRead },
  );
  const columns = buildCreditHoldColumns((row: CreditHold) => {
    // Cùng gate với trang chi tiết: On Hold + CREDIT + quyền APPROVE
    const codes = allowedOrderActions(row.order.status, can, {
      paymentTerm: row.order.paymentTerm,
    }).map((a) => a.code);
    return (
      <div className="flex justify-end gap-1.5">
        {codes.includes("credit-approve") && <CreditApproveAction order={row.order} compact />}
        {codes.includes("credit-reject") && <CreditRejectAction order={row.order} compact />}
      </div>
    );
  }, canOpenOrders);

  return (
    <>
      <PageHeader
        title={TITLE}
        subtitle="Đơn công nợ có dư nợ + giá trị đơn vượt hạn mức tín dụng, chờ người có quyền duyệt."
        actions={
          canOpenOrders && (
            <HeaderLink href={ADMIN_ROUTES.orders.list}>
              <ArrowLeft className="size-3.5" /> {UI_LABELS.order.pageTitle}
            </HeaderLink>
          )
        }
      />
      {!canRead ? (
        <OrderLoadError inline error={null} kind="no-read" />
      ) : query.isError ? (
        <OrderLoadError inline error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <OrderTableSkeleton />
      ) : query.data.totalElements === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="size-8" />}
          title="Không có đơn vượt hạn mức"
          description="Mọi đơn công nợ hiện đều nằm trong hạn mức của khách."
        />
      ) : (
        <>
          <RefetchBar active={query.isFetching} label="Đang tải lại danh sách" />
          <DataTable
            columns={columns}
            data={query.data.items}
            rowKey={(row) => row.order.orderId}
            // Mọi đơn trong hàng đợi đều On Hold — viền cảnh báo như danh sách đơn (data-table-mode-a)
            flagRow={() => true}
            caption={`Hiển thị ${query.data.items.length} / ${query.data.totalElements} đơn`}
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
