import {
  useCompletePicking,
  useMoveToDispatch,
  useStartPicking,
} from "@/features/fulfillment/mutations";
import { useTopUpTask } from "@/features/fulfillment/pick-line-mutations";

import type { ConfirmCode } from "./action-config";

/** Mutation của từng thao tác cần xác nhận trên card thao tác task (khoá theo `ConfirmCode`). */
export function useTaskActionMutations() {
  return {
    startPicking: useStartPicking(),
    completePicking: useCompletePicking(),
    moveToDispatch: useMoveToDispatch(),
    topUp: useTopUpTask(),
  } satisfies Record<ConfirmCode, unknown>;
}
