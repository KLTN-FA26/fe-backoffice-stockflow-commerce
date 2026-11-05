import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { getPackageLabel, getPackingSession, listPackingQueue } from "./packing-api";
import { fulfillmentKeys } from "./queries";

import type { PackageRef, PackingQueueParams } from "./packing-types";

/**
 * Key của trạm đóng gói nằm DƯỚI `fulfillmentKeys.all`: mọi mutation đổi task (gán, lấy hàng, kiểm tra
 * lại thiết kế…) làm mới luôn hàng chờ và phiên đóng gói mà không phải nhớ thêm key.
 */
export const packingKeys = {
  all: [...fulfillmentKeys.all, "packing"] as const,
  queues: () => [...packingKeys.all, "queue"] as const,
  queue: (params: PackingQueueParams) => [...packingKeys.queues(), params] as const,
  sessions: () => [...packingKeys.all, "session"] as const,
  session: (taskId: string) => [...packingKeys.sessions(), taskId] as const,
  labels: () => [...packingKeys.all, "label"] as const,
  label: ({ taskId, packageId }: PackageRef) =>
    [...packingKeys.labels(), taskId, packageId] as const,
};

/** Hàng chờ đóng gói (phân trang từ 0). Thiếu `fulfillment-packages:READ` thì tắt (`enabled`). */
export function usePackingQueue(params: PackingQueueParams, options: { enabled: boolean }) {
  return useQuery({
    queryKey: packingKeys.queue(params),
    queryFn: ({ signal }) => listPackingQueue(params, signal),
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
    enabled: options.enabled,
  });
}

/** Phiên đóng gói của một task — nguồn sự thật của trạm: dòng, kiện, lô giao, khoản phải thu. */
export function usePackingSession(taskId: string | undefined, options: { enabled: boolean }) {
  return useQuery({
    queryKey: packingKeys.session(taskId ?? ""),
    queryFn: ({ signal }) => getPackingSession(taskId ?? "", signal),
    ...QUERY_TIMES.tracking,
    enabled: options.enabled && !!taskId,
  });
}

/**
 * Dữ liệu nhãn một kiện. BE trả `no-store` và n/N, COD của nhãn tạm đổi theo các kiện khác → luôn lấy
 * mới khi mở, không giữ lại sau khi đóng hộp thoại.
 */
export function usePackageLabel(ref: PackageRef, enabled: boolean) {
  return useQuery({
    queryKey: packingKeys.label(ref),
    queryFn: ({ signal }) => getPackageLabel(ref, signal),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
