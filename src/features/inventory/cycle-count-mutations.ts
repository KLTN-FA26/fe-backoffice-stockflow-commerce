import { useMutation, useQueryClient } from "@tanstack/react-query";

import { CYCLE_COUNT_QUERY_KEYS } from "@/constants/cycle-count";

import { useAppStore } from "@/lib/store/use-app-store";

import {
  addCycleCountLine,
  cancelCycleCount,
  countCycleCountLine,
  recountCycleCount,
  submitCycleCount,
} from "./cycle-count-api";
import { isStaleCycleCountError } from "./cycle-count-errors";
import { cycleCountKeys } from "./cycle-count-queries";
import { adjustmentKeys } from "./queries";

import type {
  AddCountLineInput,
  CancelCycleCountInput,
  CountLineInput,
  CycleCount,
  RecountCycleCountInput,
} from "./cycle-count-types";

// Every write answers the whole sheet: put it straight into the detail cache (no refetch flicker between two
// scans) and refresh the list, whose counted / variance figures moved.
function useCycleCountWrite() {
  const client = useQueryClient();
  const warehouseId = useAppStore((state) => state.warehouseId);
  return {
    applied: async (count: CycleCount) => {
      client.setQueryData(cycleCountKeys.detail(count.id, warehouseId), count);
      await client.invalidateQueries({ queryKey: [...cycleCountKeys.all, "list"] });
    },
    // The sheet changed under the screen (closed, line counted elsewhere, stock moved): reload it.
    refreshOnStale: async (error: unknown, id: string) => {
      if (isStaleCycleCountError(error)) {
        await client.invalidateQueries({ queryKey: cycleCountKeys.detail(id, warehouseId) });
      }
    },
    client,
  };
}

export function useCountCycleCountLine(id: string) {
  const { applied, refreshOnStale } = useCycleCountWrite();
  return useMutation({
    mutationFn: ({ lineId, input }: { lineId: string; input: CountLineInput }) =>
      countCycleCountLine(id, lineId, input),
    onSuccess: applied,
    onError: (error) => refreshOnStale(error, id),
  });
}

export function useAddCycleCountLine(id: string) {
  const { applied, refreshOnStale } = useCycleCountWrite();
  return useMutation({
    mutationFn: (input: AddCountLineInput) => addCycleCountLine(id, input),
    onSuccess: applied,
    onError: (error) => refreshOnStale(error, id),
  });
}

// Submitting raises COUNT_VARIANCE adjustments (docs 20 §4.2 c8): the approver's queue changes. Stock does
// not move until an approval, so the stock roots are left alone (BR-08).
export function useSubmitCycleCount(id: string) {
  const { applied, refreshOnStale, client } = useCycleCountWrite();
  return useMutation({
    mutationFn: () => submitCycleCount(id),
    onSuccess: async (count) => {
      await applied(count);
      await client.invalidateQueries({ queryKey: adjustmentKeys.all });
    },
    onError: (error) => refreshOnStale(error, id),
  });
}

export function useCancelCycleCount(id: string) {
  const { applied, refreshOnStale, client } = useCycleCountWrite();
  return useMutation({
    mutationFn: (input: CancelCycleCountInput) => cancelCycleCount(id, input),
    onSuccess: async (count) => {
      await applied(count);
      // A cancelled SHORT_PICK count frees its carton for sale again (docs 20 BR-11).
      await client.invalidateQueries({ queryKey: [CYCLE_COUNT_QUERY_KEYS.stock] });
    },
    onError: (error) => refreshOnStale(error, id),
  });
}

// Returns the NEW blind sheet; the old one stays as it is (docs 20 §4.2 d11).
export function useRecountCycleCount(id: string) {
  const { applied, refreshOnStale } = useCycleCountWrite();
  return useMutation({
    mutationFn: (input: RecountCycleCountInput) => recountCycleCount(id, input),
    onSuccess: applied,
    onError: (error) => refreshOnStale(error, id),
  });
}
