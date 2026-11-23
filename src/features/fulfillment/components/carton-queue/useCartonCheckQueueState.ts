import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";

import { STORAGE_KEYS, WORKSPACE_PATHS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useWorkspaceHref, useWorkspaceWarehouse } from "@/lib/workspace";
import { useCartonCheckQueue } from "@/features/fulfillment/carton-check-queries";

import { DEFAULT_QUEUE_CONFIG, QUEUE_STATUS_VALUES, mergeQueueConfig } from "./constants";

import type { CartonCheckQueueRow } from "@/features/fulfillment/carton-check-types";

export type QueueEmptyState = "none" | "no-orders" | "no-match" | "invalid-page";

/**
 * State hàng chờ kiểm thùng — trang và trạng thái nằm trên URL (nuqs), số dòng / trang trong localStorage
 * (state-persistence.md); kho là kho của tab theo kho (spec 2026-11-22). BE `GET /fulfillment/packing-queue` nhận
 * `warehouseId` + `status` + `page` + `size`; không có tìm kiếm hay sắp xếp (cũ nhất trước do BE quyết).
 */
export function useCartonCheckQueueState(canRead: boolean) {
  const router = useRouter();
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const warehouseId = useWorkspaceWarehouse().id;
  const href = useWorkspaceHref();
  const [status, setStatus] = useQueryState("status", parseAsStringLiteral(QUEUE_STATUS_VALUES));
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminPackingQueueConfig,
    DEFAULT_QUEUE_CONFIG,
    mergeQueueConfig,
  );
  const query = useCartonCheckQueue(
    {
      page: Math.max(0, page - 1),
      size: config.pageSize,
      warehouseId,
      status: status ?? undefined,
    },
    { enabled: canRead },
  );

  const filtered = !!status;
  const data = query.data;
  let emptyState: QueueEmptyState = "none";
  if (data && data.totalElements === 0) emptyState = filtered ? "no-match" : "no-orders";
  else if (data && data.items.length === 0) emptyState = "invalid-page";

  const navigateToDetail = useCallback(
    (row: CartonCheckQueueRow) => router.push(href(WORKSPACE_PATHS.packingTask(row.taskId))),
    [router, href],
  );

  return {
    canRead,
    query,
    config,
    emptyState,
    filtered,
    status,
    /** Link trạm kiểm thùng của một task trong tab theo kho. */
    detailHref: (taskId: string) => href(WORKSPACE_PATHS.packingTask(taskId)),
    setPage,
    setStatus: (value: string) => {
      void setStatus(QUEUE_STATUS_VALUES.find((known) => known === value) ?? null);
      void setPage(1);
    },
    clearFilters: () => {
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

export type CartonCheckQueueState = ReturnType<typeof useCartonCheckQueueState>;
