import { describe, expect, it } from "vitest";

import { SKU_PURCHASING_FIELD_MESSAGES as M } from "@/constants";

import {
  beSkuPurchasingSchema,
  canonicalDecimal,
  purchasingValuesOf,
  skuPurchasingInputSchema,
  skuPurchasingVersionSchema,
  travelsExactly,
} from "./purchasing-schemas";

import type { SkuPurchasingValues } from "./purchasing-schemas";

const VARIANT = "22222222-2222-4222-8222-222222222222";
const SUPPLIER = "33333333-3333-4333-8333-333333333333";

const empty: SkuPurchasingValues = {
  defaultSupplierId: null,
  referencePurchasePrice: null,
  referencePurchaseCurrency: null,
  leadTimeDays: null,
  moq: null,
};
const priced = (price: string, currency: string | null = "VND"): SkuPurchasingValues => ({
  ...empty,
  referencePurchasePrice: price,
  referencePurchaseCurrency: currency,
});

/** Thông báo của các lỗi theo đường dẫn field (rỗng = hợp lệ). */
function issues(values: unknown) {
  const result = skuPurchasingInputSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => [i.path.join("."), i.message]);
}

describe("beSkuPurchasingSchema (BE SkuPurchasingResponse)", () => {
  it("đọc đủ field, giá về chuỗi thập phân", () => {
    const parsed = beSkuPurchasingSchema.parse({
      variantId: VARIANT,
      sku: "CUP-12OZ",
      version: 3,
      defaultSupplierId: SUPPLIER,
      referencePurchasePrice: 12500.5,
      referencePurchaseCurrency: "VND",
      leadTimeDays: 7,
      moq: 10,
    });
    expect(parsed).toEqual({
      variantId: VARIANT,
      sku: "CUP-12OZ",
      version: 3,
      defaultSupplierId: SUPPLIER,
      referencePurchasePrice: "12500.5",
      referencePurchaseCurrency: "VND",
      leadTimeDays: 7,
      moq: 10,
    });
  });

  it("Jackson non_null bỏ field null → chuẩn hoá về null, không bịa giá trị", () => {
    const parsed = beSkuPurchasingSchema.parse({ variantId: VARIANT, sku: "CUP", version: 0 });
    expect(parsed).toMatchObject({ ...empty, version: 0 });
  });

  it("giữ số 0: leadTimeDays 0 là giao ngay, không phải chưa đặt", () => {
    const parsed = beSkuPurchasingSchema.parse({
      variantId: VARIANT,
      sku: "CUP",
      version: 1,
      leadTimeDays: 0,
    });
    expect(parsed.leadTimeDays).toBe(0);
  });

  it("giá dạng chuỗi số giữ nguyên chữ số (không qua số thực)", () => {
    const parsed = beSkuPurchasingSchema.parse({
      variantId: VARIANT,
      sku: "CUP",
      version: 1,
      referencePurchasePrice: "9999999999999999.99",
      referencePurchaseCurrency: "VND",
    });
    expect(parsed.referencePurchasePrice).toBe("9999999999999999.99");
  });

  it.each([
    ["thiếu version", { variantId: VARIANT, sku: "CUP" }],
    ["variantId rỗng", { variantId: "", sku: "CUP", version: 1 }],
    ["version âm", { variantId: VARIANT, sku: "CUP", version: -1 }],
    ["moq 0", { variantId: VARIANT, sku: "CUP", version: 1, moq: 0 }],
    [
      "giá không phải số",
      { variantId: VARIANT, sku: "CUP", version: 1, referencePurchasePrice: "abc" },
    ],
  ])("từ chối response hỏng: %s", (_, body) => {
    expect(beSkuPurchasingSchema.safeParse(body).success).toBe(false);
  });
});

describe("skuPurchasingVersionSchema (BE @NotNull @Min(0))", () => {
  it.each([[0], [7]])("nhận %s", (v) => expect(skuPurchasingVersionSchema.parse(v)).toBe(v));
  it.each([[undefined], [null], [-1], [1.5], ["3"]])("từ chối %s", (v) => {
    expect(skuPurchasingVersionSchema.safeParse(v).success).toBe(false);
  });
});

describe("skuPurchasingInputSchema (BE SkuPurchasingRequest + ItemPurchasingRules)", () => {
  it("mọi field null là hợp lệ (xoá hết)", () => {
    expect(skuPurchasingInputSchema.parse(empty)).toEqual(empty);
  });

  it("thiếu field là lỗi — PUT thay toàn bộ, không được ngầm hiểu là giữ nguyên", () => {
    const missingMoq: Record<string, unknown> = { ...empty };
    delete missingMoq.moq;
    expect(issues(missingMoq).map(([path]) => path)).toContain("moq");
  });

  it("biên hợp lệ: lead time 0 và 365, moq 1, giá 0.01", () => {
    const values = { ...priced("0.01"), leadTimeDays: 0, moq: 1, defaultSupplierId: SUPPLIER };
    expect(skuPurchasingInputSchema.parse(values)).toEqual(values);
    expect(issues({ ...empty, leadTimeDays: 365 })).toEqual([]);
  });

  it.each([
    ["leadTimeDays", -1, M.leadTimeDays],
    ["leadTimeDays", 366, M.leadTimeDays],
    ["leadTimeDays", 1.5, M.leadTimeDays],
    ["moq", 0, M.moq],
    ["moq", -3, M.moq],
    ["moq", 2.5, M.moq],
    ["moq", 2_147_483_648, M.moq],
  ])("%s = %s bị từ chối", (field, value, message) => {
    expect(issues({ ...empty, [field]: value })).toEqual([[field, message]]);
  });

  it.each([["0"], ["0.00"], ["-1"], ["1.005"], ["12345678901234567"], ["1e3"], ["abc"], [""]])(
    "giá %s sai dạng / ngoài giới hạn BE",
    (price) => {
      expect(issues(priced(price))).toEqual([["referencePurchasePrice", M.referencePurchasePrice]]);
    },
  );

  it("bỏ 0 cuối như BE stripTrailingZeros: 1.500 hợp lệ và gửi là 1.5", () => {
    expect(skuPurchasingInputSchema.parse(priced(" 0012.500 ")).referencePurchasePrice).toBe(
      "12.5",
    );
  });

  it("giá BE nhận nhưng JSON number không chở nguyên vẹn → báo, không làm tròn ngầm", () => {
    expect(issues(priced("9999999999999999.99"))).toEqual([
      ["referencePurchasePrice", M.referencePurchasePricePrecision],
    ]);
    expect(issues(priced("90071992547409.91"))).toEqual([
      ["referencePurchasePrice", M.referencePurchasePricePrecision],
    ]);
    expect(issues(priced("123456789012345.67"))).toEqual([]);
  });

  it.each([["vnd"], ["VN"], ["VNDX"], ["V1D"]])("tiền tệ %s không phải mã ISO in hoa", (c) => {
    expect(issues(priced("100", c))).toEqual([
      ["referencePurchaseCurrency", M.referencePurchaseCurrency],
    ]);
  });

  it("giá và tiền tệ đi cùng nhau — lỗi ở ô còn thiếu như BE", () => {
    expect(issues(priced("100", null))).toEqual([["referencePurchaseCurrency", M.pricePairing]]);
    expect(issues({ ...empty, referencePurchaseCurrency: "VND" })).toEqual([
      ["referencePurchasePrice", M.pricePairing],
    ]);
  });

  it("defaultSupplierId là id mờ (UUID ở BE thật, SUP-001 ở mock) — chỉ chặn id rỗng", () => {
    expect(issues({ ...empty, defaultSupplierId: "SUP-001" })).toEqual([]);
    expect(issues({ ...empty, defaultSupplierId: SUPPLIER })).toEqual([]);
    expect(issues({ ...empty, defaultSupplierId: "  " })).toEqual([
      ["defaultSupplierId", M.defaultSupplierId],
    ]);
  });
});

describe("chuỗi thập phân", () => {
  it.each([
    ["007.50", "7.5"],
    ["0.10", "0.1"],
    ["100", "100"],
    ["100.00", "100"],
    ["0", "0"],
  ])("canonicalDecimal(%s) = %s", (raw, expected) => {
    expect(canonicalDecimal(raw)).toBe(expected);
  });

  it("travelsExactly chỉ đúng khi số JSON in lại đúng chữ số", () => {
    expect(travelsExactly("12345678901234.56")).toBe(true);
    expect(travelsExactly("9999999999999999")).toBe(false);
  });
});

describe("purchasingValuesOf", () => {
  it("lấy đủ 5 field từ cấu hình hiện tại để sửa một phần vẫn gửi lại phần còn lại", () => {
    const current = beSkuPurchasingSchema.parse({
      variantId: VARIANT,
      sku: "CUP",
      version: 4,
      defaultSupplierId: SUPPLIER,
      leadTimeDays: 0,
    });
    expect(purchasingValuesOf(current)).toEqual({
      ...empty,
      defaultSupplierId: SUPPLIER,
      leadTimeDays: 0,
    });
  });
});
