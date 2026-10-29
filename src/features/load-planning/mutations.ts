/**
 * Mutation kế hoạch xếp xe + invalidation (api-conventions §2.3). Thành công hay lỗi dữ liệu cũ (`isStaleLoadPlanError`:
 * OPTIMISTIC_LOCK, trạng thái đã khác, xe vừa bị bỏ kiện…) đều tải lại danh sách, chi tiết, bố cục, đối chiếu và lô ứng
 * viên qua khoá gốc, để lần thử sau gửi đúng `expectedVersion`. Lỗi hiện trong dialog / khung đã map tiếng Việt nên không
 * bật toast lỗi.
 */

import { SHARED_QUERY_ROOTS, TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";
import { toast } from "@/components/shared/Toast";

import { createLoadPlan, setLoadPlanInputs } from "./api";
import { cancelPlanControlled, recalculateVehicle, runPlanStep, savePlacements } from "./api-steps";
import { isStaleLoadPlanError } from "./errors";
import { loadPlanKeys } from "./queries";

import type { PlanStepKind } from "./plan-types";

const T = TOAST_MESSAGES.loadPlan;
const ROOT = [loadPlanKeys.all];
/** = `loadKeys.all` của features/shipping — các xe của kế hoạch là chuyến xe; không import chéo feature. */
const LOAD_ROOT = [SHARED_QUERY_ROOTS.fulfillmentLoads];
const base = { invalidate: ROOT, showErrorToast: false } as const;

const STEP_TOASTS: Record<PlanStepKind, string> = {
  calculate: T.calculated,
  acknowledge: T.acknowledged,
  confirm: T.confirmed,
  reopen: T.reopened,
  cancel: T.cancelled,
};

/** Không toast thành công: màn lập kế hoạch còn phải tính xếp xe rồi mới báo một lần. */
export const useCreateLoadPlan = withStaleRefetch(
  createMutation(createLoadPlan, base),
  ROOT,
  isStaleLoadPlanError,
);

export const useSetLoadPlanInputs = withStaleRefetch(
  createMutation(setLoadPlanInputs, { ...base, successMessage: T.inputsSaved }),
  ROOT,
  isStaleLoadPlanError,
);

/** Tính, xác nhận kiện chưa xếp, chốt, mở lại, huỷ — một mutation, rẽ nhánh theo `kind`. */
export const usePlanStep = withStaleRefetch(
  createMutation(runPlanStep, {
    ...base,
    onSuccess: (_plan, step) => toast.success(STEP_TOASTS[step.kind]),
  }),
  ROOT,
  isStaleLoadPlanError,
);

/**
 * Huỷ có kiểm soát cả kế hoạch sau khi đã xếp hàng (SCRUM-474): ngoài kế hoạch còn tải lại chuyến xe (các xe huỷ theo, kiện bị
 * khoá hiện ở ô quét dỡ). Lỗi hiện trong hộp thoại.
 */
export const useCancelPlanControlled = withStaleRefetch(
  createMutation(cancelPlanControlled, {
    invalidate: [loadPlanKeys.all, LOAD_ROOT],
    showErrorToast: false,
    successMessage: T.controlledCancelled,
  }),
  ROOT,
  isStaleLoadPlanError,
);

export const useRecalculateVehicle = withStaleRefetch(
  createMutation(recalculateVehicle, { ...base, successMessage: T.vehicleRecalculated }),
  ROOT,
  isStaleLoadPlanError,
);

/**
 * Lưu bố cục xếp tay. Không toast lỗi: 422 (vi phạm theo kiện) và 409 (đổi từ nơi khác) do trình soạn tự hiện để giữ
 * nguyên bản chỉnh; 409 và các lỗi "dữ liệu đã cũ" vẫn tải lại kế hoạch + bố cục (qua `withStaleRefetch`).
 */
export const useSavePlacements = withStaleRefetch(
  createMutation(savePlacements, { ...base, successMessage: T.placementsSaved }),
  ROOT,
  isStaleLoadPlanError,
);
