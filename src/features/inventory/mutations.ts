import { useMutation, useQueryClient } from "@tanstack/react-query";

import { INVENTORY_QUERY_KEYS } from "@/constants/inventory";

import { approveAdjustment, createAdjustment, rejectAdjustment, withdrawAdjustment } from "./api";
import { adjustmentKeys, movementKeys } from "./queries";

import type { RejectAdjustmentInput } from "./types";

function useAdjustmentInvalidation(stockChanged: boolean) {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: adjustmentKeys.all });
    if (stockChanged) {
      // BR-STK-005 / F-CNT: approval posts stock and ledger atomically.
      await Promise.all([
        client.invalidateQueries({ queryKey: movementKeys.all }),
        client.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEYS.stock] }),
      ]);
    }
  };
}

export function useCreateAdjustment() {
  const onSuccess = useAdjustmentInvalidation(false);
  return useMutation({ mutationFn: createAdjustment, onSuccess });
}

export function useApproveAdjustment() {
  const onSuccess = useAdjustmentInvalidation(true);
  return useMutation({ mutationFn: approveAdjustment, onSuccess });
}

export function useRejectAdjustment() {
  const onSuccess = useAdjustmentInvalidation(false);
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RejectAdjustmentInput }) =>
      rejectAdjustment(id, input),
    onSuccess,
  });
}

export function useWithdrawAdjustment() {
  const onSuccess = useAdjustmentInvalidation(false);
  return useMutation({ mutationFn: withdrawAdjustment, onSuccess });
}
