import { useState } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";
import { loadPlanErrorMessage } from "@/features/load-planning/errors";
import { useCreateLoadPlan, usePlanStep } from "@/features/load-planning/mutations";
import {
  clearCreatePlanRequestId,
  createPlanFingerprint,
  createPlanRequestId,
} from "@/features/load-planning/request-ids";

import type { CreatePlanInput } from "@/features/load-planning/plan-types";

/**
 * Lập kế hoạch rồi tính xếp xe (docs 09 §4.2 bước 1–2): POST kế hoạch kèm đầu vào, sau đó POST tính. `requestId`
 * sinh ở client và nhớ theo nội dung (`request-ids.ts`) nên bấm lại sau lỗi mạng không tạo kế hoạch thứ hai. Tạo xong
 * mà tính lỗi thì vẫn mở kế hoạch (bản nháp) để tính lại — không bắt người dùng lập lại từ đầu.
 */
export function useStartLoadPlan() {
  const router = useRouter();
  const create = useCreateLoadPlan();
  const calculate = usePlanStep();
  const [error, setError] = useState<string | null>(null);

  async function start(input: Omit<CreatePlanInput, "requestId">) {
    setError(null);
    const requestId = createPlanRequestId(createPlanFingerprint(input));
    let plan;
    try {
      plan = await create.mutateAsync({ ...input, requestId });
    } catch (e: unknown) {
      // CONFLICT: BE đã gắn mã này với kế hoạch khác — bỏ mã đã nhớ để lần thử sau sinh mã mới
      if (e instanceof ApiError && e.code === "CONFLICT") clearCreatePlanRequestId();
      setError(loadPlanErrorMessage(e));
      return;
    }
    clearCreatePlanRequestId();
    try {
      await calculate.mutateAsync({
        kind: "calculate",
        loadPlanId: plan.loadPlanId,
        expectedVersion: plan.version,
      });
    } catch (e: unknown) {
      toast.warning(UI_LABELS.loadPlan.createForm.calcFailed(loadPlanErrorMessage(e)));
    }
    router.push(ADMIN_ROUTES.loadPlans.detail(plan.loadPlanId));
  }

  return { start, error, pending: create.isPending || calculate.isPending };
}
