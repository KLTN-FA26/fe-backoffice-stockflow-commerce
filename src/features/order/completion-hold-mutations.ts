/**
 * Giữ hoàn tất đơn — mutation hooks (BE `OrderCompletionHoldController`, WF-05 GH-2).
 *
 * Giữ / gỡ giữ không đổi trạng thái đơn hay lô nào, chỉ đổi lần giữ (dưới `orderKeys.all`) — invalidate `orderKeys.all`
 * làm mới thẻ "Giữ hoàn tất" và chi tiết đơn. `showErrorToast: false`: hộp thoại map lỗi theo `error.code`
 * (`completionHoldErrorView`).
 */

import { COMPLETION_HOLD_LABELS } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";

import { holdCompletion, releaseCompletionHold } from "./completion-hold-api";
import { orderKeys } from "./queries";

import type { HoldCompletionInput, ReleaseCompletionHoldInput } from "./completion-hold-api";
import type { CompletionHold } from "./completion-hold-schemas";

export const useHoldCompletion = createMutation<HoldCompletionInput, CompletionHold>(
  holdCompletion,
  {
    invalidate: [orderKeys.all],
    successMessage: COMPLETION_HOLD_LABELS.hold.success,
    showErrorToast: false,
  },
);

export const useReleaseCompletionHold = createMutation<ReleaseCompletionHoldInput, CompletionHold>(
  releaseCompletionHold,
  {
    invalidate: [orderKeys.all],
    successMessage: COMPLETION_HOLD_LABELS.release.success,
    showErrorToast: false,
  },
);
