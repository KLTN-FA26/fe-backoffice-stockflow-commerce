import { describe, expect, it } from "vitest";

import { comboKey, matrixDefaultName, planMatrix } from "./mock-variant-matrix";

import type { MatrixAxis } from "./mock-variant-matrix";

const axis = (attributeId: string, code: string, values: string[]): MatrixAxis => ({
  attributeId,
  code,
  name: code,
  options: values.map((v) => ({ valueId: `${code}-${v}`, code: v, label: `Nhãn ${v}` })),
});
const base = {
  productCode: "cup",
  productName: "Ly",
  existingCombos: new Set<string>(),
  existingSkus: new Set<string>(),
  defaultUnassigned: false,
  bornWithMatrix: false,
};
const planned = (plan: ReturnType<typeof planMatrix>) => {
  if (plan.error) throw new Error("expected a plan");
  return plan;
};

describe("planMatrix (BE VariantMatrix / SkuCodeRule)", () => {
  it("enumerates with the first axis varying slowest; SKU is CODE-VALUE-VALUE with the code upper-cased", () => {
    const plan = planned(
      planMatrix({
        ...base,
        axes: [axis("c", "COLOR", ["W", "B"]), axis("s", "SIZE", ["S", "M"])],
      }),
    );
    expect(plan.toInsert.map((p) => p.sku)).toEqual(["CUP-W-S", "CUP-W-M", "CUP-B-S", "CUP-B-M"]);
    expect(plan.toInsert[0]?.name).toBe("Ly – Nhãn W / Nhãn S");
    expect(plan.skipped).toBe(0);
    expect(plan.forDefault).toBeNull();
  });

  it("skips combinations that exist (by value set) and counts them", () => {
    const plan = planned(
      planMatrix({
        ...base,
        axes: [axis("c", "COLOR", ["W", "B"]), axis("s", "SIZE", ["S"])],
        existingCombos: new Set([comboKey(["COLOR-W", "SIZE-S"])]),
      }),
    );
    expect(plan.toInsert.map((p) => p.sku)).toEqual(["CUP-B-S"]);
    expect(plan.skipped).toBe(1);
  });

  it("born with the matrix: the first combination is the default variant; otherwise none is", () => {
    const axes = [axis("c", "COLOR", ["W", "B"])];
    expect(
      planned(planMatrix({ ...base, axes, bornWithMatrix: true })).toInsert.map((p) => p.isDefault),
    ).toEqual([true, false]);
    expect(planned(planMatrix({ ...base, axes })).toInsert.map((p) => p.isDefault)).toEqual([
      false,
      false,
    ]);
  });

  it("an unassigned default variant takes the matrix-first combination instead of a new row", () => {
    const plan = planned(
      planMatrix({ ...base, axes: [axis("c", "COLOR", ["W", "B"])], defaultUnassigned: true }),
    );
    expect(plan.forDefault?.map((c) => c.option.code)).toEqual(["W"]);
    expect(plan.toInsert.map((p) => p.sku)).toEqual(["CUP-B"]);
  });

  it("the default does not take the first combination when that one already exists", () => {
    const plan = planned(
      planMatrix({
        ...base,
        axes: [axis("c", "COLOR", ["W", "B"])],
        defaultUnassigned: true,
        existingCombos: new Set([comboKey(["COLOR-W"])]),
      }),
    );
    expect(plan.forDefault).toBeNull();
    expect(plan.toInsert.map((p) => p.sku)).toEqual(["CUP-B"]);
  });

  it("refuses more than 100 combinations from the axis sizes alone, but 100 exactly is fine", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `A${i}`);
    const ten = Array.from({ length: 10 }, (_, i) => `B${i}`);
    const over = planMatrix({ ...base, axes: [axis("a", "A", eleven), axis("b", "B", ten)] });
    expect(over.error?.data).toMatchObject({ errorCode: "VARIANT_MATRIX_TOO_LARGE" });
    const exact = planned(
      planMatrix({ ...base, axes: [axis("a", "A", eleven.slice(0, 10)), axis("b", "B", ten)] }),
    );
    expect(exact.toInsert).toHaveLength(100);
  });

  it("the cap counts what is still missing: existing variants make room (BE total − existing)", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `A${i}`);
    const ten = Array.from({ length: 10 }, (_, i) => `B${i}`);
    const existing = new Set(ten.map((b) => comboKey([`A-A0`, `B-${b}`])));
    const plan = planned(
      planMatrix({
        ...base,
        axes: [axis("a", "A", eleven), axis("b", "B", ten)],
        existingCombos: existing,
      }),
    );
    expect(plan.toInsert).toHaveLength(100);
    expect(plan.skipped).toBe(10);
  });

  it("a SKU taken by another variant, or built twice from values that contain '-', is refused (no auto suffix)", () => {
    const axes = [axis("c", "COLOR", ["W"])];
    const taken = planMatrix({ ...base, axes, existingSkus: new Set(["CUP-W"]) });
    expect(taken.error?.data).toMatchObject({ errorCode: "VARIANT_SKU_ALREADY_EXISTS" });
    // "A-B" + "C" và "A" + "B-C" cùng ra CUP-A-B-C.
    const clash = planMatrix({
      ...base,
      axes: [axis("x", "X", ["A-B", "A"]), axis("y", "Y", ["C", "B-C"])],
    });
    expect(clash.error?.data).toMatchObject({ errorCode: "VARIANT_SKU_ALREADY_EXISTS" });
  });

  it("a SKU longer than 64 characters is a validation error", () => {
    const tooLong = planMatrix({
      ...base,
      productCode: "P".repeat(63),
      axes: [axis("c", "COLOR", ["W"])],
    });
    expect(tooLong.error?.data).toMatchObject({ errorCode: "VALIDATION_FAILED" });
  });

  it("names are PRODUCT – label / label", () => {
    expect(
      matrixDefaultName("Ly", [{ option: { label: "Trắng" } }, { option: { label: "S" } }]),
    ).toBe("Ly – Trắng / S");
  });
});
