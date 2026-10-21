import { describe, expect, it } from "vitest";

import { evaluationState, isLotTracked, policyToForm } from "./selectors";

describe("evaluationState", () => {
  it("true/false/null → yes/no/unset", () => {
    expect(
      evaluationState({
        usableOnHand: 3,
        reorderPoint: 5,
        safetyStock: null,
        reorderRequired: true,
        belowSafetyStock: null,
      }),
    ).toEqual({ reorder: "yes", belowSafety: "unset" });
    expect(
      evaluationState({ usableOnHand: 9, reorderRequired: false, belowSafetyStock: false }),
    ).toEqual({ reorder: "no", belowSafety: "no" });
  });
});

describe("policyToForm", () => {
  it("null thành chuỗi rỗng, số thành chuỗi", () => {
    expect(
      policyToForm({
        reorderPoint: 10,
        safetyStock: null,
        maxQty: undefined,
        removalStrategy: "FEFO",
        trackingMode: "LOT",
        expiryTracked: true,
        maxShelfLifeDays: 30,
      }),
    ).toEqual({
      reorderPoint: "10",
      safetyStock: "",
      maxQty: "",
      maxShelfLifeDays: "30",
      removalStrategy: "FEFO",
      trackingMode: "LOT",
      expiryTracked: true,
    });
  });
});

describe("isLotTracked", () => {
  it("chỉ LOT và LOT_SERIAL", () => {
    expect(["NONE", "LOT", "SERIAL", "LOT_SERIAL"].map((m) => isLotTracked(m as never))).toEqual([
      false,
      true,
      false,
      true,
    ]);
  });
});
