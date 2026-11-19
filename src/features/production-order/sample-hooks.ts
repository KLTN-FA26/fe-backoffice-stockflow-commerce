/**
 * Query + mutation vòng mẫu in. Mở vòng 1 đổi trạng thái Đơn sản xuất (Accepted → Sample Pending) → làm mới cả đơn,
 * lịch sản xuất và cờ trễ; thêm tệp / ngày gửi mẫu vật chỉ đổi danh sách vòng.
 */

import { useQuery } from "@tanstack/react-query";

import { PRODUCTION_TOAST_MESSAGES as T, SHARED_QUERY_ROOTS } from "@/constants";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createMutation } from "@/lib/api/query-factory";

import { productionOrderKeys } from "./queries";
import {
  addSampleMedia,
  getSampleRounds,
  openSampleRound,
  recordPhysicalSample,
} from "./sample-api";

export const sampleRoundKeys = {
  of: (orderId: string) => [...productionOrderKeys.detail(orderId), "sample-rounds"] as const,
};

export function useSampleRounds(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: sampleRoundKeys.of(orderId),
    queryFn: ({ signal }) => getSampleRounds(orderId, signal),
    enabled,
    ...QUERY_TIMES.detail,
  });
}

export const useOpenSampleRound = createMutation(openSampleRound, {
  invalidate: [
    productionOrderKeys.all,
    [SHARED_QUERY_ROOTS.productionSchedule],
    [SHARED_QUERY_ROOTS.delayAlerts],
  ],
  successMessage: T.roundOpened,
  showErrorToast: false,
});

export const useAddSampleMedia = createMutation(addSampleMedia, {
  invalidate: [productionOrderKeys.all],
  successMessage: T.mediaAdded,
  showErrorToast: false,
});

export const useRecordPhysicalSample = createMutation(recordPhysicalSample, {
  invalidate: [productionOrderKeys.all],
  successMessage: T.physicalRecorded,
  showErrorToast: false,
});
