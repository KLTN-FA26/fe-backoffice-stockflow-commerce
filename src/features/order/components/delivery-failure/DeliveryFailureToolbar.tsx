"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import {
  DELIVERY_FAILURE_CASE_STATUSES,
  DELIVERY_FAILURE_LABELS,
  ORDER_DELIVERY_FAILURE_LABELS,
  ORDER_DELIVERY_FAILURE_REASONS,
} from "@/constants";
import { useColumnTextFilters } from "@/hooks/use-column-text-filters";
import { columnSummaryItem, columnToolbarProps } from "@/hooks/use-column-visibility";

import { ColumnFilterButton, HeaderOptionFilter } from "@/components/shared/ColumnHeaderFilter";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { DELIVERY_FAILURE_FILTER_KEYS } from "../../list-filters";

import { DELIVERY_FAILURE_COLUMN_LABELS, DELIVERY_FAILURE_COLUMNS } from "./columns";

import type { ColumnVisibility } from "@/hooks/use-column-visibility";
import type { ReactNode } from "react";
import type { DeliveryFailureFilterKey } from "../../list-filters";
import type { DeliveryFailureColumn } from "./columns";

const L = DELIVERY_FAILURE_LABELS;
type CaseStatus = (typeof DELIVERY_FAILURE_CASE_STATUSES)[number];

const FILTER_LABELS: Record<DeliveryFailureFilterKey, string> = {
  dfOrder: L.columns.order,
  dfReceipt: L.columns.receipt,
  dfReason: L.columns.reason,
};
const STATUS_OPTIONS = DELIVERY_FAILURE_CASE_STATUSES.map((value) => ({
  value,
  label: L.statusLabels[value],
}));
const REASON_OPTIONS = ORDER_DELIVERY_FAILURE_REASONS.map((value) => ({
  value,
  label: ORDER_DELIVERY_FAILURE_LABELS[value],
}));
const reasonLabel = (code: string) =>
  REASON_OPTIONS.find((option) => option.value === code)?.label ?? code;

/**
 * Bộ lọc trên URL: `status` gửi BE (`GET /orders/delivery-failures?status`, một giá trị); ô tìm `q` + lọc cột chạy ở FE
 * trên mọi hồ sơ đã tải (BE trả cả danh sách, không phân trang).
 */
export function useDeliveryFailureFilters() {
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(DELIVERY_FAILURE_CASE_STATUSES),
  );
  const columns = useColumnTextFilters(DELIVERY_FAILURE_FILTER_KEYS);
  const rowFilterActive = q.trim() !== "" || columns.active;
  return {
    q,
    setQ: (next: string) => void setQ(next || null),
    status,
    setStatus: (next: CaseStatus | null) => void setStatus(next),
    columns,
    rowFilterActive,
    active: rowFilterActive || status !== null,
    clear: () => {
      void setQ(null);
      void setStatus(null);
      columns.clear();
    },
  };
}
export type DeliveryFailureFilters = ReturnType<typeof useDeliveryFailureFilters>;

/** Nút lọc trên header cột Đơn hàng, Phiếu nhận hàng hoàn (gõ chữ) và Lý do (chọn một mã). */
export function deliveryFailureHeaderFilters(
  filters: DeliveryFailureFilters,
): Partial<Record<DeliveryFailureColumn, ReactNode>> {
  const { values, set } = filters.columns;
  const text = (key: "dfOrder" | "dfReceipt") => (
    <ColumnFilterButton
      label={FILTER_LABELS[key].toLocaleLowerCase("vi")}
      value={values[key]}
      placeholder={L.list.columnSearch(FILTER_LABELS[key])}
      onChange={(value) => set(key, value)}
    />
  );
  return {
    order: text("dfOrder"),
    receipt: text("dfReceipt"),
    reason: (
      <HeaderOptionFilter
        label={L.columns.reason.toLocaleLowerCase("vi")}
        value={values.dfReason || null}
        options={REASON_OPTIONS}
        onChange={(value) => set("dfReason", value ?? "")}
        searchPlaceholder={L.list.reasonSearch}
        emptyLabel={L.list.reasonEmpty}
      />
    ),
  };
}

/** Toolbar kiểu Vercel: ô tìm, hàng chip (Bộ lọc trạng thái, Ẩn hiện cột, chip cấu hình), Đặt lại. */
export function DeliveryFailureToolbar({
  filters,
  columns,
}: {
  filters: DeliveryFailureFilters;
  columns: ColumnVisibility<DeliveryFailureColumn>;
}) {
  return (
    <ListToolbar<CaseStatus, never, DeliveryFailureColumn>
      {...columnToolbarProps(columns, DELIVERY_FAILURE_COLUMN_LABELS, DELIVERY_FAILURE_COLUMNS)}
      controlsIn="summary"
      search={filters.q}
      onSearchChange={filters.setQ}
      searchPlaceholder={L.list.search}
      statusOptions={STATUS_OPTIONS}
      selectedStatuses={filters.status ? [filters.status] : []}
      // BE nhận MỘT trạng thái: tick là chọn một, tick lại = "Tất cả"
      onToggleStatus={(value) => filters.setStatus(filters.status === value ? null : value)}
      onClearStatuses={() => filters.setStatus(null)}
      hasStatusFilter={filters.status !== null}
      summaryItems={[
        {
          label: L.list.statusFilter,
          value: filters.status ? L.statusLabels[filters.status] : L.list.statusAll,
          active: filters.status !== null,
          onClear: () => filters.setStatus(null),
        },
        filters.columns.summaryItem(FILTER_LABELS, { dfReason: reasonLabel }),
        columnSummaryItem(columns),
      ]}
      onResetAll={() => {
        filters.clear();
        columns.reset();
      }}
      resetDisabled={!filters.active && !columns.hasColumnConfig}
    />
  );
}
