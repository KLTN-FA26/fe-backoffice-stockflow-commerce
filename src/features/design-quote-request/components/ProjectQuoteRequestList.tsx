"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";

import {
  ADMIN_ROUTES,
  DESIGN_QUOTE_REQUEST_LABELS as COPY,
  DESIGN_QUOTE_REQUEST_PERMISSIONS,
  DESIGN_REVIEW_STORAGE_KEYS,
} from "@/constants";

import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";

import { useCloseProjectQuoteRequest } from "../mutations";
import { useProjectQuoteRequests } from "../queries";
import { QUOTE_REQUEST_COPY } from "./copy";
import {
  matchesQuoteRequestFilters,
  quoteRequestPageFilterActive,
  quoteRequestHeaderFilters,
} from "./quote-request-header-filters";
import { QuoteRequestToolbar } from "./QuoteRequestToolbar";
import {
  PROJECT_REQUEST_COLUMN_LABELS,
  PROJECT_REQUEST_COLUMNS,
  PROJECT_REQUEST_LOCKED_COLUMNS,
  projectQuoteRequestColumns,
} from "./quote-request-columns";
import { QuoteRequestTabs } from "./QuoteRequestTabs";
import { useQuoteRequestFilters } from "./useQuoteRequestFilters";

import type { ProjectQuoteRequest } from "../types";

function ProjectQuoteRequestContent() {
  // Mốc "Đã chờ …" của trang (bo-01): chốt lúc mở trang, không đổi mỗi lần vẽ lại.
  const [now] = useState(() => new Date());
  const filters = useQuoteRequestFilters(DESIGN_REVIEW_STORAGE_KEYS.projectQuoteRequestsConfig);
  const { list } = filters;
  const query = useProjectQuoteRequests({
    page: list.apiPage,
    size: list.pageSize,
    status: filters.status,
    customerId: filters.customerId || undefined,
  });
  const close = useCloseProjectQuoteRequest();
  const router = useRouter();
  const detailHref = (row: ProjectQuoteRequest) =>
    ADMIN_ROUTES.designProjectQuoteRequests.detail(row.id, row.customerId);
  const columnState = useColumnVisibility(
    DESIGN_REVIEW_STORAGE_KEYS.projectQuoteRequestsColumns,
    PROJECT_REQUEST_COLUMNS,
    { locked: PROJECT_REQUEST_LOCKED_COLUMNS },
  );
  const columns = withHeaderFilters(
    projectQuoteRequestColumns(close, detailHref, now).filter((column) =>
      columnState.visible.some((key) => key === column.key),
    ),
    quoteRequestHeaderFilters(filters),
  );

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{COPY.title}</h1>
      <QuoteRequestTabs value="project" />
      <QuoteRequestToolbar
        idPrefix="project-quote-request"
        filters={filters}
        columns={columnState}
        columnLabels={PROJECT_REQUEST_COLUMN_LABELS}
        allColumns={PROJECT_REQUEST_COLUMNS}
      />
      <ServerTableBody
        query={query}
        canRead
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(detailHref(row))}
        errorCopy={QUOTE_REQUEST_COPY}
        noun="yêu cầu báo giá dự án"
        onClearFilters={filters.clear}
        hasFilters={
          filters.status !== "OPEN" ||
          filters.customerId !== "" ||
          quoteRequestPageFilterActive(filters)
        }
        rowFilter={{
          active: quoteRequestPageFilterActive(filters),
          match: (row) => matchesQuoteRequestFilters(row, filters),
        }}
        empty={{
          icon: <FolderKanban className="size-8" />,
          title: COPY.projectEmptyTitle,
          description: COPY.projectEmptyDescription,
        }}
        pageSize={list.pageSize}
        onPageChange={list.goToPage}
        onPageSizeChange={list.changePageSize}
        stickyHeader
        emptyInTable
      />
    </div>
  );
}

/** Hộp yêu cầu báo giá cả bộ thiết kế của dự án (BE `design-quote-requests:READ`). */
export function ProjectQuoteRequestList() {
  return (
    <PermissionBoundary permissions={[DESIGN_QUOTE_REQUEST_PERMISSIONS.read]} variant="list">
      <ProjectQuoteRequestContent />
    </PermissionBoundary>
  );
}
