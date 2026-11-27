"use client";

import { CUSTOMER_STATUS_BY_API } from "@/constants";

import { columnSummaryItem, columnToolbarProps } from "@/hooks/use-column-visibility";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

import { ListToolbar } from "@/components/shared/ListToolbar";

import { CUSTOMER_COLUMN_LABELS, CUSTOMER_COLUMNS, STATUS_OPTIONS } from "./list-columns";

import type { CustomerApiStatus } from "@/constants";
import type { ColumnVisibility } from "@/hooks/use-column-visibility";
import type { CustomerColumn } from "./list-columns";
import type { CustomerListFilters } from "./useCustomerListFilters";

/** Tóm tắt lọc cột đang bật, vd `Khách hàng “An”, Email “@abc”`. */
function columnSearchSummary(filters: CustomerListFilters): string {
  const f = filters.columnFilters;
  const parts = [
    f.custName && `Khách hàng “${f.custName}”`,
    f.custTaxCode && `MST “${f.custTaxCode}”`,
    f.custEmail && `Email “${f.custEmail}”`,
    f.custPhone && `Điện thoại “${f.custPhone}”`,
    (f.custCreatedFrom || f.custCreatedTo) &&
      `Ngày tạo ${f.custCreatedFrom || "…"} – ${f.custCreatedTo || "…"}`,
  ].filter(Boolean);
  return parts.join(", ") || "Chưa dùng";
}

/**
 * Thanh tìm + cấu hình kiểu Vercel (backoffice-erp-ui §2–3): hàng tìm chỉ có ô tìm; nút "Lọc trạng thái" + "Ẩn hiện cột"
 * nằm đầu thanh cấu hình. BE nhận MỘT trạng thái → tick là chọn một, tick lại = "Tất cả".
 */
export function CustomerListToolbar({
  filters,
  columns,
}: {
  filters: CustomerListFilters;
  columns: ColumnVisibility<CustomerColumn>;
}) {
  const { status } = filters;
  const q = filters.filters.q;
  return (
    <ListToolbar<CustomerApiStatus, never, CustomerColumn>
      {...columnToolbarProps(columns, CUSTOMER_COLUMN_LABELS, CUSTOMER_COLUMNS)}
      controlsIn="summary"
      search={q}
      onSearchChange={(value) => void filters.filters.setQ(value)}
      searchPlaceholder="Tìm theo tên, email, SĐT (+84…) hoặc MST"
      statusOptions={STATUS_OPTIONS}
      // Trạng thái đã lọc được trên header cột → không thêm nút chọn nhanh
      statusInHeader
      selectedStatuses={status ? [status] : []}
      onToggleStatus={(value) => filters.setStatus(status === value ? null : value)}
      onClearStatuses={() => filters.setStatus(null)}
      hasStatusFilter={!!status}
      summaryItems={[
        {
          label: "Tìm kiếm chính",
          value: q.trim() ? `“${q}”` : "Chưa dùng",
          active: q.trim() !== "",
          onClear: () => void filters.filters.setQ(""),
        },
        {
          label: "Tìm trong cột",
          value: columnSearchSummary(filters),
          active: filters.hasColumnFilters,
          onClear: () =>
            filters.setColumnFilter({
              custName: "",
              custTaxCode: "",
              custEmail: "",
              custPhone: "",
              custCreatedFrom: "",
              custCreatedTo: "",
            }),
        },
        {
          label: "Trạng thái",
          value: status ? (STATUS_LABEL_VI[CUSTOMER_STATUS_BY_API[status]] ?? status) : "Tất cả",
          active: !!status,
          onClear: () => filters.setStatus(null),
        },
        columnSummaryItem(columns),
      ]}
      onResetAll={() => {
        filters.clear();
        columns.reset();
      }}
      resetDisabled={!filters.hasFilters && !filters.filters.sort && !columns.hasColumnConfig}
    />
  );
}
