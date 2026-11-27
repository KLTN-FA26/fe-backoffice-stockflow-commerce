"use client";

import { parseAsString, useQueryState, useQueryStates } from "nuqs";

import { QUOTE_API_STATUSES, STORAGE_KEYS } from "@/constants";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useServerList } from "@/hooks/use-server-list";
import { toLocalIsoDate } from "@/lib/format/date";
import { textIncludes } from "@/lib/text-match";

import { usePriceReviewFilter } from "./price-review/usePriceReviewFilter";

import type { QuoteRow } from "@/features/quote/types";

/** Khoá URL của lọc header cột — tách khỏi ô tìm chính (`q`), không trùng `status` / `customerId` / `page` / `sort`. */
const COLUMN_FILTER_PARSERS = {
  qtNumber: parseAsString.withDefault(""),
  qtValidFrom: parseAsString.withDefault(""),
  qtValidTo: parseAsString.withDefault(""),
  qtSentFrom: parseAsString.withDefault(""),
  qtSentTo: parseAsString.withDefault(""),
  qtTotalFrom: parseAsString.withDefault(""),
  qtTotalTo: parseAsString.withDefault(""),
  /** "yes" = đã tạo đơn, "no" = chưa. */
  qtOrder: parseAsString.withDefault(""),
};
export type QuoteColumnFilterKey = keyof typeof COLUMN_FILTER_PARSERS;
const NO_COLUMN_FILTERS = Object.fromEntries(
  Object.keys(COLUMN_FILTER_PARSERS).map((key) => [key, ""]),
) as Record<QuoteColumnFilterKey, string>;

const inRange = (date: string, from: string, to: string) =>
  (!from || date >= from) && (!to || date <= to);

/**
 * Bộ lọc danh sách báo giá (state-persistence): ô tìm / trạng thái (nhiều) / trang / sort qua `useServerList`, khách và
 * "Chờ duyệt giá" là tham số BE trên URL, lọc header cột trên URL (nuqs). BE `GET /quotes` có `search` (số báo giá):
 * ô tìm chính ưu tiên; trống thì gửi chữ của ô lọc cột Số báo giá. Hai khoảng ngày (hiệu lực, ngày gửi) không có tham số
 * BE, tổng có thuế, đơn đã tạo → chỉ lọc trang đang xem (`rowFilter`, chú thích bảng nói rõ).
 */
export function useQuoteListFilters() {
  const list = useServerList(STORAGE_KEYS.adminQuotesConfig, QUOTE_API_STATUSES);
  const { filters } = list;
  const [customerId, setCustomerIdState] = useQueryState(
    "customerId",
    parseAsString.withDefault(""),
  );
  const priceReview = usePriceReviewFilter(() => void filters.setPage(1));
  const [columnFilters, setColumnFilters] = useQueryStates(COLUMN_FILTER_PARSERS);
  const number = useDebouncedValue(columnFilters.qtNumber, 300).trim();
  const f = columnFilters;
  const hasColumnFilters = Object.values(columnFilters).some((value) => value.trim() !== "");
  const pageOnly = Boolean(
    f.qtValidFrom ||
    f.qtValidTo ||
    f.qtSentFrom ||
    f.qtSentTo ||
    f.qtTotalFrom ||
    f.qtTotalTo ||
    f.qtOrder,
  );
  const totalFrom = f.qtTotalFrom === "" ? null : Number(f.qtTotalFrom);
  const totalTo = f.qtTotalTo === "" ? null : Number(f.qtTotalTo);

  return {
    list,
    filters,
    customerId,
    priceReview,
    columnFilters,
    serverSearch: filters.debouncedQ.trim() || number || undefined,
    hasColumnFilters,
    hasFilters: list.hasBaseFilters || !!customerId || !!priceReview.value || hasColumnFilters,
    setCustomerId: (next: string) => {
      void setCustomerIdState(next || null);
      void filters.setPage(1);
    },
    /** Đặt một hoặc nhiều lọc cột (khoảng ngày đổi cả hai đầu); chuỗi rỗng = bỏ khỏi URL. Về trang 1. */
    setColumnFilter: (values: Partial<Record<QuoteColumnFilterKey, string>>) => {
      void setColumnFilters(
        Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value || null])),
      );
      void filters.setPage(1);
    },
    clearColumnFilters: () => void setColumnFilters(NO_COLUMN_FILTERS),
    /** Lọc FE trên trang đang xem: số báo giá khớp đúng cột, hai khoảng ngày. */
    rowFilter: {
      active: !!number || pageOnly,
      match: (row: QuoteRow) =>
        textIncludes(row.quoteNumber, number) &&
        inRange(row.validUntil.slice(0, 10), f.qtValidFrom, f.qtValidTo) &&
        (!(f.qtSentFrom || f.qtSentTo) ||
          (row.sentAt != null && inRange(toLocalIsoDate(row.sentAt), f.qtSentFrom, f.qtSentTo))) &&
        // Chưa đủ giá (`total` null) không khớp khi đang lọc tổng
        ((totalFrom === null && totalTo === null) ||
          (row.total != null &&
            (totalFrom === null || row.total >= totalFrom) &&
            (totalTo === null || row.total <= totalTo))) &&
        (f.qtOrder === "" || (f.qtOrder === "yes") === (row.convertedOrderId != null)),
    },
    clear: () => {
      filters.reset();
      void setCustomerIdState(null);
      priceReview.clear();
      void setColumnFilters(null);
    },
  };
}

export type QuoteListFilters = ReturnType<typeof useQuoteListFilters>;
