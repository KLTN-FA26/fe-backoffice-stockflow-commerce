import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseAsInteger, useQueryState } from "nuqs";

import { ADMIN_ROUTES, FULFILLMENT_COLUMNS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useFulfillmentTasks } from "@/features/fulfillment/queries";

import {
  STORAGE_KEY,
  defaultColumns,
  defaultConfig,
  mergeStoredConfig,
  sameColumns,
} from "./constants";

import type { FulfillmentTask } from "@/features/fulfillment/types";
import type { FulfillmentScope } from "../primitives";
import type { TaskPageConfig } from "./constants";

export type TaskListEmptyState = "none" | "no-tasks" | "invalid-page";

/**
 * State danh sách task — trang trên URL (nuqs), cột + số dòng trong localStorage
 * (state-persistence.md). BE `GET /fulfillment/tasks` chỉ nhận `page` + `size`: chưa có lọc, tìm
 * kiếm hay sắp xếp, nên màn KHÔNG có các điều khiển đó (không lọc giả phía client trên một trang).
 */
export function useTaskListState(scope: FulfillmentScope, canRead: boolean) {
  const router = useRouter();
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const { config, updateConfig } = usePageConfig<TaskPageConfig>(
    STORAGE_KEY[scope],
    defaultConfig(scope),
    mergeStoredConfig,
  );
  const query = useFulfillmentTasks(
    { page: Math.max(0, page - 1), size: config.pageSize },
    { enabled: canRead },
  );

  const data = query.data;
  const emptyState: TaskListEmptyState = !data
    ? "none"
    : data.totalElements === 0
      ? "no-tasks"
      : data.items.length === 0
        ? "invalid-page"
        : "none";

  const navigateToDetail = useCallback(
    (row: FulfillmentTask) => router.push(ADMIN_ROUTES[scope].detail(row.taskId)),
    [router, scope],
  );

  const toggleColumn = (column: string) => {
    if (column === FULFILLMENT_COLUMNS.ACTIONS) return;
    updateConfig((c) => ({
      ...c,
      visibleColumns: c.visibleColumns.includes(column)
        ? c.visibleColumns.filter((x) => x !== column)
        : [...c.visibleColumns, column],
    }));
  };

  const changePageSize = (pageSize: number) => {
    updateConfig((c) => ({ ...c, pageSize }));
    void setPage(1);
  };

  const resetColumns = () => updateConfig((c) => ({ ...c, visibleColumns: defaultColumns(scope) }));

  return {
    scope,
    canRead,
    query,
    config,
    emptyState,
    visibleColumnCount: config.visibleColumns.filter((c) => c !== FULFILLMENT_COLUMNS.ACTIONS)
      .length,
    hasColumnConfig: !sameColumns(config.visibleColumns, defaultColumns(scope)),
    setPage,
    navigateToDetail,
    toggleColumn,
    changePageSize,
    resetColumns,
  };
}

export type TaskListState = ReturnType<typeof useTaskListState>;
