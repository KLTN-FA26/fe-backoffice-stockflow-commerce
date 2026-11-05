import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { ADMIN_ROUTES, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { usePackingQueue } from "@/features/fulfillment/packing-queries";

import { DEFAULT_QUEUE_CONFIG, QUEUE_STATUS_VALUES, mergeQueueConfig } from "./constants";

import type { PackingQueueRow } from "@/features/fulfillment/packing-types";

export type QueueEmptyState = "none" | "no-orders" | "no-match" | "invalid-page";

/**
 * State hàng chờ đóng gói — trang, kho và trạng thái nằm trên URL (nuqs), số dòng / trang trong
 * localStorage (state-persistence.md). BE `GET /fulfillment/packing-queue` nhận `warehouseId` +
 * `status` + `page` + `size`; không có tìm kiếm hay sắp xếp (cũ nhất trước do BE quyết).
 */
export function usePackingQueueState(canRead: boolean) {
  const router = useRouter();
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [warehouseId, setWarehouseId] = useQueryState("warehouse", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState("status", parseAsStringLiteral(QUEUE_STATUS_VALUES));
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminPackingQueueConfig,
    DEFAULT_QUEUE_CONFIG,
    mergeQueueConfig,
  );
  const query = usePackingQueue(
    {
      page: Math.max(0, page - 1),
      size: config.pageSize,
      warehouseId: warehouseId || undefined,
      status: status ?? undefined,
    },
    { enabled: canRead },
  );

  const filtered = !!warehouseId || !!status;
  const data = query.data;
  let emptyState: QueueEmptyState = "none";
  if (data && data.totalElements === 0) emptyState = filtered ? "no-match" : "no-orders";
  else if (data && data.items.length === 0) emptyState = "invalid-page";

  const navigateToDetail = useCallback(
    (row: PackingQueueRow) => router.push(ADMIN_ROUTES.packing.detail(row.taskId)),
    [router],
  );

  return {
    canRead,
    query,
    config,
    emptyState,
    filtered,
    warehouseId,
    status,
    setPage,
    setWarehouseId: (value: string) => {
      void setWarehouseId(value || null);
      void setPage(1);
    },
    setStatus: (value: string) => {
      void setStatus(QUEUE_STATUS_VALUES.find((known) => known === value) ?? null);
      void setPage(1);
    },
    clearFilters: () => {
      void setWarehouseId(null);
      void setStatus(null);
      void setPage(1);
    },
    changePageSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setPage(1);
    },
    navigateToDetail,
  };
}

export type PackingQueueState = ReturnType<typeof usePackingQueueState>;
