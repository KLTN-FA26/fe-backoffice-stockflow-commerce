import { api } from "@/lib/api/client";

import { canonicalVariantRouteSchema } from "../variant-schemas";
import { INVENTORY_CONTROL_TEXT } from "./constants";
import { inventoryPolicyReplacementSchema } from "./form-model";
import { inventoryControlResponseSchema } from "./schemas";
import { mapInventoryControl } from "./view-model";

import type { InventoryPolicyReplacement } from "./form-model";

const policyPath = (productId: string, variantId: string) =>
  `/products/${encodeURIComponent(productId)}/skus/${encodeURIComponent(variantId)}/inventory-control`;

export class InventoryControlIdentityError extends Error {
  constructor() {
    super(INVENTORY_CONTROL_TEXT.mismatch);
  }
}

export async function getInventoryControl(
  productId: string,
  variantId: string,
  signal?: AbortSignal,
) {
  const ids = canonicalVariantRouteSchema.parse({ productId, variantId });
  // Shared client unwraps ApiResponse and translates HTTP failures to ApiError.
  const { data } = await api.get<unknown>(policyPath(ids.productId, ids.variantId), { signal });
  const dto = inventoryControlResponseSchema.parse(data);
  if (dto.skuId !== ids.variantId) throw new InventoryControlIdentityError();
  return mapInventoryControl(dto, ids.productId);
}

export async function updateInventoryControl(
  productId: string,
  variantId: string,
  replacement: InventoryPolicyReplacement,
) {
  const ids = canonicalVariantRouteSchema.parse({ productId, variantId });
  const body = inventoryPolicyReplacementSchema.parse(replacement);
  const { data } = await api.put<unknown>(policyPath(ids.productId, ids.variantId), body);
  const dto = inventoryControlResponseSchema.parse(data);
  if (dto.skuId !== ids.variantId) throw new InventoryControlIdentityError();
  return mapInventoryControl(dto, ids.productId);
}
