import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { getCartonCheckSession, listCartonCheckQueue } from "./carton-check-api";
import { fulfillmentKeys } from "./queries";

import type { CartonCheckQueueParams } from "./carton-check-types";

/**
 * Key của trạm kiểm thùng nằm DƯỚI `fulfillmentKeys.all`: mọi mutation đổi task (gán, lấy hàng, chuyển sang khu xuất
 * hàng…) làm mới luôn hàng chờ và phiên kiểm thùng mà không phải nhớ thêm key.
 */
export const cartonCheckKeys = {
  all: [...fulfillmentKeys.all, "carton-check"] as const,
  queues: () => [...cartonCheckKeys.all, "queue"] as const,
  queue: (params: CartonCheckQueueParams) => [...cartonCheckKeys.queues(), params] as const,
  sessions: () => [...cartonCheckKeys.all, "session"] as const,
  session: (taskId: string) => [...cartonCheckKeys.sessions(), taskId] as const,
};

/** Hàng chờ kiểm thùng (phân trang từ 0). Thiếu `fulfillment-packages:READ` thì tắt (`enabled`). */
export function useCartonCheckQueue(params: CartonCheckQueueParams, options: { enabled: boolean }) {
  return useQuery({
    queryKey: cartonCheckKeys.queue(params),
    queryFn: ({ signal }) => listCartonCheckQueue(params, signal),
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
    enabled: options.enabled,
  });
}

/** Phiên kiểm thùng của một task — nguồn sự thật của trạm: dòng, thùng, shipment, khoản phải thu. */
export function useCartonCheckSession(taskId: string | undefined, options: { enabled: boolean }) {
  return useQuery({
    queryKey: cartonCheckKeys.session(taskId ?? ""),
    queryFn: ({ signal }) => getCartonCheckSession(taskId ?? "", signal),
    ...QUERY_TIMES.tracking,
    enabled: options.enabled && !!taskId,
  });
}
