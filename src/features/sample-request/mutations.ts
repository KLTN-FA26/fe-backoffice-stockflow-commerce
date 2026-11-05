/**
 * Yêu cầu mẫu — mutations + invalidation map. Gửi sản xuất tạo LSX mẫu và giữ phôi → thêm root
 * `production-orders` (khai báo lại chuỗi, không import chéo feature production-order).
 * Khách duyệt mẫu mở khoá chấp nhận báo giá (BR-PRD-08) → thêm root `quotes`.
 */

import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import {
  approveSample,
  cancelSample,
  createSample,
  nextSampleRound,
  requestSampleChanges,
  sendSample,
  submitSample,
  updateSample,
} from "./api";
import { SAMPLE_STALE_CODES } from "./errors";
import { sampleKeys } from "./queries";

import type { SampleCreateOutput, SampleDetail, SampleSpecOutput } from "./types";

const PRODUCTION_ROOT_KEY = QUERY_ROOTS.productionOrders;
const QUOTE_ROOT_KEY = QUERY_ROOTS.quotes;

function sampleMutation<TInput>(
  fn: (input: TInput) => Promise<SampleDetail>,
  successMessage: string,
  extra: readonly (readonly string[])[] = [],
) {
  return withStaleRefetch(
    createMutation<TInput, SampleDetail>(fn, {
      invalidate: [sampleKeys.all, ...extra],
      successMessage,
      showErrorToast: false,
    }),
    [sampleKeys.all],
    SAMPLE_STALE_CODES,
  );
}

export const useCreateSample = sampleMutation<SampleCreateOutput>(
  createSample,
  "Đã tạo yêu cầu mẫu nháp.",
);
export const useUpdateSample = sampleMutation<{ id: string; values: SampleSpecOutput }>(
  updateSample,
  "Đã lưu yêu cầu mẫu.",
);
export const useSubmitSample = sampleMutation(submitSample, "Đã gửi sản xuất mẫu và giữ phôi.", [
  PRODUCTION_ROOT_KEY,
]);
export const useSendSample = sampleMutation(sendSample, "Đã ghi nhận gửi mẫu cho khách.");
export const useApproveSample = sampleMutation(approveSample, "Đã duyệt mẫu.", [QUOTE_ROOT_KEY]);
export const useRequestSampleChanges = sampleMutation(
  requestSampleChanges,
  "Đã gửi yêu cầu chỉnh sửa mẫu.",
  [QUOTE_ROOT_KEY],
);
export const useNextSampleRound = sampleMutation(nextSampleRound, "Đã tạo lần mẫu mới.");
export const useCancelSample = sampleMutation(cancelSample, "Đã huỷ yêu cầu mẫu.");
