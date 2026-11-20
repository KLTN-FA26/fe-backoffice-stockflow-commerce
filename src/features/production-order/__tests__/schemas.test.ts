import { describe, expect, it } from "vitest";

import { expectedDateInput, productionOrderEditInput } from "../input-schemas";
import { productionOrderDto } from "../schemas";
import { editValuesOf } from "../selectors";
import { productionOrder } from "../__fixtures__/production-order";

describe("productionOrderDto (contract BE ProductionOrderResponse)", () => {
  it("parse đơn không có field null (Jackson non_null) và không có tiền", () => {
    const { history, ...raw } = productionOrder({ capacity: undefined, note: undefined });
    void history;
    const parsed = productionOrderDto.parse({ ...raw, capacityComputed: true, unitPrice: 1000 });
    expect(parsed.code).toBe("PRD-20261120-0001");
    expect("unitPrice" in parsed).toBe(false);
  });

  it("từ chối trạng thái ngoài docs 17 §5.3", () => {
    expect(() => productionOrderDto.parse({ ...productionOrder(), status: "PLANNED" })).toThrow();
  });
});

describe("productionOrderEditInput", () => {
  const values = editValuesOf(productionOrder());

  it("BR-24: mặc định cần duyệt mẫu mà tắt thì bắt buộc lý do", () => {
    const off = { ...values, sampleApprovalRequired: false, sampleWaiverReason: "" };
    expect(productionOrderEditInput.safeParse(off).success).toBe(false);
    expect(
      productionOrderEditInput.safeParse({ ...off, sampleWaiverReason: "SKU đã in ở đơn khác" })
        .success,
    ).toBe(true);
  });

  it("BR-24: không mặc định bật thì tắt không cần lý do", () => {
    const off = {
      ...values,
      sampleRequiredByDefault: false,
      sampleApprovalRequired: false,
      sampleWaiverReason: "",
    };
    expect(productionOrderEditInput.safeParse(off).success).toBe(true);
  });

  it("BR-05: số thùng nguyên ≥ 1", () => {
    for (const cartons of ["0", "-1", "1.5", ""]) {
      const lines = [{ ...values.lines[0], cartons }, values.lines[1]];
      expect(productionOrderEditInput.safeParse({ ...values, lines }).success).toBe(false);
    }
  });
});

describe("expectedDateInput", () => {
  it("ngày dự kiến không ở quá khứ; bắt buộc trừ khi bắt đầu sản xuất", () => {
    const at = (date: string) => ({ date, note: "" });
    expect(expectedDateInput(false).safeParse(at("")).success).toBe(false);
    expect(expectedDateInput(true).safeParse(at("")).success).toBe(true);
    expect(expectedDateInput(false).safeParse(at("2000-01-01")).success).toBe(false);
    expect(expectedDateInput(false).safeParse(at("2999-01-01")).success).toBe(true);
  });

  it("ghi chú nhận đơn tuỳ chọn, tối đa 500 ký tự sau khi cắt khoảng trắng (docs 17 §4.3 bước 8)", () => {
    const schema = expectedDateInput(false);
    const date = "2999-01-01";
    expect(schema.parse({ date, note: "  Zalo  " }).note).toBe("Zalo");
    expect(schema.safeParse({ date, note: "x".repeat(500) }).success).toBe(true);
    expect(schema.safeParse({ date, note: "x".repeat(501) }).success).toBe(false);
  });
});
