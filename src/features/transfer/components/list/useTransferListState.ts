import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";

import { ADMIN_ROUTES, STORAGE_KEYS, TRANSFER_COLUMNS, TRANSFER_STATUSES } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useTransferOrders } from "@/features/transfer/queries";

import { DEFAULT_COLUMNS, DEFAULT_CONFIG, mergeStoredConfig } from "./constants";

import type { TransferStatus } from "@/constants";
import type { TransferOrderRow } from "@/features/transfer/types";
import type { TransferPageConfig } from "./constants";

/** BE `@RequestParam UUID` → giá trị không phải UUID trả 400; bỏ qua thay vì báo "không tìm thấy". */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (value: string) => (UUID.test(value) ? value : "");

export type TransferListEmptyState = "none" | "no-transfers" | "no-results" | "invalid-page";

const ACTIONS = TRANSFER_COLUMNS.ACTIONS;

/**
 * State danh sách lệnh chuyển kho — search / trạng thái / kho nguồn / kho đích / trang trên URL
 * (nuqs), cột + số dòng trong localStorage (state-persistence.md). BE sắp xếp cố định ngày tạo
 * giảm dần, không nhận `sort`.
 */
export function useTransferListState(canRead = true) {
  const router = useRouter();
  const filters = useUrlFilters(TRANSFER_STATUSES);
  const [fromRaw, setFrom] = useQueryState("from", parseAsString.withDefault(""));
  const [toRaw, setTo] = useQueryState("to", parseAsString.withDefault(""));
  const from = asUuid(fromRaw);
  const to = asUuid(toRaw);
  const { config, updateConfig } = usePageConfig<TransferPageConfig>(
    STORAGE_KEYS.adminTransfersConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const query = useTransferOrders(
    {
      page: Math.max(0, filters.page - 1),
      size: config.pageSize,
      search: filters.debouncedQ,
      status: filters.status,
      fromWarehouseId: from || undefined,
      toWarehouseId: to || undefined,
    },
    { enabled: canRead },
  );

  // Tính cả giá trị thô (kể cả không phải UUID) để "Đặt lại" / "Bỏ bộ lọc" xoá được tham số rác
  const hasFilters = filters.q.trim() !== "" || filters.status.length > 0 || !!fromRaw || !!toRaw;
  // Empty state theo đúng tham số của dữ liệu đang hiện: xoá ô search → 300ms debounce + lúc tải,
  // trang cũ (0 kết quả của từ khoá cũ) vẫn hiện — không được báo "chưa có lệnh" + nút tạo đầu tiên
  const dataHasFilters =
    filters.debouncedQ.trim() !== "" || filters.status.length > 0 || !!fromRaw || !!toRaw;
  const page = query.data;
  const emptyState: TransferListEmptyState = !page
    ? "none"
    : page.totalElements === 0
      ? dataHasFilters
        ? "no-results"
        : "no-transfers"
      : page.items.length === 0
        ? "invalid-page"
        : "none";

  const navigateToDetail = useCallback(
    (row: TransferOrderRow) => router.push(ADMIN_ROUTES.transfers.detail(row.transferId)),
    [router],
  );

  const withPageReset = (apply: () => unknown) => {
    void apply();
    void filters.setPage(1);
  };

  const toggleStatus = (status: TransferStatus) =>
    filters.setStatus(
      filters.status.includes(status)
        ? filters.status.filter((x) => x !== status)
        : [...filters.status, status],
    );

  const toggleColumn = (column: string) => {
    if (column === ACTIONS) return;
    updateConfig((c) => {
      const next = c.visibleColumns.includes(column)
        ? c.visibleColumns.filter((x) => x !== column)
        : [...c.visibleColumns, column];
      return { ...c, visibleColumns: next.includes(ACTIONS) ? next : [...next, ACTIONS] };
    });
  };

  const changePageSize = (pageSize: number) => {
    updateConfig((c) => ({ ...c, pageSize }));
    void filters.setPage(1);
  };

  const clearFilters = () => {
    filters.reset();
    void setFrom(null);
    void setTo(null);
  };

  const visibleColumnCount = config.visibleColumns.filter((c) => c !== ACTIONS).length;

  return {
    canRead,
    query,
    config,
    filters,
    from,
    to,
    setFrom: (value: string) => withPageReset(() => setFrom(value || null)),
    setTo: (value: string) => withPageReset(() => setTo(value || null)),
    hasFilters,
    emptyState,
    visibleColumnCount,
    hasColumnConfig: visibleColumnCount !== DEFAULT_COLUMNS.length - 1,
    /** Có gì để "Đặt lại" (resetAll cũng đưa số dòng / trang về mặc định). */
    canResetAll:
      hasFilters ||
      visibleColumnCount !== DEFAULT_COLUMNS.length - 1 ||
      config.pageSize !== DEFAULT_CONFIG.pageSize,
    updateConfig,
    navigateToDetail,
    toggleStatus,
    toggleColumn,
    changePageSize,
    clearFilters,
    resetAll: () => {
      updateConfig(() => DEFAULT_CONFIG);
      clearFilters();
    },
  };
}

export type TransferListState = ReturnType<typeof useTransferListState>;
