"use client";

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { PAGE_SIZE } from "@/constants";

import { usePageConfig } from "@/hooks/use-page-config";

import type { QuoteRequestStatus } from "../types";

const STATUS_FILTERS = ["OPEN", "CLOSED", "ALL"] as const;

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
 * Bộ lọc trên URL (nuqs): `status` (mặc định `OPEN`; `ALL` = không gửi `status`), `customerId`, `page` (từ 1). Số dòng /
 * trang lưu theo trình duyệt. Đổi bộ lọc → về trang đầu. Danh sách dự án không dùng trạng thái vì BE chưa lọc được (BE-3).
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
    setStatus: (next: QuoteRequestStatus | null) => {
      void setStatusFilter(next ?? "ALL");
      void setPage(1);
    },
    setCustomerId: (next: string) => {
      void setCustomerId(next || null);
      void setPage(1);
    },
    clear: () => {
      void setStatusFilter(null);
      void setCustomerId(null);
      void setPage(1);
    },
  };
}
