"use client";

import {
  ColumnFilterButton,
  HeaderDateRangeFilter,
  HeaderOptionFilter,
} from "@/components/shared/ColumnHeaderFilter";

import { SALES_OWNER_LABELS } from "@/constants/labels-sales-owner";

import { STATUS_OPTIONS } from "./list-columns";
import { OWNER_FILTER_MINE, OWNER_FILTER_NEEDS } from "./useCustomerListFilters";

import type { ReactNode } from "react";
import type { SalesOption } from "@/lib/references/sales-workload";
import type { CustomerListFilters } from "./useCustomerListFilters";

/** Lựa chọn lọc cột "Sale phụ trách": khách của tôi, cần giao, rồi từng Sale (BR-S11). */
export function ownerFilterOptions(sales: readonly SalesOption[]) {
  return [
    { value: OWNER_FILTER_MINE, label: SALES_OWNER_LABELS.list.mine },
    { value: OWNER_FILTER_NEEDS, label: SALES_OWNER_LABELS.list.needsAssignment },
    ...sales.map((option) => ({ value: option.userId, label: option.name })),
  ];
}

/**
 * Lọc trên header cột (backoffice-erp-ui §5) của danh sách khách hàng:
 * - Trạng thái → `status` của BE (MỘT giá trị: chọn một), cùng khoá URL với bảng "Bộ lọc".
 * - Khách hàng / Mã số thuế / Email / Điện thoại (gõ chữ) → BE thu hẹp bằng `q`, FE lọc đúng cột trên trang đang xem.
 * - Ngày tạo (khoảng ngày) → BE không có tham số, chỉ lọc trang đang xem.
 * - Sale phụ trách → BE `mine` / `salesOwnerState` / `salesOwnerId` (chọn một, khoá URL `owner`).
 */
export function customerHeaderFilters(
  filters: CustomerListFilters,
  sales: readonly SalesOption[] = [],
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
    taxCode: (
      <ColumnFilterButton
        label="mã số thuế"
        value={f.custTaxCode}
        placeholder="Tìm theo mã số thuế…"
        onChange={(value) => set({ custTaxCode: value })}
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
    salesOwner: (
      <HeaderOptionFilter
        label="sale phụ trách"
        value={filters.owner || null}
        options={ownerFilterOptions(sales)}
        onChange={(value) => filters.setOwner(value ?? "")}
        searchPlaceholder="Tìm Sale…"
        emptyLabel="Không có Sale"
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
