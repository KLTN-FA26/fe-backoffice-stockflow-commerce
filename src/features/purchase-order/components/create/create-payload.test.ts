import { describe, expect, it } from "vitest";

import { updatePoSchema } from "@/features/purchase-order";

import { toCreateInput, toUpdateInput } from "./create-payload";
import { createEmptyLine } from "./helpers";
import { PO_CREATE_DEFAULTS } from "./types";

const withPrice = (unitPrice: string) => ({
  ...PO_CREATE_DEFAULTS,
  supplierId: "sup-1",
  warehouseId: "wh-1",
  lines: [{ ...createEmptyLine(), skuId: "SKU-1", description: "Vải", unitPrice }],
});

describe("toCreateInput — giá dòng (BE #118)", () => {
  it("ô giá trống ⇒ không gửi trường unitPrice (BE lấy giá danh mục)", () => {
    const wire: unknown = JSON.parse(JSON.stringify(toCreateInput(withPrice(""))));
    expect(wire).toMatchObject({ lines: [{ sku: "SKU-1" }] });
    expect(JSON.stringify(wire)).not.toContain("unitPrice");
  });

  it("có giá gõ ⇒ gửi đúng giá đó", () => {
    expect(toCreateInput(withPrice("1500")).lines[0]?.unitPrice).toBe(1500);
  });
});

describe("toUpdateInput (BE SCRUM-462)", () => {
  const LINE_ID = "33333333-3333-4333-8333-333333333333";
  const edit = (lines: ReturnType<typeof createEmptyLine>[]) =>
    toUpdateInput(
      { ...PO_CREATE_DEFAULTS, warehouseId: "wh-1", expectedDate: "2099-01-01", lines },
      4,
    );

  it("dòng có lineId luôn có unitPrice, dòng mới để trống thì không", () => {
    const wire: unknown = JSON.parse(
      JSON.stringify(
        edit([
          { ...createEmptyLine(), lineId: LINE_ID, skuId: "SKU-1", unitPrice: "1500" },
          { ...createEmptyLine(), skuId: "SKU-2", unitPrice: "" },
        ]),
      ),
    );
    expect(wire).toMatchObject({
      version: 4,
      warehouseId: "wh-1",
      expectedAt: "2099-01-01",
      lines: [{ lineId: LINE_ID, sku: "SKU-1", unitPrice: 1500 }, { sku: "SKU-2" }],
    });
    const second = (wire as { lines: Record<string, unknown>[] }).lines[1];
    expect(second).not.toHaveProperty("lineId");
    expect(second).not.toHaveProperty("unitPrice");
  });

  it("dòng đã lưu để trống giá → updatePoSchema từ chối; dòng mới trống giá → hợp lệ", () => {
    const base = { ...createEmptyLine(), skuId: "SKU-1", description: "Vải", orderedQty: "2" };
    const saved = edit([{ ...base, lineId: LINE_ID, unitPrice: "" }]);
    expect(updatePoSchema.safeParse(saved).success).toBe(false);
    const fresh = edit([{ ...base, unitPrice: "" }]);
    expect(JSON.stringify(fresh)).not.toContain("unitPrice");
    expect(updatePoSchema.safeParse(fresh).success).toBe(true);
  });

  it("không gửi supplierId / currency (BR-07: không đổi NCC, tiền tệ)", () => {
    const wire = edit([{ ...createEmptyLine(), skuId: "SKU-1" }]);
    expect(wire).not.toHaveProperty("supplierId");
    expect(wire).not.toHaveProperty("currency");
  });
});
