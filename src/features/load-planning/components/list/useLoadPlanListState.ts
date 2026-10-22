import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { ADMIN_ROUTES, STORAGE_KEYS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePageConfig } from "@/hooks/use-page-config";
import { useLoadPlans } from "@/features/load-planning/queries";

import { DEFAULT_CONFIG, LOAD_PLAN_STATUS_FILTERS, mergeStoredConfig } from "./constants";

import type { PlanRow } from "@/features/load-planning/plan-types";

export type LoadPlanListEmptyState = "none" | "no-data" | "no-results" | "invalid-page";

/** State danh sách kế hoạch — trang, tìm kiếm, trạng thái, kho trên URL; số dòng / trang ở localStorage. */
export function useLoadPlanListState(canRead: boolean) {
  const router = useRouter();
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(LOAD_PLAN_STATUS_FILTERS).withDefault("ALL"),
  );
  const [warehouseId, setWarehouseId] = useQueryState("warehouse", parseAsString.withDefault(""));
  const debouncedQ = useDebouncedValue(q, 300);
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminLoadPlansConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const query = useLoadPlans(
    {
      page: Math.max(0, page - 1),
      size: config.pageSize,
      search: debouncedQ,
      status: status === "ALL" ? undefined : status,
      warehouseId: warehouseId || undefined,
    },
    { enabled: canRead },
  );

  const hasFilters = q.trim() !== "" || status !== "ALL" || warehouseId !== "";
  // Empty state theo tham số của dữ liệu đang hiện (search sau debounce)
  const dataFiltered = debouncedQ.trim() !== "" || status !== "ALL" || warehouseId !== "";
  const data = query.data;
  let emptyState: LoadPlanListEmptyState = "none";
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
    warehouseId,
    hasFilters,
    emptyState,
    openPlan: useCallback(
      (row: PlanRow) => router.push(ADMIN_ROUTES.loadPlans.detail(row.loadPlanId)),
      [router],
    ),
    setPage: (value: number) => void setPage(value),
    setQ: filter((value: string) => setQ(value || null)),
    setStatus: filter((value: string) =>
      setStatus(LOAD_PLAN_STATUS_FILTERS.find((known) => known === value) ?? "ALL"),
    ),
    setWarehouseId: filter((value: string) => setWarehouseId(value || null)),
    changePageSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setPage(1);
    },
    clearFilters: () => {
      void setQ(null);
      void setStatus(null);
      void setWarehouseId(null);
      void setPage(1);
    },
  };
}

export type LoadPlanListState = ReturnType<typeof useLoadPlanListState>;
