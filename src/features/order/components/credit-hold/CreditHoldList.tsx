"use client";

import { ShieldAlert } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import { useState } from "react";

import {
  ADMIN_ROUTES,
  CREDIT_HOLD_PERMISSIONS,
  ORDER_PERMISSIONS,
  PAGE_SIZE,
  STORAGE_KEYS,
  UI_LABELS,
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

import { allowedOrderActions, orderActionContextOf } from "../../lifecycle";
import { ContractCreditReviewQueue } from "../contract-credit-review/ContractCreditReviewQueue";
import { useCreditHolds } from "../../queries";
import { OrderLoadError } from "../OrderLoadError";
import { OrderPermissionGate } from "../OrderPermissionGate";
import { OrderTableSkeleton } from "../OrderSkeletons";

import {
  buildCreditHoldColumns,
  CREDIT_HOLD_COLUMN_LABELS,
  CREDIT_HOLD_COLUMNS,
  CREDIT_HOLD_LOCKED_COLUMNS,
} from "./columns";
import { CreditHoldRowActions } from "./CreditHoldRowActions";
import { RefundDueNotice } from "./RefundDueNotice";

import type { CreditHold } from "../../types";
import type { CreditHoldTarget } from "./types";

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
 * Hàng đợi đơn công nợ vượt hạn mức (SCRUM-427, `GET /orders/credit-holds`, cũ nhất trước) + hợp đồng chờ duyệt tín
 * dụng trước khi gửi (`ContractCreditReviewQueue`).
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
  // Đơn vừa từ chối rời hàng đợi khi tải lại → giữ ở đây để hiện số phải hoàn (plan WF-02 C5)
  const [rejected, setRejected] = useState<CreditHoldTarget | null>(null);
  const columns = buildCreditHoldColumns((row: CreditHold) => {
    // Cùng gate với trang chi tiết: On Hold + CREDIT + lý do giữ CREDIT + quyền APPROVE
    const codes = allowedOrderActions(row.order.status, can, orderActionContextOf(row.order)).map(
      (a) => a.code,
    );
    return (
      <CreditHoldRowActions
        order={row.order}
        canApprove={codes.includes("credit-approve")}
        canReject={codes.includes("credit-reject")}
        onRejected={setRejected}
      />
    );
  }, canOpenOrders);
  const columnState = useColumnVisibility(
    STORAGE_KEYS.adminCreditHoldsColumns,
    CREDIT_HOLD_COLUMNS,
    { locked: CREDIT_HOLD_LOCKED_COLUMNS },
  );
  const visibleColumns = columns.filter((column) =>
    columnState.visible.some((key) => key === column.key),
  );

  return (
    <div className="surface-soft">
      {/* Trang danh sách kiểu Vercel (data-table-mode-a §1): không tiêu đề / nút quay lại — breadcrumb là tên trang. */}
      <h1 className="sr-only">{TITLE}</h1>
      {canRead && (
        // BE `GET /orders/credit-holds` chỉ nhận trang: không có search / lọc — toolbar còn Ẩn hiện cột + Cấu hình.
        <ListToolbar
          {...columnToolbarProps(columnState, CREDIT_HOLD_COLUMN_LABELS, CREDIT_HOLD_COLUMNS)}
          summaryItems={[columnSummaryItem(columnState)]}
          onResetAll={columnState.reset}
          resetDisabled={!columnState.hasColumnConfig}
        />
      )}
      {rejected && (
        <RefundDueNotice orderId={rejected.orderId} orderNumber={rejected.orderNumber} />
      )}
      {!canRead ? (
        <OrderLoadError inline error={null} kind="no-read" />
      ) : query.isError ? (
        <OrderLoadError inline error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <OrderTableSkeleton />
      ) : query.data.totalElements === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="size-8" />}
          title="Không có đơn chờ duyệt công nợ"
          description="Chưa có đơn nào bị giữ vì công nợ."
        />
      ) : (
        <>
          <RefetchBar active={query.isFetching} label="Đang tải lại danh sách" />
          <DataTable
            columns={visibleColumns}
            data={query.data.items}
            stickyHeader
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
      {/* 15 BR-11 (BE PR #486): cùng quyền READ / APPROVE với đơn treo — không có quyền mới */}
      {canRead && (
        <ContractCreditReviewQueue
          canOpenOrders={canOpenOrders}
          canDecide={can(CREDIT_HOLD_PERMISSIONS.approve)}
        />
      )}
    </div>
  );
}
