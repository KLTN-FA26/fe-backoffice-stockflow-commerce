import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { getInventoryControl } from "./api";
import { inventoryControlResponseSchema } from "./schemas";
import { mapInventoryControl } from "./view-model";

const productId = "11111111-1111-4111-8111-111111111111";
const variantId = "22222222-2222-4222-8222-222222222222";
const response = {
  skuId: variantId,
  sku: "CHAIR-BLUE",
  unitOfMeasure: "EACH",
  version: 7,
  removalStrategy: "FIFO",
  trackingMode: "NONE",
  expiryTracked: false,
  usableOnHand: 12,
};
afterEach(() => vi.restoreAllMocks());

describe("Inventory Control read contract", () => {
  it("uses canonical Product/Variant UUIDs and cancellation", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: response });
    const signal = new AbortController().signal;
    const result = await getInventoryControl(productId, variantId, signal);
    expect(get).toHaveBeenCalledExactlyOnceWith(
      `/products/${productId}/skus/${variantId}/inventory-control`,
      { signal },
    );
    expect(result.context).toEqual({
      productId,
      variantId,
      sku: response.sku,
      unitOfMeasure: "EACH",
    });
    expect(result.concurrency.version).toBe(7);
  });
  it("parses the real ApiResponse through the shared client interceptor", async () => {
    const previous = api.defaults.adapter;
    api.defaults.adapter = async (config) => ({
      data: { success: true, data: response, timestamp: "2026-10-10T00:00:00Z" },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    });
    try {
      expect((await getInventoryControl(productId, variantId)).concurrency.version).toBe(7);
    } finally {
      api.defaults.adapter = previous;
    }
  });
  it("rejects SKU-code substitution without an HTTP call", async () => {
    const get = vi.spyOn(api, "get");
    await expect(getInventoryControl(productId, "CHAIR-BLUE")).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });
  it("rejects response UUID mismatch", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { ...response, skuId: productId } });
    await expect(getInventoryControl(productId, variantId)).rejects.toThrow("không khớp");
  });
  it.each(["FIFO", "FEFO"])("parses removal strategy %s", (removalStrategy) => {
    expect(
      inventoryControlResponseSchema.parse({ ...response, removalStrategy }).removalStrategy,
    ).toBe(removalStrategy);
  });
  it.each(["NONE", "LOT", "SERIAL", "LOT_SERIAL"])("parses tracking mode %s", (trackingMode) => {
    expect(inventoryControlResponseSchema.parse({ ...response, trackingMode }).trackingMode).toBe(
      trackingMode,
    );
  });
  it.each(["removalStrategy", "trackingMode"])("rejects unknown %s", (field) => {
    expect(
      inventoryControlResponseSchema.safeParse({ ...response, [field]: "UNKNOWN" }).success,
    ).toBe(false);
  });
  it("maps omitted thresholds, shelf life and evaluated booleans to unknown", () => {
    const vm = mapInventoryControl(inventoryControlResponseSchema.parse(response), productId);
    expect(vm.policy.reorderPoint).toBeNull();
    expect(vm.policy.safetyStock).toBeNull();
    expect(vm.policy.maxShelfLifeDays).toBeNull();
    expect(vm.evaluation.reorderRequired).toBeNull();
    expect(vm.evaluation.belowSafetyStock).toBeNull();
  });
  it("preserves zero and false without recalculating evaluation", () => {
    const vm = mapInventoryControl(
      inventoryControlResponseSchema.parse({
        ...response,
        reorderPoint: 0,
        safetyStock: 0,
        maxShelfLifeDays: 0,
        reorderRequired: true,
        belowSafetyStock: false,
      }),
      productId,
    );
    expect(vm.policy).toMatchObject({
      reorderPoint: 0,
      safetyStock: 0,
      maxShelfLifeDays: 0,
      expiryTracked: false,
    });
    expect(vm.evaluation).toEqual({
      usableOnHand: 12,
      reorderRequired: true,
      belowSafetyStock: false,
    });
    expect(vm.policy).not.toHaveProperty("usableOnHand");
    expect(vm.evaluation).not.toHaveProperty("reorderPoint");
  });
  it.each([
    "skuId",
    "sku",
    "unitOfMeasure",
    "version",
    "expiryTracked",
    "usableOnHand",
    "removalStrategy",
    "trackingMode",
  ])("requires primitive/context field %s", (field) => {
    expect(
      inventoryControlResponseSchema.safeParse({ ...response, [field]: undefined }).success,
    ).toBe(false);
  });
  it.each([
    "reorderPoint",
    "safetyStock",
    "maxShelfLifeDays",
    "reorderRequired",
    "belowSafetyStock",
  ])("rejects explicit null for omitted-on-null field %s", (field) => {
    expect(inventoryControlResponseSchema.safeParse({ ...response, [field]: null }).success).toBe(
      false,
    );
  });
});
