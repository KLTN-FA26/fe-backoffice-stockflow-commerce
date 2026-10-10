import type { InventoryControlResponse } from "./schemas";

export function mapInventoryControl(dto: InventoryControlResponse, productId: string) {
  return {
    context: { productId, variantId: dto.skuId, sku: dto.sku, unitOfMeasure: dto.unitOfMeasure },
    concurrency: { version: dto.version },
    policy: {
      reorderPoint: dto.reorderPoint ?? null,
      safetyStock: dto.safetyStock ?? null,
      removalStrategy: dto.removalStrategy,
      trackingMode: dto.trackingMode,
      expiryTracked: dto.expiryTracked,
      maxShelfLifeDays: dto.maxShelfLifeDays ?? null,
    },
    evaluation: {
      usableOnHand: dto.usableOnHand,
      reorderRequired: dto.reorderRequired ?? null,
      belowSafetyStock: dto.belowSafetyStock ?? null,
    },
  };
}

export type InventoryControlViewModel = ReturnType<typeof mapInventoryControl>;
