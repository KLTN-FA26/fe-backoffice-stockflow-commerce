"use client";

import { FileText } from "lucide-react";

import {
  DESIGN_QUOTE_REQUEST_LABELS as COPY,
  DESIGN_QUOTE_REQUEST_PERMISSIONS,
  DESIGN_REVIEW_STORAGE_KEYS,
} from "@/constants";

import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { FilterSelect } from "@/components/backoffice/FilterSelect";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";

import { useCloseDesignQuoteRequest } from "../mutations";
import { useDesignQuoteRequests } from "../queries";
import { QUOTE_REQUEST_COPY, QUOTE_REQUEST_STATUS_OPTIONS } from "./copy";
import { designQuoteRequestColumns } from "./quote-request-columns";
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
  const columns = designQuoteRequestColumns(close);

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{COPY.title}</h1>
      <QuoteRequestTabs value="single" />
      <div className="flex flex-wrap items-end gap-4 py-3">
        <FilterSelect
          id="quote-request-status"
          label={COPY.statusFilter}
          allLabel={COPY.statusAll}
          value={filters.status ?? null}
          options={QUOTE_REQUEST_STATUS_OPTIONS}
          onChange={filters.setStatus}
        />
        <CustomerPicker
          idPrefix="quote-request"
          value={filters.customerId}
          onChange={filters.setCustomerId}
        />
      </div>
      <ServerTableBody
        query={query}
        canRead
        columns={columns}
        rowKey={(row) => row.id}
        noun="yêu cầu báo giá"
        errorCopy={QUOTE_REQUEST_COPY}
        hasFilters={filters.status !== "OPEN" || filters.customerId !== ""}
        onClearFilters={filters.clear}
        empty={{
          icon: <FileText className="size-8" />,
          title: COPY.emptyTitle,
          description: COPY.emptyDescription,
        }}
        pageSize={list.pageSize}
        onPageChange={list.goToPage}
        onPageSizeChange={list.changePageSize}
        stickyHeader
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
