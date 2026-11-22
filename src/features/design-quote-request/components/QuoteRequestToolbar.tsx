"use client";

import { DESIGN_QUOTE_REQUEST_LABELS as COPY } from "@/constants";

import { columnSummaryItem, columnToolbarProps } from "@/hooks/use-column-visibility";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { FilterSelect } from "@/components/backoffice/FilterSelect";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { ToolbarFilterPopover } from "@/components/shared/ToolbarFilterPopover";

import { QUOTE_REQUEST_STATUS_OPTIONS } from "./copy";

import type { ColumnVisibility } from "@/hooks/use-column-visibility";
import type { QuoteRequestFilters } from "./useQuoteRequestFilters";

/**
 * Toolbar chung của hai hộp yêu cầu báo giá (data-table-mode-a §2, BO-UX-2/7): nút Lọc (trạng thái — BE nhận một giá
 * trị), Ẩn hiện cột, thanh Cấu hình có chip từng bộ lọc. Không có search chính: BE `GET /design-*-quote-requests` không
 * có tham số tìm, lọc FE chỉ thấy trang đang tải. Ô khách là bộ lọc TUỲ CHỌN (L-5): không dấu `*`, không câu luật của
 * form báo giá.
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
    <ListToolbar
      {...columnToolbarProps(columns, columnLabels, allColumns)}
      tools={
        <ToolbarFilterPopover active={statusChanged} onClear={() => filters.setStatus("OPEN")}>
          <FilterSelect
            id={`${idPrefix}-status`}
            label={COPY.statusFilter}
            allLabel={COPY.statusAll}
            value={filters.status ?? null}
            options={QUOTE_REQUEST_STATUS_OPTIONS}
            onChange={filters.setStatus}
          />
        </ToolbarFilterPopover>
      }
      facets={
        <CustomerPicker
          idPrefix={idPrefix}
          value={filters.customerId}
          onChange={filters.setCustomerId}
          optional
        />
      }
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
      resetDisabled={!statusChanged && !filters.customerId && !columns.hasColumnConfig}
    />
  );
}
