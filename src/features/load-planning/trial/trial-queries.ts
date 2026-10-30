/** "Ước tính thử" — mutation (React Query). Không có query: kết quả không lưu nên không có gì để đọc lại. */

import { createMutation } from "@/lib/api/query-factory";

import { runTrialEstimate } from "./trial-api";

import type { TrialEstimate, TrialRunInput } from "./trial-types";

/**
 * Chạy thử xếp xe. Không invalidate gì (BE không lưu). `showErrorToast: false`: màn map lỗi (quá 3 000 kiện, loại xe
 * ngừng dùng, dòng không hợp lệ…) ngay tại chỗ bằng `trialErrorMessage`.
 */
export const useRunTrialEstimate = createMutation<TrialRunInput, TrialEstimate>(runTrialEstimate, {
  showErrorToast: false,
});
