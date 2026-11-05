import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { ADMIN_ROUTES, STORAGE_KEYS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePageConfig } from "@/hooks/use-page-config";
import { useLoads } from "@/features/shipping/queries";

import {
  DEFAULT_CONFIG,
  LOAD_MODE_FILTERS,
  LOAD_STATUS_FILTERS,
  mergeStoredConfig,
} from "./constants";

import type { LoadRow } from "@/features/shipping/types";

export type LoadListEmptyState = "none" | "no-loads" | "no-results" | "invalid-page";

/** State danh sách chuyến xe — trang, tìm kiếm, trạng thái, kho, hãng trên URL; số dòng / trang ở localStorage. */
export function useLoadListState(canRead: boolean) {
  const router = useRouter();
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(LOAD_STATUS_FILTERS).withDefault("ALL"),
  );
  const [mode, setMode] = useQueryState(
    "mode",
    parseAsStringLiteral(LOAD_MODE_FILTERS).withDefault("ALL"),
  );
  const [warehouseId, setWarehouseId] = useQueryState("warehouse", parseAsString.withDefault(""));
  const [carrierId, setCarrierId] = useQueryState("carrier", parseAsString.withDefault(""));
  const debouncedQ = useDebouncedValue(q, 300);
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminLoadsConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const query = useLoads(
    {
      page: Math.max(0, page - 1),
      size: config.pageSize,
      search: debouncedQ,
      status: status === "ALL" ? undefined : status,
      mode: mode === "ALL" ? undefined : mode,
      warehouseId: warehouseId || undefined,
      carrierId: carrierId || undefined,
    },
    { enabled: canRead },
  );

  const hasFilters =
    q.trim() !== "" || status !== "ALL" || mode !== "ALL" || warehouseId !== "" || carrierId !== "";
  // Empty state theo tham số của dữ liệu đang hiện (search sau debounce)
  const dataFiltered =
    debouncedQ.trim() !== "" || status !== "ALL" || mode !== "ALL" || !!warehouseId || !!carrierId;
  const data = query.data;
  let emptyState: LoadListEmptyState = "none";
  if (data && data.totalElements === 0) emptyState = dataFiltered ? "no-results" : "no-loads";
  else if (data && data.items.length === 0) emptyState = "invalid-page";

  const navigateToLoad = useCallback(
    (row: LoadRow) => router.push(ADMIN_ROUTES.loads.detail(row.loadId)),
    [router],
  );

  const filter = <T>(setter: (value: T) => unknown) => {
    return (value: T) => {
      void setter(value);
      void setPage(1);
    };
  };

  return {
    canRead,
    query,
    config,
    q,
    status,
    mode,
    warehouseId,
    carrierId,
    hasFilters,
    emptyState,
    setPage: (value: number) => void setPage(value),
    setQ: filter((value: string) => setQ(value)),
    setStatus: filter((value: string) =>
      setStatus(LOAD_STATUS_FILTERS.find((known) => known === value) ?? "ALL"),
    ),
    setMode: filter((value: string) =>
      setMode(LOAD_MODE_FILTERS.find((known) => known === value) ?? "ALL"),
    ),
    setWarehouseId: filter((value: string) => setWarehouseId(value || null)),
    setCarrierId: filter((value: string) => setCarrierId(value || null)),
    navigateToLoad,
    changePageSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setPage(1);
    },
    clearFilters: () => {
      void setQ(null);
      void setStatus(null);
      void setMode(null);
      void setWarehouseId(null);
      void setCarrierId(null);
      void setPage(1);
    },
  };
}

export type LoadListState = ReturnType<typeof useLoadListState>;
