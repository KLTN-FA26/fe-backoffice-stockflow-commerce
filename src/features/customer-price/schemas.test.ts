import { describe, expect, it } from "vitest";

import { CUSTOMER_PRICE_FIELD_MESSAGES as M } from "@/constants";

import {
  beCustomerPriceSchema,
  customerPriceValuesSchema,
  customerPriceVersionSchema,
} from "./schemas";

import type { CustomerPriceValues } from "./schemas";

const tier = (minQuantity: number, unitPrice: string) => ({ minQuantity, unitPrice });
const values = (tiers: { minQuantity: number; unitPrice: string }[], note: string | null = null) =>
  ({ tiers, note }) satisfies CustomerPriceValues;

/** Lỗi dạng [đường dẫn, thông báo]; rỗng = hợp lệ. */
function issues(input: unknown) {
  const r = customerPriceValuesSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => [i.path.join("."), i.message]);
}

describe("customerPriceValuesSchema (BE CustomerPriceRequest + CustomerPrice + SellingPrice)", () => {
  it("1 một bậc hợp lệ", () => {
    expect(customerPriceValuesSchema.parse(values([tier(1, "150000")]))).toEqual({
      tiers: [{ minQuantity: 1, unitPrice: "150000" }],
      note: null,
    });
  });

  it("2 nhiều bậc hợp lệ, tới 20 bậc", () => {
    const twenty = Array.from({ length: 20 }, (_, i) => tier(i + 1, String(1000 - i)));
    expect(issues(values(twenty))).toEqual([]);
    expect(issues(values([...twenty, tier(21, "1")]))).toEqual([["tiers", M.tiersCount]]);
    expect(issues(values([]))).toEqual([["tiers", M.tiersCount]]);
  });

  it("3 bậc không theo thứ tự vẫn hợp lệ (BE tự sắp), giữ nguyên thứ tự gửi", () => {
    const parsed = customerPriceValuesSchema.parse(values([tier(100, "90"), tier(10, "95")]));
    expect(parsed.tiers.map((t) => t.minQuantity)).toEqual([100, 10]);
  });

  it("4 hai bậc cùng minQuantity → lỗi ở mọi bậc trùng", () => {
    expect(issues(values([tier(10, "100"), tier(5, "110"), tier(10, "90")]))).toEqual([
      ["tiers.0.minQuantity", M.minQuantityDuplicate],
      ["tiers.2.minQuantity", M.minQuantityDuplicate],
    ]);
  });

  it("5 bậc đầu lớn hơn 1 hợp lệ (MOQ = bậc nhỏ nhất)", () => {
    expect(issues(values([tier(2, "100"), tier(10, "90")]))).toEqual([]);
  });

  it("6 giá TĂNG theo số lượng vẫn hợp lệ (BE không ép giảm dần)", () => {
    expect(issues(values([tier(1, "100"), tier(10, "120"), tier(100, "200")]))).toEqual([]);
  });

  it("7 ghi chú null / trống / chỉ khoảng trắng → null; ghi chú có chữ giữ nguyên", () => {
    expect(customerPriceValuesSchema.parse(values([tier(1, "1")], null)).note).toBeNull();
    expect(customerPriceValuesSchema.parse(values([tier(1, "1")], "   ")).note).toBeNull();
    expect(customerPriceValuesSchema.parse(values([tier(1, "1")], " Giá đại lý ")).note).toBe(
      " Giá đại lý ",
    );
    // PUT thay cả ghi chú: thiếu key `note` là lỗi, không được hiểu là giữ nguyên
    expect(issues({ tiers: [tier(1, "1")] }).map(([p]) => p)).toEqual(["note"]);
  });

  it("8 ghi chú quá 500 ký tự bị chặn; đúng 500 thì được", () => {
    expect(issues(values([tier(1, "1")], "x".repeat(500)))).toEqual([]);
    expect(issues(values([tier(1, "1")], "x".repeat(501)))).toEqual([["note", M.note]]);
  });

  it.each([
    ["0", M.unitPrice],
    ["-5", M.unitPrice],
    ["10.5", M.unitPrice],
    ["1e3", M.unitPrice],
    ["", M.unitPrice],
    ["12345678901234567", M.unitPrice],
    // 16 chữ số: BE nhận, nhưng JSON number không chở nguyên vẹn → chặn, không làm tròn
    ["9999999999999999", M.unitPricePrecision],
    ["9007199254740993", M.unitPricePrecision],
  ])("9 đơn giá %s bị chặn", (price, message) => {
    expect(issues(values([tier(1, price)]))).toEqual([["tiers.0.unitPrice", message]]);
  });

  it("9 đơn giá '100.00' hợp lệ (BE bỏ 0 cuối) và gửi là 100; số an toàn lớn nhất qua được", () => {
    expect(customerPriceValuesSchema.parse(values([tier(1, "100.00")])).tiers[0]?.unitPrice).toBe(
      "100",
    );
    expect(issues(values([tier(1, "9007199254740991")]))).toEqual([]);
  });

  it.each([[0], [-1], [1.5], [2_147_483_648], [Number.NaN]])("minQuantity %s bị chặn", (q) => {
    expect(issues(values([tier(q, "100")]))).toEqual([["tiers.0.minQuantity", M.minQuantity]]);
  });

  it("10 version: PUT bắt buộc số nguyên ≥ 0", () => {
    expect(customerPriceVersionSchema.parse(0)).toBe(0);
    for (const bad of [undefined, null, -1, 1.5, "3"]) {
      expect(customerPriceVersionSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("beCustomerPriceSchema (BE CustomerPriceResponse)", () => {
  const dto = {
    customerId: "c-1",
    sku: "CUP-12OZ",
    moq: 10,
    tiers: [
      { minQuantity: 10, unitPrice: 95000 },
      { minQuantity: 100, unitPrice: 90000 },
    ],
    note: "Đại lý",
    version: 3,
  };

  it("đọc đủ field; đơn giá thành chuỗi chính xác", () => {
    expect(beCustomerPriceSchema.parse(dto)).toEqual({
      ...dto,
      tiers: [
        { minQuantity: 10, unitPrice: "95000", unitPriceExact: true },
        { minQuantity: 100, unitPrice: "90000", unitPriceExact: true },
      ],
    });
  });

  it("note vắng (Jackson non_null) → null; không bịa tiền tệ / ngày hiệu lực / tên sản phẩm", () => {
    const { note: _note, ...withoutNote } = dto;
    void _note;
    const parsed = beCustomerPriceSchema.parse(withoutNote);
    expect(parsed.note).toBeNull();
    expect(Object.keys(parsed).sort()).toEqual(
      ["customerId", "moq", "note", "sku", "tiers", "version"].sort(),
    );
  });

  it("đơn giá JSON vượt số nguyên an toàn → đánh dấu không chính xác (đã bị JSON.parse làm tròn)", () => {
    const parsed = beCustomerPriceSchema.parse({
      ...dto,
      tiers: [{ minQuantity: 1, unitPrice: JSON.parse("9999999999999999") as number }],
    });
    expect(parsed.tiers[0]?.unitPriceExact).toBe(false);
    // chuỗi số thì giữ đúng chữ số
    const exact = beCustomerPriceSchema.parse({
      ...dto,
      tiers: [{ minQuantity: 1, unitPrice: "9999999999999999" }],
    });
    expect(exact.tiers[0]).toEqual({
      minQuantity: 1,
      unitPrice: "9999999999999999",
      unitPriceExact: true,
    });
  });

  it("response hỏng bị từ chối", () => {
    for (const bad of [
      { ...dto, version: undefined },
      { ...dto, tiers: [] },
      { ...dto, tiers: [{ minQuantity: 0, unitPrice: 1 }] },
      { ...dto, customerId: "" },
    ]) {
      expect(beCustomerPriceSchema.safeParse(bad).success).toBe(false);
    }
  });
});
