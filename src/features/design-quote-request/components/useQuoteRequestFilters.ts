"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { useServerList } from "@/hooks/use-server-list";

import type { QuoteRequestStatus } from "../types";

const STATUS_FILTERS = ["OPEN", "CLOSED", "ALL"] as const;
const NO_STATUSES: readonly never[] = [];

/**
 * Bộ lọc trên URL (nuqs): trạng thái (mặc định `OPEN`; `ALL` = không gửi `status`) và khách. Đổi bộ lọc → về trang
 * đầu. Danh sách dự án không dùng trạng thái vì BE chưa lọc được (BE-3).
 */
export function useQuoteRequestFilters(storageKey: string) {
  const list = useServerList(storageKey, NO_STATUSES);
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsStringLiteral(STATUS_FILTERS).withDefault("OPEN"),
  );
  const [customerId, setCustomerId] = useQueryState("customerId", parseAsString.withDefault(""));

  const status: QuoteRequestStatus | undefined = statusFilter === "ALL" ? undefined : statusFilter;
  return {
    list,
    status,
    statusFilter,
    customerId,
    setStatus: (next: QuoteRequestStatus | null) => {
      void setStatusFilter(next ?? "ALL");
      list.goToPage(0);
    },
    setCustomerId: (next: string) => {
      void setCustomerId(next || null);
      list.goToPage(0);
    },
    clear: () => {
      void setStatusFilter(null);
      void setCustomerId(null);
      list.goToPage(0);
    },
  };
}
