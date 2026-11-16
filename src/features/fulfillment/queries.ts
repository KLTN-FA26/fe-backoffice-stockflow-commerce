import { useQuery } from "@tanstack/react-query";

import { SHARED_QUERY_ROOTS } from "@/constants";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getFulfillmentTask, listFulfillmentTasks } from "./api";
import { listPickLines } from "./pick-line-api";
import { listPutBacks } from "./put-back-api";
import { listAssignees, listTaskCandidates } from "./reference-api";

import type { ListFulfillmentTaskParams } from "./api";
import type { FulfillmentTask } from "./types";

export const fulfillmentKeys = createQueryKeys<ListFulfillmentTaskParams>(
  SHARED_QUERY_ROOTS.fulfillmentTasks,
);

/**
 * Dòng lấy hàng — nằm dưới `fulfillmentKeys.all` để mọi mutation của task (bắt đầu lấy hàng sinh
 * dòng, hoàn tất…) cũng làm mới danh sách dòng.
 */
export const pickLineKeys = {
  all: [...fulfillmentKeys.all, "pick-lines"] as const,
  task: (taskId: string) => [...pickLineKeys.all, taskId] as const,
};

/** Hàng đợi trả về kệ — dưới `fulfillmentKeys.all`: trả xong, huỷ đơn, lấy hàng đều làm mới. */
export const putBackKeys = {
  all: [...fulfillmentKeys.all, "put-backs"] as const,
  list: (warehouseId?: string) => [...putBackKeys.all, warehouseId ?? "all"] as const,
};

/** Hàng đợi một trang (200 dòng cũ nhất); `warehouseId` null = mọi kho trong phạm vi người gọi. */
export function usePutBacks(warehouseId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: putBackKeys.list(warehouseId ?? undefined),
    queryFn: ({ signal }) => listPutBacks({ warehouseId: warehouseId ?? undefined }, signal),
    enabled,
    ...QUERY_TIMES.list,
  });
}

/** Mọi dòng của task theo lộ trình. Chưa biết task hoặc thiếu quyền đọc → không gọi. */
export function usePickLines(taskId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: pickLineKeys.task(taskId ?? ""),
    queryFn: ({ signal }) => listPickLines(taskId ?? "", signal),
    enabled: enabled && !!taskId,
    ...QUERY_TIMES.detail,
  });
}

/**
 * Dữ liệu phụ trợ đọc từ module khác — key riêng của feature (không dùng chung `orderKeys`,
 * tránh import chéo feature).
 */
export const fulfillmentReferenceKeys = {
  all: ["fulfillment-references"] as const,
  /** Gốc của mọi dữ liệu ĐƠN HÀNG — mutation đổi trạng thái đơn chỉ làm mới nhánh này. */
  orders: () => [...fulfillmentReferenceKeys.all, "orders"] as const,
  /**
   * Đơn chờ đưa vào xuất kho (`GET /fulfillment/task-candidates`) — nằm dưới nhánh đơn hàng để tạo task /
   * đổi trạng thái đơn làm mới danh sách (đơn vừa có task phải rời danh sách).
   */
  taskCandidates: (warehouseId?: string) =>
    [...fulfillmentReferenceKeys.orders(), "task-candidates", warehouseId ?? "all"] as const,
  /** Người nhận task theo kho — không đổi theo thao tác trên task → không nằm dưới nhánh đơn hàng. */
  assignees: (warehouseId: string) =>
    [...fulfillmentReferenceKeys.all, "assignees", warehouseId] as const,
};

export const useFulfillmentTasks = createListQuery<FulfillmentTask, ListFulfillmentTaskParams>(
  fulfillmentKeys,
  listFulfillmentTasks,
);

export const useFulfillmentTask = createDetailQuery<FulfillmentTask>(
  fulfillmentKeys,
  getFulfillmentTask,
);

/**
 * Đơn chờ đưa vào xuất kho — cho dialog tạo task. Cần `fulfillment-task-assignment:CREATE` (không cần
 * `sales-orders:READ`); thiếu quyền → tắt, dialog hiện thông báo.
 */
export function useTaskCandidates(enabled: boolean, warehouseId?: string) {
  return useQuery({
    queryKey: fulfillmentReferenceKeys.taskCandidates(warehouseId),
    queryFn: ({ signal }) => listTaskCandidates({ warehouseId }, signal),
    enabled,
    ...QUERY_TIMES.list,
  });
}

/**
 * Người nhận được task của một kho. Thiếu `fulfillment-task-assignment:UPDATE` hoặc chưa biết kho →
 * tắt, dialog gán hiện thông báo / nhắc chọn đơn.
 */
export function useAssignees(warehouseId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: fulfillmentReferenceKeys.assignees(warehouseId ?? ""),
    queryFn: ({ signal }) => listAssignees(warehouseId ?? "", signal),
    enabled: enabled && !!warehouseId,
    ...QUERY_TIMES.master,
  });
}
