import { api } from "@/lib/api/client";

import { beInventoryControlSchema } from "./inventory-control-schemas";

import type { InventoryControl, InventoryControlFormValues } from "./inventory-control-schemas";

const path = (productId: string, variantId: string) =>
  `/products/${encodeURIComponent(productId)}/skus/${encodeURIComponent(variantId)}/inventory-control`;

export async function getInventoryControl(
  productId: string,
  variantId: string,
  signal?: AbortSignal,
): Promise<InventoryControl> {
  const { data } = await api.get<unknown>(path(productId, variantId), { signal });
  return beInventoryControlSchema.parse(data);
}

const orNull = (raw: string) => (raw.trim() === "" ? null : Number(raw));

/** Form → `UpdateInventoryControlRequest`: PUT thay toàn bộ, ngưỡng `null` = xoá ngưỡng. */
export function toInventoryControlRequest(values: InventoryControlFormValues, version: number) {
  return {
    version,
    reorderPoint: orNull(values.reorderPoint),
    safetyStock: orNull(values.safetyStock),
    removalStrategy: values.removalStrategy,
    trackingMode: values.trackingMode,
    expiryTracked: values.expiryTracked,
    maxShelfLifeDays: orNull(values.maxShelfLifeDays),
  };
}

export async function saveInventoryControl(input: {
  productId: string;
  variantId: string;
  version: number;
  values: InventoryControlFormValues;
}): Promise<InventoryControl> {
  const { data } = await api.put<unknown>(
    path(input.productId, input.variantId),
    toInventoryControlRequest(input.values, input.version),
  );
  return beInventoryControlSchema.parse(data);
}
