import { useMutation, useQueryClient } from "@tanstack/react-query";

import { INVENTORY_QUERY_KEYS } from "@/constants/inventory";

import { quarantineCarton, releaseCarton } from "./quarantine-api";
import { cartonKeys } from "./quarantine-queries";

import type { QuarantineInput } from "./quarantine-types";

// Quarantine and release change a carton's place and stock status, never its quantity (docs 20 §4.8): the carton
// and the stock browsing roots refresh; the approver's queue does not.
function useCartonInvalidation() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: cartonKeys.all }),
      client.invalidateQueries({ queryKey: [INVENTORY_QUERY_KEYS.stock] }),
    ]);
  };
}

export function useQuarantineCarton(lpn: string) {
  const onSuccess = useCartonInvalidation();
  return useMutation({
    mutationFn: (input: QuarantineInput) => quarantineCarton(lpn, input),
    onSuccess,
  });
}

export function useReleaseCarton(lpn: string) {
  const onSuccess = useCartonInvalidation();
  return useMutation({ mutationFn: () => releaseCarton(lpn), onSuccess });
}
