"use client";

import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import {
  ColumnFilterButton,
  HeaderDateRangeFilter,
  HeaderFilterPopover,
  HeaderMultiOptionFilter,
  HeaderNumberRangeFilter,
  HeaderOptionFilter,
} from "@/components/shared/ColumnHeaderFilter";

import { STATUS_OPTIONS } from "./list-columns";

import type { ReactNode } from "react";
import type { QuoteListFilters } from "./useQuoteListFilters";

/**
 * Lọc trên header cột (backoffice-erp-ui §5) của danh sách báo giá:
 * - Trạng thái → `status` của BE (chọn NHIỀU, gửi lặp tham số), cùng khoá URL với bảng "Bộ lọc".
 * - Số báo giá (gõ chữ) → BE thu hẹp bằng `search`, FE lọc đúng cột trên trang đang xem.
 * - Khách hàng → `customerId` của BE (cùng khoá URL với bảng "Bộ lọc").
 * - Hiệu lực đến / Ngày gửi (khoảng ngày), Tổng có thuế (khoảng), Đơn đã tạo (có / chưa) → BE không có tham số, chỉ lọc
 *   trang đang xem.
 */
const ORDER_OPTIONS = [
  { value: "yes", label: "Đã tạo đơn" },
  { value: "no", label: "Chưa tạo đơn" },
];

export function quoteHeaderFilters(state: QuoteListFilters): Partial<Record<string, ReactNode>> {
  const f = state.columnFilters;
  const set = state.setColumnFilter;
  const statuses = state.filters.status;
  return {
    quoteNumber: (
      <ColumnFilterButton
        label="số báo giá"
        value={f.qtNumber}
        placeholder="Tìm theo số báo giá…"
        onChange={(value) => set({ qtNumber: value })}
      />
    ),
    status: (
      <HeaderMultiOptionFilter
        label="trạng thái"
        values={statuses}
        options={STATUS_OPTIONS}
        onToggle={(value) => {
          const status = STATUS_OPTIONS.find((o) => o.value === value)?.value;
          if (status) state.list.toggleStatus(status);
        }}
        onClear={() => void state.filters.setStatus([])}
        searchPlaceholder="Tìm trạng thái…"
        emptyLabel="Không có trạng thái"
      />
    ),
    customer: (
      <HeaderFilterPopover
        label="khách hàng"
        active={!!state.customerId}
        onClear={() => state.setCustomerId("")}
        className="w-80"
      >
        <div className="px-1 pt-1">
          <CustomerPicker
            idPrefix="quote-header"
            value={state.customerId}
            onChange={state.setCustomerId}
            mode="filter"
          />
        </div>
      </HeaderFilterPopover>
    ),
    total: (
      <HeaderNumberRangeFilter
        label="tổng có thuế"
        unit="₫"
        from={f.qtTotalFrom}
        to={f.qtTotalTo}
        onChange={({ from, to }) => set({ qtTotalFrom: from, qtTotalTo: to })}
      />
    ),
    order: (
      <HeaderOptionFilter
        label="đơn đã tạo"
        value={f.qtOrder || null}
        options={ORDER_OPTIONS}
        onChange={(value) => set({ qtOrder: value ?? "" })}
        searchPlaceholder="Tìm…"
        emptyLabel="Không có lựa chọn"
      />
    ),
    validUntil: (
      <HeaderDateRangeFilter
        label="hiệu lực đến"
        from={f.qtValidFrom}
        to={f.qtValidTo}
        onChange={({ from, to }) => set({ qtValidFrom: from, qtValidTo: to })}
      />
    ),
    sentAt: (
      <HeaderDateRangeFilter
        label="ngày gửi"
        from={f.qtSentFrom}
        to={f.qtSentTo}
        onChange={({ from, to }) => set({ qtSentFrom: from, qtSentTo: to })}
      />
    ),
  };
}
