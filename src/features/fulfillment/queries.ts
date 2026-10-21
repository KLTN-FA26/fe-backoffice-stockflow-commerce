import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getDesignArtifactUrl, getFulfillmentTask, listFulfillmentTasks } from "./api";
import {
  getFulfillmentOrder,
  listAssignees,
  listFulfillableOrders,
  listOrderNumbers,
} from "./reference-api";

import type { ListFulfillmentTaskParams } from "./api";
import type { ArtifactUrlInput, FulfillmentTask } from "./types";

export const fulfillmentKeys = createQueryKeys<ListFulfillmentTaskParams>("fulfillment-tasks");

/**
 * Dữ liệu phụ trợ đọc từ module khác — key riêng của feature (không dùng chung `orderKeys`,
 * tránh import chéo feature).
 */
export const fulfillmentReferenceKeys = {
  all: ["fulfillment-references"] as const,
  /** Gốc của mọi dữ liệu ĐƠN HÀNG — mutation đổi trạng thái đơn chỉ làm mới nhánh này. */
  orders: () => [...fulfillmentReferenceKeys.all, "orders"] as const,
  order: (orderId: string) => [...fulfillmentReferenceKeys.orders(), "detail", orderId] as const,
  fulfillableOrders: () => [...fulfillmentReferenceKeys.orders(), "fulfillable"] as const,
  orderNumbers: () => [...fulfillmentReferenceKeys.orders(), "numbers"] as const,
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

/** Đơn của task (số đơn + dòng). Cần `sales-orders:READ` — thiếu thì tắt, màn hiện thông báo. */
export function useFulfillmentOrder(orderId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: fulfillmentReferenceKeys.order(orderId ?? ""),
    queryFn: ({ signal }) => getFulfillmentOrder(orderId ?? "", signal),
    enabled: enabled && !!orderId,
    ...QUERY_TIMES.detail,
  });
}

/** Đơn chờ đưa vào xuất kho — cho dialog tạo task. */
export function useFulfillableOrders(enabled: boolean) {
  return useQuery({
    queryKey: fulfillmentReferenceKeys.fulfillableOrders(),
    queryFn: ({ signal }) => listFulfillableOrders(signal),
    enabled,
    ...QUERY_TIMES.list,
  });
}

/** id đơn → số đơn (cột danh sách). Thiếu `sales-orders:READ` → tắt, cột hiện id rút gọn. */
export function useOrderNumbers(enabled: boolean) {
  return useQuery({
    queryKey: fulfillmentReferenceKeys.orderNumbers(),
    queryFn: ({ signal }) => listOrderNumbers(signal),
    enabled,
    ...QUERY_TIMES.master,
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

/**
 * Key riêng cho URL file thiết kế — KHÔNG nằm dưới `fulfillmentKeys`: mỗi lần gọi `download-url`
 * BE tải lại và băm cả bundle, nên không để mọi mutation của task kéo theo. Chỉ làm mới khi kết
 * quả đối chiếu có thể đã đổi (xem `mutations.ts`).
 */
export const fulfillmentArtifactKeys = {
  all: ["fulfillment-artifacts"] as const,
  task: (taskId: string) => [...fulfillmentArtifactKeys.all, taskId] as const,
  file: ({ taskId, lineId, role }: ArtifactUrlInput) =>
    [...fulfillmentArtifactKeys.task(taskId), lineId, role] as const,
};

/**
 * URL xem trước một file thiết kế. BE ký URL ngắn hạn và trả `Cache-Control: no-store` → không
 * giữ lại sau khi rời màn (`gcTime: 0`), luôn lấy mới khi mở lại (`staleTime: 0`).
 */
export function useDesignArtifact(input: ArtifactUrlInput, enabled: boolean) {
  return useQuery({
    queryKey: fulfillmentArtifactKeys.file(input),
    queryFn: ({ signal }) => getDesignArtifactUrl(input, signal),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
