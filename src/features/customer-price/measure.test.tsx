import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CUSTOMER_PRICE_ERROR_MESSAGES as E, CUSTOMER_PRICE_UI_LABELS as L } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { editColumn } from "./components/price-columns";
import { customerPriceErrorKind, customerPriceErrorMessage } from "./errors";
import { beCustomerPriceSchema } from "./schemas";

const price = (measure: "CARTON" | "UNIT") =>
  beCustomerPriceSchema.parse({
    customerId: "c-1",
    sku: "LY12OZ-C1-01",
    measure,
    moq: 5,
    tiers: [{ minQuantity: 5, unitPrice: 2500 }],
    version: 0,
  });

describe("giá khách — measure (BE CustomerPriceResponse, kltn-docs 13 BR-05)", () => {
  it("response thiếu measure là sai hợp đồng", () => {
    const { measure: _m, ...without } = price("CARTON");
    void _m;
    expect(beCustomerPriceSchema.safeParse(without).success).toBe(false);
  });

  it("giá theo thùng có nút sửa; giá cũ theo cái (UNIT) không có — BE chỉ cho đọc / xoá", () => {
    const column = editColumn(() => {});
    const { rerender } = render(<>{column.cell(price("CARTON"))}</>);
    expect(
      screen.getByRole("button", { name: L.form.editRow("LY12OZ-C1-01") }),
    ).toBeInTheDocument();
    rerender(<>{column.cell(price("UNIT"))}</>);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("CUSTOMER_SKU_REQUIRED (SKU không phải SKU riêng của khách) có câu riêng", () => {
    const error = new ApiError(409, "CUSTOMER_SKU_REQUIRED", "English");
    expect(customerPriceErrorKind(error)).toBe("CUSTOMER_SKU_REQUIRED");
    expect(customerPriceErrorMessage(error)).toBe(E.CUSTOMER_SKU_REQUIRED);
  });

  it("nhãn bậc giá nói theo thùng, đơn giá theo cái", () => {
    expect(L.detail.tierLine("5", "CARTON")).toBe("Từ 5 thùng");
    expect(L.detail.tierLine("5", "UNIT")).toBe("Từ 5 cái");
    expect(L.detail.perUnit).toBe("/ cái");
  });
});
