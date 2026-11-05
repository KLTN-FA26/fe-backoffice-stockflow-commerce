import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { STORAGE_KEYS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePageConfig } from "@/hooks/use-page-config";
import { useWarehouses } from "@/features/warehouse-map/queries";

import { DEFAULT_CONFIG, mergeStoredConfig, WAREHOUSE_STATUS_FILTERS } from "./constants";

export type WarehouseListEmptyState = "none" | "no-data" | "no-results" | "invalid-page";

/** State danh mục kho — trang, tìm kiếm, trạng thái trên URL; số dòng / trang ở localStorage. */
export function useWarehouseListState(canRead: boolean) {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(WAREHOUSE_STATUS_FILTERS).withDefault("ALL"),
  );
  const debouncedQ = useDebouncedValue(q, 300);
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminWarehousesConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const query = useWarehouses(
    {
      page: Math.max(0, page - 1),
      size: config.pageSize,
      q: debouncedQ,
      status: status === "ALL" ? undefined : status,
    },
    { enabled: canRead },
  );

  const hasFilters = q.trim() !== "" || status !== "ALL";
  // Empty state theo tham số của dữ liệu đang hiện (search sau debounce)
  const dataFiltered = debouncedQ.trim() !== "" || status !== "ALL";
  const data = query.data;
  let emptyState: WarehouseListEmptyState = "none";
  if (data && data.totalElements === 0) emptyState = dataFiltered ? "no-results" : "no-data";
  else if (data && data.items.length === 0) emptyState = "invalid-page";

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
    hasFilters,
    emptyState,
    setPage: (value: number) => void setPage(value),
    setQ: filter((value: string) => setQ(value || null)),
    setStatus: filter((value: string) =>
      setStatus(WAREHOUSE_STATUS_FILTERS.find((known) => known === value) ?? "ALL"),
    ),
    changePageSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setPage(1);
    },
    clearFilters: () => {
      void setQ(null);
      void setStatus(null);
      void setPage(1);
    },
  };
}

export type WarehouseListState = ReturnType<typeof useWarehouseListState>;
