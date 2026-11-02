import { describe, expect, it } from "vitest";

import { LOAD_PLAN_FIELD_MESSAGES as M, LOAD_PLAN_LIMITS } from "@/constants";

import {
  addPackagesSchema,
  createPlanFormSchema,
  createTransferPlanFormSchema,
  planInputsSchema,
  planReasonSchema,
  transferPlanInputsSchema,
} from "./input-schemas";

const valid = {
  warehouseId: "WH-HN-01",
  shipmentIds: ["s-1"],
  vehicleTypeIds: ["t-1"],
  selectionMode: "SINGLE_TYPE",
};

describe("createPlanFormSchema (CreateLoadPlanRequest)", () => {
  it("accepts a full plan and trims the note", () => {
    const parsed = createPlanFormSchema.parse({ ...valid, note: "  gấp  " });
    expect(parsed.note).toBe("gấp");
  });

  it.each([
    [{ warehouseId: "" }, M.warehouseRequired],
    [{ shipmentIds: [] }, M.shipmentsRequired],
    [{ vehicleTypeIds: [] }, M.vehicleTypesRequired],
  ])("rejects %j with the Vietnamese message", (patch, message) => {
    const result = createPlanFormSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("caps shipments at 200 and vehicle types at 50 like the BE @Size", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);
    expect(
      createPlanFormSchema.safeParse({ ...valid, shipmentIds: ids(LOAD_PLAN_LIMITS.shipmentsMax) })
        .success,
    ).toBe(true);
    expect(createPlanFormSchema.safeParse({ ...valid, shipmentIds: ids(201) }).success).toBe(false);
    expect(createPlanFormSchema.safeParse({ ...valid, vehicleTypeIds: ids(51) }).success).toBe(
      false,
    );
  });

  it("only knows SINGLE_TYPE and FEWEST_VEHICLES (LP-6)", () => {
    expect(planInputsSchema.safeParse({ ...valid, selectionMode: "FEWEST_VEHICLES" }).success).toBe(
      true,
    );
    expect(planInputsSchema.safeParse({ ...valid, selectionMode: "BEST" }).success).toBe(false);
  });

  it("limits the note to 500 characters", () => {
    expect(createPlanFormSchema.safeParse({ ...valid, note: "x".repeat(501) }).success).toBe(false);
  });
});

describe("planReasonSchema (reopen / cancel)", () => {
  it("requires a non-blank reason and trims it", () => {
    expect(planReasonSchema.parse({ reason: "  Khách đổi lịch  " }).reason).toBe("Khách đổi lịch");
    const blank = planReasonSchema.safeParse({ reason: "   " });
    expect(blank.error?.issues[0]?.message).toBe(M.reasonRequired);
  });

  it("limits the reason to 500 characters (LoadPlanReasonRequest)", () => {
    expect(planReasonSchema.safeParse({ reason: "x".repeat(500) }).success).toBe(true);
    expect(planReasonSchema.safeParse({ reason: "x".repeat(501) }).error?.issues[0]?.message).toBe(
      M.reasonTooLong,
    );
  });
});

describe("addPackagesSchema", () => {
  it("allows up to 500 package ids", () => {
    expect(
      addPackagesSchema.safeParse(Array.from({ length: 500 }, (_, i) => `p-${i}`)).success,
    ).toBe(true);
    expect(
      addPackagesSchema.safeParse(Array.from({ length: 501 }, (_, i) => `p-${i}`)).success,
    ).toBe(false);
  });
});

describe("transferPlanInputsSchema / createTransferPlanFormSchema (BE PR #164: transferOrderIds @Size(max = 1))", () => {
  const transfer = {
    warehouseId: "WH-HN-01",
    transferOrderIds: ["to-1"],
    vehicleTypeIds: ["t-1"],
    selectionMode: "SINGLE_TYPE",
  };

  it("accepts exactly ONE transfer order and trims the note", () => {
    expect(createTransferPlanFormSchema.parse({ ...transfer, note: "  gấp " }).note).toBe("gấp");
    expect(transferPlanInputsSchema.safeParse(transfer).success).toBe(true);
  });

  it.each([
    [{ transferOrderIds: [] }, M.transferRequired],
    [{ transferOrderIds: ["a", "b"] }, M.transferOnlyOne],
    [{ vehicleTypeIds: [] }, M.vehicleTypesRequired],
    [{ warehouseId: "" }, M.warehouseRequired],
  ])("rejects %j with the Vietnamese message", (patch, message) => {
    const result = createTransferPlanFormSchema.safeParse({ ...transfer, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("the order schema is unchanged: it still wants shipments and ignores transfer ids", () => {
    expect(
      createPlanFormSchema.safeParse({ ...valid, shipmentIds: [] }).error?.issues[0]?.message,
    ).toBe(M.shipmentsRequired);
    expect(LOAD_PLAN_LIMITS.transferOrdersMax).toBe(1);
  });
});
