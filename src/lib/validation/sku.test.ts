import { describe, expect, it } from "vitest";

import { optionalSkuSchema, SKU_CODE_PATTERN, SKU_INPUT_PATTERN, skuSchema } from "./sku";

// Nguồn: BE `common.domain.Sku` — `[A-Z0-9][A-Z0-9._-]{0,63}` sau khi strip + upper-case.
describe("skuSchema (BE @ValidSku)", () => {
  it.each(["CUP_12", "A.B", "X", "cup-pp.500_a", "  CUP-PP-500  ", "A".repeat(64)])(
    "chấp nhận %j",
    (sku) => {
      expect(skuSchema().safeParse(sku).success).toBe(true);
    },
  );

  it.each(["", "   ", "_A", ".A", "-A", "A B", "A/B", "Á", "A".repeat(65)])("từ chối %j", (sku) => {
    expect(skuSchema().safeParse(sku).success).toBe(false);
  });

  it("trim trước khi kiểm tra và trả giá trị đã trim", () => {
    expect(skuSchema().parse("  cup_12 ")).toBe("cup_12");
  });

  it("dùng thông điệp do form truyền vào", () => {
    const result = skuSchema({ required: "Thiếu", format: "Sai" });
    expect(result.safeParse("").error?.issues[0]?.message).toBe("Thiếu");
    expect(result.safeParse("a b").error?.issues[0]?.message).toBe("Sai");
  });
});

describe("optionalSkuSchema", () => {
  it("để trống hợp lệ (BE tự sinh), có giá trị thì phải đúng mẫu", () => {
    expect(optionalSkuSchema().safeParse("").success).toBe(true);
    expect(optionalSkuSchema().safeParse("  ").success).toBe(true);
    expect(optionalSkuSchema().safeParse("CUP_12").success).toBe(true);
    expect(optionalSkuSchema().safeParse("-bad").success).toBe(false);
  });
});

describe("mẫu SKU", () => {
  it("mẫu nhập chấp nhận chữ thường, mẫu chuẩn BE chỉ chữ in hoa", () => {
    expect(SKU_INPUT_PATTERN.test("cup_12")).toBe(true);
    expect(SKU_CODE_PATTERN.test("cup_12")).toBe(false);
    expect(SKU_CODE_PATTERN.test("CUP_12")).toBe(true);
  });
});
