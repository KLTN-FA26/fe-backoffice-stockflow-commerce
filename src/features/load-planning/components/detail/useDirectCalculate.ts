import { loadPlanErrorMessage } from "@/features/load-planning/errors";
import { usePlanStep } from "@/features/load-planning/mutations";
import { useLoadPlan } from "@/features/load-planning/queries";

/**
 * Tính xếp xe ngay, không hộp thoại hỏi (S16-5): kế hoạch nháp chưa có bố cục thì không có gì bị ghi đè nên không hỏi
 * "sẽ thay thế bố cục". Trong lúc chạy báo "Đang tính xếp xe…" (`pending`), xong thì có thông báo thành công của mutation;
 * lỗi báo qua `onNotice`. Gửi `expectedVersion` của bản mới nhất.
 */
export function useDirectCalculate(loadPlanId: string, onNotice: (message: string | null) => void) {
  const step = usePlanStep();
  const current = useLoadPlan(loadPlanId).data;
  return {
    pending: step.isPending,
    run: () => {
      if (!current) return;
      onNotice(null);
      step.mutate(
        { kind: "calculate", loadPlanId: current.loadPlanId, expectedVersion: current.version },
        { onError: (error) => onNotice(loadPlanErrorMessage(error)) },
      );
    },
  };
}
