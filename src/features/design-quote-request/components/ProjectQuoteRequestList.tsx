"use client";

import { FolderKanban } from "lucide-react";

import {
  DESIGN_QUOTE_REQUEST_LABELS as COPY,
  DESIGN_QUOTE_REQUEST_PERMISSIONS,
  DESIGN_REVIEW_STORAGE_KEYS,
} from "@/constants";

import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { ServerTableBody } from "@/components/backoffice/ServerTableBody";

import { useCloseProjectQuoteRequest } from "../mutations";
import { useProjectQuoteRequests } from "../queries";
import { QUOTE_REQUEST_COPY } from "./copy";
import { projectQuoteRequestColumns } from "./quote-request-columns";
import { QuoteRequestTabs } from "./QuoteRequestTabs";
import { useQuoteRequestFilters } from "./useQuoteRequestFilters";

function ProjectQuoteRequestContent() {
  const filters = useQuoteRequestFilters(DESIGN_REVIEW_STORAGE_KEYS.projectQuoteRequestsConfig);
  const { list } = filters;
  // BE chưa lọc được theo trạng thái (BE-3): hiện mọi trạng thái, không lọc phía client sau phân trang.
  const query = useProjectQuoteRequests({
    page: list.apiPage,
    size: list.pageSize,
    customerId: filters.customerId || undefined,
  });
  const close = useCloseProjectQuoteRequest();
  const columns = projectQuoteRequestColumns(close);

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{COPY.title}</h1>
      <QuoteRequestTabs value="project" />
      <div className="py-3">
        <CustomerPicker
          idPrefix="project-quote-request"
          value={filters.customerId}
          onChange={filters.setCustomerId}
        />
      </div>
      <ServerTableBody
        query={query}
        canRead
        columns={columns}
        rowKey={(row) => row.id}
        noun="yêu cầu báo giá dự án"
        errorCopy={QUOTE_REQUEST_COPY}
        hasFilters={filters.customerId !== ""}
        onClearFilters={filters.clear}
        empty={{
          icon: <FolderKanban className="size-8" />,
          title: COPY.projectEmptyTitle,
          description: COPY.projectEmptyDescription,
        }}
        pageSize={list.pageSize}
        onPageChange={list.goToPage}
        onPageSizeChange={list.changePageSize}
        stickyHeader
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
