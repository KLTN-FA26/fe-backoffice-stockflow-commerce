/**
 * bo-10 / bo-13 (rà UI WF-02 2026-11-27): khung tóm tắt bên phải form báo giá — khách, kiểm tra giá từng dòng cập nhật khi
 * gõ, giá tham chiếu dưới ô đơn giá, nút "Lưu và gửi"; lỗi tải SKU riêng có nút Thử lại.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { QuoteCreate } from "..";
import {
  CUSTOMER,
  CUSTOMER_ID,
  QUOTE_ACCEPTED,
  QUOTE_DRAFT_PLATE_UNPRICED,
  SKU,
} from "../__fixtures__/quote-ds02";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(`customerId=${CUSTOMER_ID}`),
}));

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

const SKU_ROW = {
  variantId: "v1",
  productId: "p1",
  sku: SKU,
  name: "Ly 12oz xanh",
  ownerCustomerId: CUSTOMER_ID,
  status: "ACTIVE",
};
// Bậc giá riêng của khách: 20 thùng → 1.250 ₫, 50 → 1.150 ₫, 100 → 1.050 ₫.
const PRICE = {
  customerId: CUSTOMER_ID,
  sku: SKU,
  measure: "CARTON",
  moq: 20,
  tiers: QUOTE_ACCEPTED.lines[0]?.tiers ?? [],
  version: 1,
};

function renderCreate(skus: () => unknown = () => [SKU_ROW]) {
  const api = mockApi("SALES_STAFF", {
    get: {
      [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      "/customer-skus": skus,
      [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () => PRICE,
    },
    post: { "/quotes": () => QUOTE_DRAFT_PLATE_UNPRICED },
  });
  renderScreen(<QuoteCreate />, "SALES_STAFF");
  return api;
}

const summary = () => screen.getByRole("complementary", { name: "Tóm tắt báo giá" });

describe("Quote form — summary panel (bo-10, bo-13)", () => {
  it("shows the customer, and the price check updates as a tier price is typed", async () => {
    const user = userEvent.setup();
    renderCreate();
    await screen.findByText("Ly 12oz xanh");
    expect(await within(summary()).findByText(CUSTOMER.fullName)).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Dùng giá gợi ý/ }));
    // Bậc 1 bằng giá riêng của khách: tham chiếu ngay dưới ô đơn giá, dòng đạt.
    const first = screen.getByLabelText("Đơn giá ₫ một cái (bậc 1)");
    expect(first).toHaveAccessibleDescription(/Tham chiếu 1\.250.*bằng giá/);
    expect(within(summary()).getByText("1/1 dòng đạt giá")).toBeInTheDocument();
    expect(within(summary()).getByRole("button", { name: "Lưu và gửi khách" })).toBeVisible();

    // 1.000 ₫ thấp hơn 1.250 ₫ 20% (> ngưỡng 10%): cần duyệt, ngay khi gõ.
    await user.clear(first);
    await user.type(first, "1000");
    expect(first).toHaveAccessibleDescription(/thấp hơn 20%.*cần duyệt/);
    expect(
      within(summary()).getByText("1 dòng cần Quản lý kinh doanh duyệt giá"),
    ).toBeInTheDocument();
    expect(within(summary()).getByText("Cần duyệt")).toBeInTheDocument();
    expect(within(summary()).getByRole("button", { name: "Lưu và gửi duyệt giá" })).toBeVisible();
  });

  it("'Lưu và gửi' saves the draft, then opens the quote with the send confirmation", async () => {
    const user = userEvent.setup();
    const api = renderCreate();
    await screen.findByText("Ly 12oz xanh");
    await user.type(screen.getByLabelText(/Số thùng/), "60");
    await user.click(await within(summary()).findByRole("button", { name: "Lưu và gửi khách" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/quotes", expect.anything()));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/admin/quotes/${QUOTE_DRAFT_PLATE_UNPRICED.id}?send=1`),
    );
  });

  it("the customer-SKU load error has a retry button and says what to do next", async () => {
    const user = userEvent.setup();
    let fail = true;
    renderCreate(() => {
      if (fail) throw apiError(500, "INTERNAL_ERROR");
      return [SKU_ROW];
    });
    expect(await screen.findByText(/Không tải được SKU riêng của khách\./)).toBeInTheDocument();
    expect(screen.getByText(/Bấm Thử lại/)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Ly 12oz xanh")).toBeInTheDocument();
  });

  it("the MOQ note sits under the tier table, not between two tier rows", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.click(await screen.findByRole("button", { name: /Dùng giá gợi ý/ }));
    const table = screen.getByRole("table", { name: "Bậc giá" });
    const note = within(table).getByText("Bậc đầu là số thùng tối thiểu của báo giá");
    expect(note.closest("tfoot")).not.toBeNull();
  });
});
