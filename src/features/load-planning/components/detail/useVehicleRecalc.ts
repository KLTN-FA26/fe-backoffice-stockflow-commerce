import { loadPlanErrorMessage } from "@/features/load-planning/errors";
import { useRecalculateVehicle } from "@/features/load-planning/mutations";
import { useLoadPlan } from "@/features/load-planning/queries";

import type { PlanDetail } from "@/features/load-planning/plan-types";

/**
 * Tính lại riêng một xe (docs 09 §4.2 bước 3), tuỳ chọn thêm kiện lấy từ khay chưa xếp ("đưa lại vào xe"). Gửi
 * `expectedVersion` của bản mới nhất của kế hoạch; lỗi (kể cả 409 OPTIMISTIC_LOCK đã tải lại) báo qua `onNotice`.
 */
export function useVehicleRecalc(plan: PlanDetail, onNotice: (message: string | null) => void) {
  const mutation = useRecalculateVehicle();
  const current = useLoadPlan(plan.loadPlanId).data ?? plan;
  return {
    pending: mutation.isPending,
    run: (seq: number, addPackageIds?: string[], onDone?: () => void) => {
      onNotice(null);
      mutation.mutate(
        { loadPlanId: current.loadPlanId, expectedVersion: current.version, seq, addPackageIds },
        {
          onSuccess: onDone,
          onError: (e) => onNotice(loadPlanErrorMessage(e)),
        },
      );
    },
  };
}
