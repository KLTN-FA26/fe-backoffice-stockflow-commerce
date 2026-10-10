import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { updateInventoryControl } from "./api";
import {
  inventoryPolicyInputSchema,
  inventoryPolicyDraftSchema,
  draftToPolicy,
} from "./form-model";

const policy = {
  reorderPoint: null,
  safetyStock: null,
  removalStrategy: "FIFO",
  trackingMode: "NONE",
  expiryTracked: false,
  maxShelfLifeDays: null,
};
afterEach(() => vi.restoreAllMocks());
describe("versioned Inventory Control replacement", () => {
  it("rejects SKU-code substitution before PUT", async () => {
    const put = vi.spyOn(api, "put");
    await expect(
      updateInventoryControl("11111111-1111-4111-8111-111111111111", "CHAIR-BLUE", {
        ...inventoryPolicyInputSchema.parse(policy),
        version: 7,
      }),
    ).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });
  it.each(["mismatch", "malformed"])("rejects a %s PUT response", async (kind) => {
    const productId = "11111111-1111-4111-8111-111111111111";
    const variantId = "22222222-2222-4222-8222-222222222222";
    vi.spyOn(api, "put").mockResolvedValue({
      data: {
        skuId: kind === "mismatch" ? productId : variantId,
        sku: "CHAIR",
        unitOfMeasure: "EACH",
        version: 15,
        removalStrategy: kind === "malformed" ? "UNKNOWN" : "FIFO",
        trackingMode: "NONE",
        expiryTracked: false,
        usableOnHand: 0,
      },
    });
    await expect(
      updateInventoryControl(productId, variantId, {
        ...inventoryPolicyInputSchema.parse(policy),
        version: 7,
      }),
    ).rejects.toThrow();
  });
  it("preserves blank/null, zero, enums and false", () => {
    expect(
      draftToPolicy(
        inventoryPolicyDraftSchema.parse({
          ...policy,
          reorderPoint: "",
          safetyStock: "0",
          maxShelfLifeDays: "",
        }),
      ),
    ).toEqual({ ...policy, safetyStock: 0 });
  });
  it.each(["1e", "1e309", "9007199254740993", "1.5", "-1", "0.99999999999999999"])(
    "rejects invalid integer %s",
    (value) => {
      expect(
        inventoryPolicyDraftSchema.safeParse({
          ...policy,
          reorderPoint: value,
          safetyStock: "",
          maxShelfLifeDays: "",
        }).success,
      ).toBe(false);
    },
  );
  it("rejects safety stock above configured reorder point", () => {
    expect(
      inventoryPolicyInputSchema.safeParse({ ...policy, reorderPoint: 0, safetyStock: 1 }).success,
    ).toBe(false);
  });
  it.each(["NONE", "SERIAL"])("rejects expiry with incompatible %s", (trackingMode) => {
    expect(
      inventoryPolicyInputSchema.safeParse({
        ...policy,
        expiryTracked: true,
        removalStrategy: "FEFO",
        trackingMode,
      }).success,
    ).toBe(false);
  });
  it("requires FEFO for expiry", () => {
    expect(
      inventoryPolicyInputSchema.safeParse({ ...policy, expiryTracked: true, trackingMode: "LOT" })
        .success,
    ).toBe(false);
  });
  it.each(["LOT", "LOT_SERIAL"])("accepts expiry with FEFO/%s", (trackingMode) => {
    expect(
      inventoryPolicyInputSchema.safeParse({
        ...policy,
        expiryTracked: true,
        removalStrategy: "FEFO",
        trackingMode,
        maxShelfLifeDays: 36500,
      }).success,
    ).toBe(true);
  });
  it.each([0, 36501])("rejects out-of-contract shelf life %s", (maxShelfLifeDays) => {
    expect(
      inventoryPolicyInputSchema.safeParse({
        ...policy,
        expiryTracked: true,
        removalStrategy: "FEFO",
        trackingMode: "LOT",
        maxShelfLifeDays,
      }).success,
    ).toBe(false);
  });
  it("requires expiry for shelf life", () => {
    expect(inventoryPolicyInputSchema.safeParse({ ...policy, maxShelfLifeDays: 1 }).success).toBe(
      false,
    );
  });
  it("PUT uses both UUIDs, full replacement and exact base version; accepts returned server version", async () => {
    const productId = "11111111-1111-4111-8111-111111111111";
    const variantId = "22222222-2222-4222-8222-222222222222";
    const put = vi.spyOn(api, "put").mockResolvedValue({
      data: {
        skuId: variantId,
        sku: "CHAIR",
        unitOfMeasure: "EACH",
        version: 15,
        removalStrategy: "FIFO",
        trackingMode: "NONE",
        expiryTracked: false,
        usableOnHand: 0,
        reorderPoint: 9,
      },
    });
    try {
      const result = await updateInventoryControl(productId, variantId, {
        ...inventoryPolicyInputSchema.parse(policy),
        version: 7,
      });
      expect(put).toHaveBeenCalledExactlyOnceWith(
        `/products/${productId}/skus/${variantId}/inventory-control`,
        { ...policy, version: 7 },
      );
      expect(result.concurrency.version).toBe(15);
      expect(result.policy.reorderPoint).toBe(9);
    } finally {
      put.mockRestore();
    }
  });
});
