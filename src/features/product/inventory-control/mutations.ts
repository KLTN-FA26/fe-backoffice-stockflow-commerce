import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateInventoryControl } from "./api";
import { inventoryControlKeys } from "./queries";

import type { InventoryPolicyReplacement } from "./form-model";

export function useUpdateInventoryControl(productId: string, variantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: InventoryPolicyReplacement) =>
      updateInventoryControl(productId, variantId, body),
    retry: false,
    onMutate: async () => {
      await client.cancelQueries({
        queryKey: inventoryControlKeys.detail(productId, variantId),
        exact: true,
      });
    },
    onSuccess: async (value) => {
      const key = inventoryControlKeys.detail(productId, variantId);
      await client.cancelQueries({ queryKey: key, exact: true });
      client.setQueryData(key, value);
    },
  });
}
