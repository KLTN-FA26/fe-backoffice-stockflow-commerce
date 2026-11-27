"use client";

import { FileText } from "lucide-react";

import {
  DESIGN_QUOTE_REQUEST_LABELS as COPY,
  DESIGN_PERMISSIONS,
  DESIGN_QUOTE_REQUEST_PERMISSIONS,
  DESIGN_REVIEW_STORAGE_KEYS,
} from "@/constants";

import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { ServerTableBody } from "@/components/backoffice/ServerTableBody";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";

import { useCloseDesignQuoteRequest } from "../mutations";
import { useDesignQuoteRequests } from "../queries";
import { QUOTE_REQUEST_COPY } from "./copy";
import {
  matchesQuoteRequestFilters,
  quoteRequestPageFilterActive,
  quoteRequestHeaderFilters,
} from "./quote-request-header-filters";
import { QuoteRequestToolbar } from "./QuoteRequestToolbar";
import {
  DESIGN_REQUEST_COLUMN_LABELS,
  DESIGN_REQUEST_COLUMNS,
  DESIGN_REQUEST_DEFAULT_COLUMNS,
  DESIGN_REQUEST_LOCKED_COLUMNS,
  designQuoteRequestColumns,
} from "./quote-request-columns";
import { QuoteRequestTabs } from "./QuoteRequestTabs";
import { useQuoteRequestFilters } from "./useQuoteRequestFilters";

function DesignQuoteRequestContent() {
  const filters = useQuoteRequestFilters(DESIGN_REVIEW_STORAGE_KEYS.quoteRequestsConfig);
  const { list } = filters;
  const query = useDesignQuoteRequests({
    page: list.apiPage,
    size: list.pageSize,
    status: filters.status,
    customerId: filters.customerId || undefined,
  });
  const close = useCloseDesignQuoteRequest();
  const canOpenDesign = useCan(DESIGN_PERMISSIONS.viewPage);
  const columnState = useColumnVisibility(
    DESIGN_REVIEW_STORAGE_KEYS.quoteRequestsColumns,
    DESIGN_REQUEST_COLUMNS,
    { defaults: DESIGN_REQUEST_DEFAULT_COLUMNS, locked: DESIGN_REQUEST_LOCKED_COLUMNS },
  );
  const columns = withHeaderFilters(
    designQuoteRequestColumns(close, canOpenDesign).filter((column) =>
      columnState.visible.some((key) => key === column.key),
    ),
    quoteRequestHeaderFilters(filters),
  );

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{COPY.title}</h1>
      <QuoteRequestTabs value="single" />
      <QuoteRequestToolbar
        idPrefix="quote-request"
        filters={filters}
        columns={columnState}
        columnLabels={DESIGN_REQUEST_COLUMN_LABELS}
        allColumns={DESIGN_REQUEST_COLUMNS}
      />
      <ServerTableBody
        query={query}
        canRead
        columns={columns}
        rowKey={(row) => row.id}
        errorCopy={QUOTE_REQUEST_COPY}
        noun="yêu cầu báo giá"
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
          icon: <FileText className="size-8" />,
          title: COPY.emptyTitle,
          description: COPY.emptyDescription,
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

/** Hộp yêu cầu báo giá của thiết kế đơn lẻ (BE `design-quote-requests:READ`). */
export function DesignQuoteRequestList() {
  return (
    <PermissionBoundary permissions={[DESIGN_QUOTE_REQUEST_PERMISSIONS.read]} variant="list">
      <DesignQuoteRequestContent />
    </PermissionBoundary>
  );
}
