"use client";

import { parseAsString, useQueryStates } from "nuqs";

import { CUSTOMER_API_STATUSES, STORAGE_KEYS } from "@/constants";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useServerList } from "@/hooks/use-server-list";
import { toLocalIsoDate } from "@/lib/format/date";
import { textIncludes } from "@/lib/text-match";

import type { CustomerApiStatus } from "@/constants";
import type { Customer } from "@/features/customer/types";

/** Khoá URL của lọc header cột — tách khỏi ô tìm chính (`q`), không trùng `status` / `page` / `sort`. */
const COLUMN_FILTER_PARSERS = {
  custName: parseAsString.withDefault(""),
  custEmail: parseAsString.withDefault(""),
  custPhone: parseAsString.withDefault(""),
  custCreatedFrom: parseAsString.withDefault(""),
  custCreatedTo: parseAsString.withDefault(""),
};
export type CustomerColumnFilterKey = keyof typeof COLUMN_FILTER_PARSERS;

const inRange = (date: string, from: string, to: string) =>
  (!from || date >= from) && (!to || date <= to);

/**
 * Bộ lọc danh sách khách hàng (state-persistence): ô tìm / trạng thái / trang / sort qua `useServerList`, lọc header cột
 * trên URL (nuqs). BE `GET /customers` chỉ có một `q` (tên / email / SĐT / MST) và MỘT `status`:
 * - ô tìm chính ưu tiên gửi `q`; trống thì gửi chữ của ô lọc cột để BE thu hẹp, rồi lọc đúng cột ở FE;
 * - khoảng ngày tạo không có tham số BE → chỉ lọc trang đang xem (`rowFilter`, chú thích bảng nói rõ).
 */
export function useCustomerListFilters() {
  const list = useServerList(STORAGE_KEYS.adminCustomersConfig, CUSTOMER_API_STATUSES);
  const { filters } = list;
  const [columnFilters, setColumnFilters] = useQueryStates(COLUMN_FILTER_PARSERS);
  const name = useDebouncedValue(columnFilters.custName, 300).trim();
  const email = useDebouncedValue(columnFilters.custEmail, 300).trim();
  const phone = useDebouncedValue(columnFilters.custPhone, 300).trim();
  const { custCreatedFrom: createdFrom, custCreatedTo: createdTo } = columnFilters;
  // BE nhận MỘT trạng thái (CustomerStatus.valueOf) → lọc trạng thái chọn đơn.
  const status: CustomerApiStatus | undefined = filters.status[0];
  const hasColumnFilters = Object.values(columnFilters).some((value) => value.trim() !== "");

  return {
    list,
    filters,
    status,
    columnFilters,
    /** `q` gửi BE: ô tìm chính, không có thì chữ của ô lọc cột đầu tiên đang dùng. */
    serverQ: filters.debouncedQ.trim() || name || email || phone || undefined,
    hasColumnFilters,
    hasFilters: list.hasBaseFilters || hasColumnFilters,
    setStatus: (next: CustomerApiStatus | null) => void filters.setStatus(next ? [next] : []),
    /** Đặt một hoặc nhiều lọc cột (khoảng ngày đổi cả hai đầu); chuỗi rỗng = bỏ khỏi URL. Về trang 1. */
    setColumnFilter: (values: Partial<Record<CustomerColumnFilterKey, string>>) => {
      void setColumnFilters(
        Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value || null])),
      );
      void filters.setPage(1);
    },
    /** Dòng khớp lọc cột (chỉ xét trang đang xem). */
    matches: (row: Customer) =>
      textIncludes(row.fullName, name) &&
      textIncludes(row.email, email) &&
      textIncludes(row.phone ?? "", phone) &&
      inRange(toLocalIsoDate(row.createdAt), createdFrom, createdTo),
    clear: () => {
      filters.reset();
      void setColumnFilters(null);
    },
  };
}

export type CustomerListFilters = ReturnType<typeof useCustomerListFilters>;
