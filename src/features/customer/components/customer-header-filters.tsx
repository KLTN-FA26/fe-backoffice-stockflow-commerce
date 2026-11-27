"use client";

import {
  ColumnFilterButton,
  HeaderDateRangeFilter,
  HeaderOptionFilter,
} from "@/components/shared/ColumnHeaderFilter";

import { STATUS_OPTIONS } from "./list-columns";

import type { ReactNode } from "react";
import type { CustomerListFilters } from "./useCustomerListFilters";

/**
 * Lọc trên header cột (backoffice-erp-ui §5) của danh sách khách hàng:
 * - Trạng thái → `status` của BE (MỘT giá trị: chọn một), cùng khoá URL với bảng "Bộ lọc".
 * - Khách hàng / Email / Điện thoại (gõ chữ) → BE thu hẹp bằng `q`, FE lọc đúng cột trên trang đang xem.
 * - Ngày tạo (khoảng ngày) → BE không có tham số, chỉ lọc trang đang xem.
 */
export function customerHeaderFilters(
  filters: CustomerListFilters,
): Partial<Record<string, ReactNode>> {
  const f = filters.columnFilters;
  const set = filters.setColumnFilter;
  return {
    fullName: (
      <ColumnFilterButton
        label="khách hàng"
        value={f.custName}
        placeholder="Tìm theo tên khách hàng…"
        onChange={(value) => set({ custName: value })}
      />
    ),
    email: (
      <ColumnFilterButton
        label="email"
        value={f.custEmail}
        placeholder="Tìm theo email…"
        onChange={(value) => set({ custEmail: value })}
      />
    ),
    phone: (
      <ColumnFilterButton
        label="điện thoại"
        value={f.custPhone}
        placeholder="Tìm theo số điện thoại…"
        onChange={(value) => set({ custPhone: value })}
      />
    ),
    status: (
      <HeaderOptionFilter
        label="trạng thái"
        value={filters.status ?? null}
        options={STATUS_OPTIONS}
        onChange={(value) =>
          filters.setStatus(STATUS_OPTIONS.find((o) => o.value === value)?.value ?? null)
        }
        searchPlaceholder="Tìm trạng thái…"
        emptyLabel="Không có trạng thái"
      />
    ),
    createdAt: (
      <HeaderDateRangeFilter
        label="ngày tạo"
        quickKind="past"
        from={f.custCreatedFrom}
        to={f.custCreatedTo}
        onChange={({ from, to }) => set({ custCreatedFrom: from, custCreatedTo: to })}
      />
    ),
  };
}
