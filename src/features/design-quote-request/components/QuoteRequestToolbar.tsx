"use client";

import { DESIGN_QUOTE_REQUEST_LABELS as COPY } from "@/constants";

import { columnSummaryItem, columnToolbarProps } from "@/hooks/use-column-visibility";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { QUOTE_REQUEST_STATUS_OPTIONS } from "./copy";
import { quoteRequestPageFilterActive } from "./quote-request-header-filters";

import type { ColumnVisibility } from "@/hooks/use-column-visibility";
import type { QuoteRequestStatus } from "../types";
import type { QuoteRequestFilters } from "./useQuoteRequestFilters";

const STATUS_OPTIONS = [...QUOTE_REQUEST_STATUS_OPTIONS];

/** BE `GET /design-*-quote-requests` không có tham số tìm → ô tìm chỉ lọc trang đang xem, nói rõ ngay trong ô. */
const COPY_SEARCH = "Tìm trong trang đang xem: thiết kế / dự án, khách, SKU…";

/**
 * Toolbar chung của hai hộp yêu cầu báo giá — thanh cấu hình kiểu Vercel (backoffice-erp-ui §3): nút "Bộ lọc" + "Ẩn hiện
 * cột" đầu hàng, viên "Nhãn **Giá trị**", "Đặt lại" bên phải. Bảng "Bộ lọc" có cột Khách hàng và cột Trạng thái (BE nhận
 * MỘT trạng thái: tick là chọn một, tick lại = "Tất cả"). Ô khách là bộ lọc TUỲ CHỌN (L-5): không dấu `*`, không câu
 * luật của form báo giá.
 */
export function QuoteRequestToolbar<C extends string>({
  idPrefix,
  filters,
  columns,
  columnLabels,
  allColumns,
}: {
  idPrefix: string;
  filters: QuoteRequestFilters;
  columns: ColumnVisibility<C>;
  columnLabels: Record<C, string>;
  allColumns: readonly C[];
}) {
  const statusChanged = filters.statusFilter !== "OPEN";
  const statusLabel =
    filters.statusFilter === "ALL"
      ? COPY.statusAll
      : (QUOTE_REQUEST_STATUS_OPTIONS.find((o) => o.value === filters.statusFilter)?.label ??
        COPY.statusAll);
  return (
    <ListToolbar<QuoteRequestStatus, never, C>
      {...columnToolbarProps(columns, columnLabels, allColumns)}
      controlsIn="summary"
      search={filters.q}
      onSearchChange={filters.setQ}
      searchPlaceholder={COPY_SEARCH}
      statusOptions={STATUS_OPTIONS}
      selectedStatuses={filters.status ? [filters.status] : []}
      onToggleStatus={(value) => filters.setStatus(filters.status === value ? null : value)}
      onClearStatuses={() => filters.setStatus("OPEN")}
      hasStatusFilter={statusChanged}
      filterPanel={
        <section aria-label={COPY.columns.customer} className="min-w-0 px-5 py-3">
          <CustomerPicker
            idPrefix={idPrefix}
            value={filters.customerId}
            onChange={filters.setCustomerId}
            optional
          />
        </section>
      }
      hasPanelFilter={!!filters.customerId}
      onClearPanelFilters={() => filters.setCustomerId("")}
      summaryItems={[
        {
          label: COPY.statusFilter,
          value: statusLabel,
          active: statusChanged,
          onClear: () => filters.setStatus("OPEN"),
        },
        {
          label: COPY.columns.customer,
          value: filters.customerId ? (
            <CustomerName id={filters.customerId} link={false} />
          ) : (
            COPY.statusAll
          ),
          active: !!filters.customerId,
          onClear: () => filters.setCustomerId(""),
        },
        columnSummaryItem(columns),
      ]}
      onResetAll={() => {
        filters.clear();
        columns.reset();
      }}
      resetDisabled={
        !statusChanged &&
        !filters.customerId &&
        !quoteRequestPageFilterActive(filters) &&
        !columns.hasColumnConfig
      }
    />
  );
}
