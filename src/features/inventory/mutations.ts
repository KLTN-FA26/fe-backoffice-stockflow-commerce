import { useMutation, useQueryClient } from "@tanstack/react-query";

import { INVENTORY_QUERY_KEYS } from "@/constants/inventory";

import { useAppStore } from "@/lib/store/use-app-store";

import { approveAdjustment, createAdjustment, rejectAdjustment, withdrawAdjustment } from "./api";
import { isStaleAdjustmentError } from "./errors";
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

// A transition refused because the page is behind the server: refetch exactly the detail
// the screen is showing (same key as useAdjustment) so stale actions disappear.
function useStaleAdjustmentRefresh() {
  const client = useQueryClient();
  const warehouseId = useAppStore((state) => state.warehouseId);
  return async (error: unknown, id: string) => {
    if (isStaleAdjustmentError(error)) {
      await client.invalidateQueries({ queryKey: adjustmentKeys.detail(id, warehouseId) });
    }
  };
}

export function useCreateAdjustment() {
  const onSuccess = useAdjustmentInvalidation(false);
  return useMutation({ mutationFn: createAdjustment, onSuccess });
}

export function useApproveAdjustment() {
  const onSuccess = useAdjustmentInvalidation(true);
  const refresh = useStaleAdjustmentRefresh();
  return useMutation({
    mutationFn: approveAdjustment,
    onSuccess,
    onError: (error, id) => refresh(error, id),
  });
}

export function useRejectAdjustment() {
  const onSuccess = useAdjustmentInvalidation(false);
  const refresh = useStaleAdjustmentRefresh();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RejectAdjustmentInput }) =>
      rejectAdjustment(id, input),
    onSuccess,
    onError: (error, { id }) => refresh(error, id),
  });
}

export function useWithdrawAdjustment() {
  const onSuccess = useAdjustmentInvalidation(false);
  const refresh = useStaleAdjustmentRefresh();
  return useMutation({
    mutationFn: withdrawAdjustment,
    onSuccess,
    onError: (error, id) => refresh(error, id),
  });
}
