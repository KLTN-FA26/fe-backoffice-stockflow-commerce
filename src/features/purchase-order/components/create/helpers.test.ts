import { describe, expect, it } from "vitest";

import { calculateTotals, createEmptyLine } from "./helpers";

describe("calculateTotals theo danh mục", () => {
  it("tổng tiền dùng giá danh mục khi ô giá trống", () => {
    const line = {
      ...createEmptyLine(),
      skuId: "SKU-1",
      orderedQty: "3",
      unitPrice: "",
      terms: { moq: 1, packSize: 1, price: 900, currency: "VND", effectiveLeadTimeDays: 2 },
    };
    expect(calculateTotals([line], "VND").subtotal).toBe(2700);
    expect(calculateTotals([{ ...line, unitPrice: "1000" }], "VND").subtotal).toBe(3000);
  });
});
