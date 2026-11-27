"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";

import {
  ADMIN_ROUTES,
  DESIGN_PERMISSIONS,
  DESIGN_REVIEW_STORAGE_KEYS,
  DESIGN_ROUND_LABELS,
} from "@/constants";

import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useServerList } from "@/hooks/use-server-list";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { useReviewRounds } from "@/features/design-review/queries";

import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";

import { REVIEW_ROUNDS_COPY, REVIEW_TOOLBAR_COPY } from "./copy";
import { ReviewListTable } from "./ReviewListTable";
import { ReviewListToolbar, useReviewToolbarFilters } from "./ReviewListToolbar";
import { useReviewHeaderFilters } from "./review-header-filters";
import { ReviewQueueTabs } from "./ReviewQueueList";
import {
  ROUND_COLUMN_LABELS,
  ROUND_COLUMNS,
  ROUND_LOCKED_COLUMNS,
  reviewRoundColumns,
} from "./review-round-columns";

import type { ReviewRound } from "@/features/design-review/types";
import type { ReviewFilterSpec } from "./review-header-filters";

const NO_STATUSES: readonly never[] = [];

/** Lọc trên header cột danh sách vòng duyệt (chỉ trang đang xem). */
const ROUND_HEADER_FILTERS: readonly ReviewFilterSpec<ReviewRound>[] = [
  { kind: "text", column: "project", label: "dự án", get: (row) => [row.projectName] },
  { kind: "text", column: "customer", label: "khách hàng", get: (row) => [row.customerName] },
  { kind: "date", column: "submittedAt", label: "ngày gửi", get: (row) => row.submittedAt },
];

function ReviewRoundListContent() {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const list = useServerList(DESIGN_REVIEW_STORAGE_KEYS.roundsConfig, NO_STATUSES);
  const query = useReviewRounds({ page: list.apiPage, size: list.pageSize });
  // Lọc ở header cột — khoá URL riêng, chỉ xét trang đang xem (BE danh sách vòng chỉ nhận page / size).
  const header = useReviewHeaderFilters("round", ROUND_HEADER_FILTERS);
  const toolbar = useReviewToolbarFilters<ReviewRound>(
    "round",
    {
      searchText: (row) => [row.projectName, row.customerName],
      customer: (row) => row.customerName,
      since: (row) => row.submittedAt,
    },
    now,
  );
  const columnState = useColumnVisibility(DESIGN_REVIEW_STORAGE_KEYS.roundsColumns, ROUND_COLUMNS, {
    locked: ROUND_LOCKED_COLUMNS,
  });
  const visible = columnState.visible;
  const columns = withHeaderFilters(
    reviewRoundColumns(now).filter((column) => visible.some((key) => key === column.key)),
    header.headerFilters,
  );

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{DESIGN_ROUND_LABELS.listTitle}</h1>
      <ReviewQueueTabs value="project" />
      <ReviewListToolbar
        filters={toolbar}
        rows={query.data?.items ?? []}
        customerOf={(row) => row.customerName}
        searchPlaceholder={REVIEW_TOOLBAR_COPY.roundSearch}
        columns={columnState}
        columnLabels={ROUND_COLUMN_LABELS}
        allColumns={ROUND_COLUMNS}
      />
      <ReviewListTable
        query={query}
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(ADMIN_ROUTES.designReviewRounds.detail(row.id))}
        noun="vòng duyệt"
        errorCopy={REVIEW_ROUNDS_COPY}
        empty={{
          icon: <ClipboardCheck className="size-8" />,
          title: DESIGN_ROUND_LABELS.emptyTitle,
          description: DESIGN_ROUND_LABELS.emptyDescription,
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

/** Vòng duyệt chỉ cho người có `design-designs:APPROVE` (BE `DesignReviewRoundController`). */
export function ReviewRoundList() {
  return (
    <PermissionBoundary permissions={[DESIGN_PERMISSIONS.approve]} variant="list">
      <ReviewRoundListContent />
    </PermissionBoundary>
  );
}
