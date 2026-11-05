import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { ADMIN_ROUTES, FULFILLMENT_COLUMNS, PICK_API_STATUSES } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useFulfillmentTasks } from "@/features/fulfillment/queries";

import {
  STORAGE_KEY,
  defaultColumns,
  defaultConfig,
  mergeStoredConfig,
  sameColumns,
} from "./constants";

import type { PickApiStatus } from "@/constants";
import type { FulfillmentTask } from "@/features/fulfillment/types";
import type { FulfillmentScope } from "../primitives";
import type { TaskPageConfig } from "./constants";

export type TaskListEmptyState = "none" | "no-tasks" | "no-match" | "invalid-page";

/**
 * State danh sách task — trang + bộ lọc trên URL (nuqs: `page`, `status`, `warehouse`, `assignee`), cột + số
 * dòng trong localStorage (state-persistence.md). BE `GET /fulfillment/tasks` lọc theo một trạng thái pick,
 * kho và người được gán (SCRUM-466); không có tìm kiếm / sắp xếp. Trạng thái lạ trên URL → coi như không lọc.
 */
export function useTaskListState(scope: FulfillmentScope, canRead: boolean) {
  const router = useRouter();
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [status, setStatusParam] = useQueryState("status", parseAsStringLiteral(PICK_API_STATUSES));
  const [warehouse, setWarehouseParam] = useQueryState("warehouse", parseAsString);
  const [assignee, setAssigneeParam] = useQueryState("assignee", parseAsString);
  const { config, updateConfig } = usePageConfig<TaskPageConfig>(
    STORAGE_KEY[scope],
    defaultConfig(scope),
    mergeStoredConfig,
  );
  const query = useFulfillmentTasks(
    {
      page: Math.max(0, page - 1),
      size: config.pageSize,
      status: status ?? undefined,
      warehouseId: warehouse ?? undefined,
      assignedUserId: assignee ?? undefined,
    },
    { enabled: canRead },
  );

  const hasFilters = status !== null || warehouse !== null || assignee !== null;
  const data = query.data;
  const emptyState: TaskListEmptyState = !data
    ? "none"
    : data.totalElements === 0
      ? hasFilters
        ? "no-match"
        : "no-tasks"
      : data.items.length === 0
        ? "invalid-page"
        : "none";

  const navigateToDetail = useCallback(
    (row: FulfillmentTask) => router.push(ADMIN_ROUTES[scope].detail(row.taskId)),
    [router, scope],
  );

  // Đổi lọc → về trang 1 (data-table-mode-a §5)
  const setStatus = (value: PickApiStatus | null) => {
    void setStatusParam(value);
    void setPage(1);
  };
  // Người được gán thuộc một kho (`/fulfillment/assignees?warehouseId`) → đổi kho thì bỏ lọc người
  const setWarehouse = (value: string | null) => {
    void setWarehouseParam(value);
    void setAssigneeParam(null);
    void setPage(1);
  };
  const setAssignee = (value: string | null) => {
    void setAssigneeParam(value);
    void setPage(1);
  };
  const clearFilters = () => {
    void setStatusParam(null);
    void setWarehouseParam(null);
    void setAssigneeParam(null);
    void setPage(1);
  };

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
    status,
    warehouse,
    assignee,
    hasFilters,
    visibleColumnCount: config.visibleColumns.filter((c) => c !== FULFILLMENT_COLUMNS.ACTIONS)
      .length,
    hasColumnConfig: !sameColumns(config.visibleColumns, defaultColumns(scope)),
    setPage,
    setStatus,
    setWarehouse,
    setAssignee,
    clearFilters,
    navigateToDetail,
    toggleColumn,
    changePageSize,
    resetColumns,
  };
}

export type TaskListState = ReturnType<typeof useTaskListState>;
