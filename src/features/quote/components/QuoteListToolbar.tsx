"use client";

import { columnSummaryItem, columnToolbarProps } from "@/hooks/use-column-visibility";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { quoteStatusLabel } from "./copy";
import { QUOTE_COLUMN_LABELS, QUOTE_COLUMNS, STATUS_OPTIONS } from "./list-columns";

import type { QuoteApiStatus } from "@/constants";
import type { ColumnVisibility } from "@/hooks/use-column-visibility";
import type { QuoteColumn } from "./list-columns";
import type { QuoteListFilters } from "./useQuoteListFilters";

/** Tóm tắt lọc cột đang bật, vd `Số báo giá “0012”, Hiệu lực đến 2026-11-01 – …`. */
function columnSearchSummary({ columnFilters: f }: QuoteListFilters): string {
  const range = (label: string, from: string, to: string) =>
    (from || to) && `${label} ${from || "…"} – ${to || "…"}`;
  const parts = [
    f.qtNumber && `Số báo giá “${f.qtNumber}”`,
    range("Hiệu lực đến", f.qtValidFrom, f.qtValidTo),
    range("Ngày gửi", f.qtSentFrom, f.qtSentTo),
    range("Tổng có thuế", f.qtTotalFrom, f.qtTotalTo),
    f.qtOrder && (f.qtOrder === "yes" ? "Đã tạo đơn" : "Chưa tạo đơn"),
  ].filter(Boolean);
  return parts.join(", ") || "Chưa dùng";
}

/**
 * Thanh tìm + cấu hình kiểu Vercel (backoffice-erp-ui §2–4): hàng tìm chỉ có ô tìm; nút "Bộ lọc" + "Ẩn hiện cột" ở đầu
 * thanh cấu hình. Bảng "Bộ lọc" có cột Khách hàng (BE `customerId`), Duyệt giá (BE `priceReview`) rồi Trạng thái
 * (chọn nhiều).
 */
export function QuoteListToolbar({
  state,
  columns,
}: {
  state: QuoteListFilters;
  columns: ColumnVisibility<QuoteColumn>;
}) {
  const { filters, priceReview, customerId } = state;
  return (
    <ListToolbar<QuoteApiStatus, never, QuoteColumn>
      {...columnToolbarProps(columns, QUOTE_COLUMN_LABELS, QUOTE_COLUMNS)}
      controlsIn="summary"
      search={filters.q}
      onSearchChange={(value) => void filters.setQ(value)}
      searchPlaceholder="Tìm theo số báo giá (QT-…)"
      statusOptions={STATUS_OPTIONS}
      selectedStatuses={filters.status}
      onToggleStatus={state.list.toggleStatus}
      onClearStatuses={() => void filters.setStatus([])}
      hasStatusFilter={filters.status.length > 0}
      filterPanel={
        <>
          <section aria-label="Khách hàng" className="min-w-0 px-5 py-3">
            <CustomerPicker
              idPrefix="quote-list"
              value={customerId}
              onChange={state.setCustomerId}
              mode="filter"
            />
          </section>
          {priceReview.column}
        </>
      }
      hasPanelFilter={!!customerId || !!priceReview.value}
      onClearPanelFilters={() => {
        state.setCustomerId("");
        priceReview.clear();
      }}
      summaryItems={[
        {
          label: "Tìm kiếm chính",
          value: filters.q.trim() ? `“${filters.q}”` : "Chưa dùng",
          active: filters.q.trim() !== "",
          onClear: () => void filters.setQ(""),
        },
        { label: "Tìm theo", value: "Số báo giá" },
        {
          label: "Search trong cột",
          value: columnSearchSummary(state),
          active: state.hasColumnFilters,
          onClear: state.clearColumnFilters,
        },
        {
          label: "Trạng thái",
          value: filters.status.map(quoteStatusLabel).join(", ") || "Tất cả",
          active: filters.status.length > 0,
          onClear: () => void filters.setStatus([]),
        },
        {
          label: "Khách hàng",
          value: customerId ? <CustomerName id={customerId} link={false} /> : "Tất cả",
          active: !!customerId,
          onClear: () => state.setCustomerId(""),
        },
        priceReview.summaryItem,
        columnSummaryItem(columns),
      ]}
      onResetAll={() => {
        state.clear();
        columns.reset();
      }}
      resetDisabled={!state.hasFilters && !filters.sort && !columns.hasColumnConfig}
    />
  );
}
