"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";

import {
  ADMIN_ROUTES,
  DESIGN_PERMISSIONS,
  DESIGN_REVIEW_LABELS,
  DESIGN_REVIEW_STORAGE_KEYS,
} from "@/constants";

import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useServerList } from "@/hooks/use-server-list";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { useReviewQueue } from "@/features/design-review/queries";

import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { PageTabs } from "@/components/shared/PageTabs";

import { REVIEW_QUEUE_COPY, REVIEW_TOOLBAR_COPY } from "./copy";
import { ReviewListTable } from "./ReviewListTable";
import { ReviewListToolbar, useReviewToolbarFilters } from "./ReviewListToolbar";
import { useReviewHeaderFilters } from "./review-header-filters";
import {
  QUEUE_COLUMN_LABELS,
  QUEUE_COLUMNS,
  QUEUE_LOCKED_COLUMNS,
  reviewQueueColumns,
} from "./review-queue-columns";

import type { PageTabItem } from "@/components/shared/PageTabs";

import type { Design } from "@/features/design-review/types";
import type { ReviewFilterSpec } from "./review-header-filters";

type QueueTab = "single" | "project";

const NO_STATUSES: readonly never[] = [];

/** Hàng đợi đơn lẻ không gồm thiết kế còn nằm trong vòng duyệt dự án (BE `DesignDraftJpaRepository.java:40-52`). */
const TABS: readonly PageTabItem<QueueTab>[] = [
  { value: "single", label: DESIGN_REVIEW_LABELS.tabSingle },
  { value: "project", label: DESIGN_REVIEW_LABELS.tabProject },
];

/** Tab dùng chung với trang vòng duyệt (BO-4): đổi tab là đổi trang. */
export function ReviewQueueTabs({ value }: { value: QueueTab }) {
  const router = useRouter();
  return (
    <PageTabs
      tabs={TABS}
      value={value}
      idPrefix="design-review"
      ariaLabel="Loại hàng đợi duyệt"
      onChange={(next) =>
        router.push(
          next === "project"
            ? ADMIN_ROUTES.designReviewRounds.list
            : ADMIN_ROUTES.designs.reviewQueue,
        )
      }
    />
  );
}

/** Lọc trên header cột hàng đợi (chỉ trang đang xem). */
const QUEUE_HEADER_FILTERS: readonly ReviewFilterSpec<Design>[] = [
  { kind: "text", column: "name", label: "thiết kế", get: (row) => [row.name] },
  { kind: "text", column: "customer", label: "khách hàng", get: (row) => [row.customerName] },
  {
    kind: "text",
    column: "product",
    label: "sản phẩm · biến thể",
    get: (row) => [row.productName, row.variantName],
  },
  { kind: "text", column: "sku", label: "SKU phôi", get: (row) => [row.sku] },
  {
    kind: "text",
    column: "templateCode",
    label: "mã cấu hình in",
    get: (row) => [row.templateCode],
  },
  {
    kind: "date",
    column: "reviewRequestedAt",
    label: "ngày gửi duyệt",
    get: (row) => row.reviewRequestedAt,
  },
];

function ReviewQueueContent() {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const list = useServerList(DESIGN_REVIEW_STORAGE_KEYS.queueConfig, NO_STATUSES);
  const query = useReviewQueue({ page: list.apiPage, size: list.pageSize });
  // Lọc ở header cột — khoá URL riêng, chỉ xét trang đang xem (BE hàng đợi chỉ nhận page / size).
  const header = useReviewHeaderFilters("queue", QUEUE_HEADER_FILTERS);
  const toolbar = useReviewToolbarFilters<Design>(
    "queue",
    {
      searchText: (row) => [
        row.name,
        row.customerName,
        row.productName,
        row.variantName,
        row.sku,
        row.templateCode,
      ],
      customer: (row) => row.customerName,
      since: (row) => row.reviewRequestedAt,
    },
    now,
  );
  const columnState = useColumnVisibility(DESIGN_REVIEW_STORAGE_KEYS.queueColumns, QUEUE_COLUMNS, {
    locked: QUEUE_LOCKED_COLUMNS,
  });
  const visible = columnState.visible;
  const refetch = query.refetch;
  const columns = withHeaderFilters(
    reviewQueueColumns(now, () => void refetch()).filter((column) =>
      visible.some((key) => key === column.key),
    ),
    header.headerFilters,
  );

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{DESIGN_REVIEW_LABELS.queueTitle}</h1>
      <ReviewQueueTabs value="single" />
      <ReviewListToolbar
        filters={toolbar}
        rows={query.data?.items ?? []}
        customerOf={(row) => row.customerName}
        searchPlaceholder={REVIEW_TOOLBAR_COPY.queueSearch}
        columns={columnState}
        columnLabels={QUEUE_COLUMN_LABELS}
        allColumns={QUEUE_COLUMNS}
      />
      <ReviewListTable
        query={query}
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(ADMIN_ROUTES.designs.detail(row.id))}
        noun="thiết kế"
        errorCopy={REVIEW_QUEUE_COPY}
        empty={{
          icon: <ClipboardCheck className="size-8" />,
          title: DESIGN_REVIEW_LABELS.queueEmptyTitle,
          description: DESIGN_REVIEW_LABELS.queueEmptyDescription,
        }}
        matches={(row) => toolbar.matches(row) && header.matches(row)}
        filtering={toolbar.active || header.active}
        onClearFilters={() => {
          toolbar.clear();
          header.clear();
        }}
        pageSize={list.pageSize}
        onPageChange={list.goToPage}
        onPageSizeChange={list.changePageSize}
      />
    </div>
  );
}

/** Hàng đợi chỉ cho người có `design-designs:APPROVE` (SALES_STAFF có VIEW_PAGE nhưng BE trả 403). */
export function ReviewQueueList() {
  return (
    <PermissionBoundary permissions={[DESIGN_PERMISSIONS.approve]} variant="list">
      <ReviewQueueContent />
    </PermissionBoundary>
  );
}
