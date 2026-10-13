import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";

import { ADMIN_ROUTES, RECEIPT_COLUMNS, RECEIPT_STATUSES, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useGoodsReceipts } from "@/features/receipt/queries";

import {
  DEFAULT_COLUMNS,
  DEFAULT_CONFIG,
  SERVER_SORT_FIELDS,
  mergeStoredConfig,
} from "./constants";

import type { ReceiptStatus } from "@/constants";
import type { GoodsReceiptRow } from "@/features/receipt/types";
import type { ReceiptPageConfig, SortableColumn } from "./constants";

type SortDir = "asc" | "desc";

export type ReceiptListEmptyState = "none" | "no-receipts" | "no-results" | "invalid-page";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isSortable(value: string): value is SortableColumn {
  return value in SERVER_SORT_FIELDS;
}

/** URL `sort=receivedAt,asc` → cột đang sort; field BE trùng key cột hoặc map qua SERVER_SORT_FIELDS. */
function parseSort(raw: string): { key: SortableColumn | null; direction: SortDir } {
  const [field = "", dir] = raw.split(",");
  const key = (Object.keys(SERVER_SORT_FIELDS) as SortableColumn[]).find(
    (column) => SERVER_SORT_FIELDS[column] === field,
  );
  return { key: key ?? null, direction: dir === "asc" ? "asc" : "desc" };
}

/**
 * State trang danh sách phiếu nhận — status/search/PO/ngày/sort/page trên URL (nuqs), cột + số
 * dòng trong localStorage (state-persistence.md). Lọc / sắp xếp / phân trang phía server (PR #62).
 */
export function useReceiptListState(canRead = true) {
  const router = useRouter();
  const filters = useUrlFilters(RECEIPT_STATUSES);
  const [po, setPo] = useQueryState("po", parseAsString.withDefault(""));
  const [from, setFrom] = useQueryState("from", parseAsString.withDefault(""));
  const [to, setTo] = useQueryState("to", parseAsString.withDefault(""));
  const { config, updateConfig } = usePageConfig<ReceiptPageConfig>(
    STORAGE_KEYS.adminReceiptsConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const sort = parseSort(filters.sort);
  const receivedFrom = ISO_DAY.test(from) ? from : "";
  const receivedTo = ISO_DAY.test(to) ? to : "";
  const query = useGoodsReceipts(
    {
      page: Math.max(0, filters.page - 1),
      size: config.pageSize,
      search: filters.debouncedQ,
      status: filters.status,
      purchaseOrderId: po || undefined,
      receivedFrom: receivedFrom || undefined,
      receivedTo: receivedTo || undefined,
      sort: sort.key ? `${SERVER_SORT_FIELDS[sort.key]},${sort.direction}` : undefined,
    },
    { enabled: canRead },
  );

  const hasFilters =
    filters.q.trim() !== "" || filters.status.length > 0 || !!po || !!receivedFrom || !!receivedTo;
  const page = query.data;
  const emptyState: ReceiptListEmptyState = !page
    ? "none"
    : page.totalElements === 0
      ? hasFilters
        ? "no-results"
        : "no-receipts"
      : page.items.length === 0
        ? "invalid-page"
        : "none";

  const navigateToDetail = useCallback(
    (row: GoodsReceiptRow) => router.push(ADMIN_ROUTES.receipts.detail(row.id)),
    [router],
  );

  const withPageReset = (apply: () => unknown) => {
    void apply();
    void filters.setPage(1);
  };

  const toggleStatus = (status: ReceiptStatus) =>
    filters.setStatus(
      filters.status.includes(status)
        ? filters.status.filter((x) => x !== status)
        : [...filters.status, status],
    );

  const toggleColumn = (column: string) => {
    if (column === RECEIPT_COLUMNS.ACTIONS) return;
    updateConfig((c) => {
      const next = c.visibleColumns.includes(column)
        ? c.visibleColumns.filter((x) => x !== column)
        : [...c.visibleColumns, column];
      return {
        ...c,
        visibleColumns: next.includes(RECEIPT_COLUMNS.ACTIONS)
          ? next
          : [...next, RECEIPT_COLUMNS.ACTIONS],
      };
    });
  };

  const changeSort = (key: string, direction: SortDir) => {
    if (!isSortable(key)) return;
    withPageReset(() => filters.setSort(`${SERVER_SORT_FIELDS[key]},${direction}`));
  };

  const changePageSize = (pageSize: number) => {
    updateConfig((c) => ({ ...c, pageSize }));
    void filters.setPage(1);
  };

  /** Bỏ mọi bộ lọc dữ liệu (search, trạng thái, PO, ngày) — giữ cấu hình cột. */
  const clearFilters = () => {
    filters.reset();
    void setPo(null);
    void setFrom(null);
    void setTo(null);
  };

  const resetAll = () => {
    updateConfig(() => DEFAULT_CONFIG);
    clearFilters();
  };

  const visibleColumnCount = config.visibleColumns.filter(
    (c) => c !== RECEIPT_COLUMNS.ACTIONS,
  ).length;

  return {
    canRead,
    query,
    config,
    filters,
    sort,
    po,
    receivedFrom,
    receivedTo,
    setPo: (value: string) => withPageReset(() => setPo(value || null)),
    setFrom: (value: string) => withPageReset(() => setFrom(value || null)),
    setTo: (value: string) => withPageReset(() => setTo(value || null)),
    hasFilters,
    emptyState,
    visibleColumnCount,
    hasColumnConfig: visibleColumnCount !== DEFAULT_COLUMNS.length - 1,
    updateConfig,
    navigateToDetail,
    toggleStatus,
    toggleColumn,
    changeSort,
    changePageSize,
    clearFilters,
    resetAll,
  };
}

export type ReceiptListState = ReturnType<typeof useReceiptListState>;
