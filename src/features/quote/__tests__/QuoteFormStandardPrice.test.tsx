/**
 * 13 BR-04 (sửa ngày 2026-11-26): dòng báo giá của SKU mà khách chưa có giá riêng gợi ý giá chuẩn của quy cách SKU được
 * làm từ đó — được để trống bậc giá (BE tự lấy giá chuẩn), như với giá riêng của khách.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { QuoteCreate } from "..";
import { CUSTOMER, CUSTOMER_ID, SKU } from "../__fixtures__/quote-ds02";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(`customerId=${CUSTOMER_ID}`),
}));

afterEach(() => vi.restoreAllMocks());

const VARIANT = "LY-GIAY-DEMO-12OZ";

function setup() {
  const api = mockApi("SALES_STAFF", {
    get: {
      [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      "/customer-skus": () => [
        {
          variantId: "v1",
          productId: "p1",
          sku: SKU,
          name: "Ly 12oz xanh",
          ownerCustomerId: CUSTOMER_ID,
          sourceSku: VARIANT,
          status: "ACTIVE",
        },
      ],
      [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () => {
        throw apiError(404, "CUSTOMER_PRICE_NOT_FOUND");
      },
      [`/catalog/standard-prices/${VARIANT}`]: () => ({
        sku: VARIANT,
        moq: 10,
        tiers: [
          { minQuantity: 10, unitPrice: 1300 },
          { minQuantity: 50, unitPrice: 1150 },
        ],
        version: 0,
      }),
    },
  });
  renderScreen(<QuoteCreate />, "SALES_STAFF");
  return api;
}

describe("Quote form — giá chuẩn khi khách chưa có giá riêng", () => {
  it("gợi ý giá chuẩn của quy cách; để trống bậc giá không bị chặn", async () => {
    const api = setup();
    const user = userEvent.setup();
    const select = await screen.findByLabelText(/SKU riêng của khách/);
    await within(select).findByRole("option", { name: new RegExp(SKU) });
    await user.selectOptions(select, SKU);
    expect(
      await screen.findByRole("button", { name: "Dùng giá gợi ý (giá chuẩn)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Để trống bậc giá = dùng giá chuẩn của quy cách.")).toBeVisible();
    await user.type(screen.getByLabelText(/Số thùng/), "60");
    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
    expect(screen.queryByText(/Chưa có giá riêng của khách lẫn giá chuẩn cho SKU này/)).toBeNull();
    expect(api.get.mock.calls.some(([url]) => url === `/catalog/standard-prices/${VARIANT}`)).toBe(
      true,
    );
  });
});
