"use client";

import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from "nuqs";

import { PAGE_SIZE } from "@/constants";

import { usePageConfig } from "@/hooks/use-page-config";

import type { QuoteRequestStatus } from "../types";

const STATUS_FILTERS = ["OPEN", "CLOSED", "ALL"] as const;

/** Khoá URL của lọc header cột (tên, khách, SKU, hai khoảng ngày). */
const COLUMN_FILTER_PARSERS = {
  qrName: parseAsString.withDefault(""),
  qrCustomer: parseAsString.withDefault(""),
  qrSku: parseAsString.withDefault(""),
  qrDesignStatus: parseAsString.withDefault(""),
  qrDeliveryFrom: parseAsString.withDefault(""),
  qrDeliveryTo: parseAsString.withDefault(""),
  qrRequestedFrom: parseAsString.withDefault(""),
  qrRequestedTo: parseAsString.withDefault(""),
};
export type QuoteRequestColumnFilterKey = keyof typeof COLUMN_FILTER_PARSERS;

interface PageConfig {
  pageSize: number;
}
const DEFAULT_CONFIG: PageConfig = { pageSize: PAGE_SIZE.md };
const mergeConfig = (stored: Partial<PageConfig>, fallback: PageConfig): PageConfig => ({
  pageSize:
    typeof stored.pageSize === "number" && stored.pageSize > 0
      ? stored.pageSize
      : fallback.pageSize,
});

/**
 * Bộ lọc trên URL (nuqs): `q` (tìm trong trang đang xem), `status` (mặc định `OPEN`; `ALL` = không gửi `status`), `customerId`, `page` (từ 1). Số dòng /
 * trang lưu theo trình duyệt. Đổi bộ lọc → về trang đầu.
 * Không dùng `useServerList`: nó đã đăng ký khoá `status` với bộ parse khác.
 */
export function useQuoteRequestFilters(storageKey: string) {
  const { config, updateConfig } = usePageConfig<PageConfig>(
    storageKey,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsStringLiteral(STATUS_FILTERS).withDefault("OPEN"),
  );
  const [customerId, setCustomerId] = useQueryState("customerId", parseAsString.withDefault(""));
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  // Ô tìm chỉ xét trang đang xem — BE `GET /design-*-quote-requests` không có tham số tìm.
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  // Lọc trên header cột — cũng chỉ xét trang đang xem (BE không có tham số tên / SKU / ngày).
  const [columnFilters, setColumnFilters] = useQueryStates(COLUMN_FILTER_PARSERS);

  const status: QuoteRequestStatus | undefined = statusFilter === "ALL" ? undefined : statusFilter;
  const list = {
    /** Trang BE đánh số từ 0; URL từ 1. */
    apiPage: Math.max(0, page - 1),
    pageSize: config.pageSize,
    goToPage: (zeroBased: number) => void setPage(zeroBased + 1),
    changePageSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setPage(1);
    },
  };
  return {
    list,
    status,
    statusFilter,
    customerId,
    q,
    setQ: (next: string) => void setQ(next || null),
    columnFilters,
    /** Đặt một hoặc nhiều lọc cột cùng lúc (khoảng ngày đổi cả hai đầu); chuỗi rỗng = bỏ khỏi URL. */
    setColumnFilter: (values: Partial<Record<QuoteRequestColumnFilterKey, string>>) =>
      void setColumnFilters(
        Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value || null])),
      ),
    setStatus: (next: QuoteRequestStatus | null) => {
      void setStatusFilter(next ?? "ALL");
      void setPage(1);
    },
    setCustomerId: (next: string) => {
      void setCustomerId(next || null);
      void setPage(1);
    },
    clear: () => {
      void setQ(null);
      void setColumnFilters(null);
      void setStatusFilter(null);
      void setCustomerId(null);
      void setPage(1);
    },
  };
}

export type QuoteRequestFilters = ReturnType<typeof useQuoteRequestFilters>;
