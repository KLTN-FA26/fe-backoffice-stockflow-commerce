import {
  useCompletePicking,
  useMoveToDispatch,
  useStartPicking,
} from "@/features/fulfillment/mutations";
import { useTopUpTask } from "@/features/fulfillment/pick-line-mutations";

import type { ConfirmCode } from "./action-config";

/** Mutation của từng thao tác trên card thao tác nhiệm vụ: cần xác nhận (khoá theo `ConfirmCode`) + "Bắt đầu lấy hàng" (bấm một lần). */
export function useTaskActionMutations() {
  return {
    startPicking: useStartPicking(),
    completePicking: useCompletePicking(),
    moveToDispatch: useMoveToDispatch(),
    topUp: useTopUpTask(),
  } satisfies Record<ConfirmCode | "startPicking", unknown>;
}
