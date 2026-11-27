import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { QuoteCreate, QuoteEdit } from "..";
import {
  CUSTOMER,
  CUSTOMER_ID,
  QUOTE_ACCEPTED,
  QUOTE_DRAFT_PLATE_UNPRICED,
  QUOTE_ID,
  SKU,
} from "../__fixtures__/quote-ds02";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(`customerId=${CUSTOMER_ID}`),
}));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

const detailUrl = `/quotes/${QUOTE_ID}`;
const sku = (extra: Record<string, unknown> = {}) => ({
  variantId: "v1",
  productId: "p1",
  sku: SKU,
  name: "Ly 12oz xanh",
  ownerCustomerId: CUSTOMER_ID,
  status: "ACTIVE",
  ...extra,
});
const price = {
  customerId: CUSTOMER_ID,
  sku: SKU,
  measure: "CARTON",
  moq: 20,
  tiers: QUOTE_ACCEPTED.lines[0]?.tiers ?? [],
  version: 1,
};

function renderCreate(
  skuExtra: Record<string, unknown> = {},
  post: Record<string, () => unknown> = {},
) {
  const api = mockApi("SALES_STAFF", {
    get: {
      [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      "/customer-skus": () => [sku(skuExtra)],
      [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () => price,
    },
    post,
  });
  renderScreen(<QuoteCreate />, "SALES_STAFF");
  return api;
}

describe("Quote form — round 5", () => {
  it("BO-UX-3: validity and wanted delivery are date pickers (dd/MM/yyyy), not native date inputs", async () => {
    renderCreate();
    const valid = await screen.findByLabelText(/Hiệu lực đến hết ngày/);
    expect(valid.tagName).toBe("BUTTON");
    // S02-2: filled in with today + 30 days (owner decision UX-Q2), still editable through the picker.
    expect(valid).not.toHaveTextContent("Chọn ngày");
    expect(screen.getByText("Còn 30 ngày kể từ hôm nay.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Ngày giao khách yêu cầu/).tagName).toBe("BUTTON");
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it("BO-UX-14 / BO-UX-4: tiers show visible column headers and the price is grouped with ₫", async () => {
    renderCreate();
    // One valid SKU: chosen already, shown as plain text (R6).
    await screen.findByText("Ly 12oz xanh");
    await userEvent.click(await screen.findByRole("button", { name: /Dùng giá gợi ý/ }));
    const table = screen.getByRole("table", { name: "Bậc giá" });
    expect(within(table).getByRole("columnheader", { name: "Từ số thùng" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "Đơn giá một cái" })).toBeVisible();
    expect(
      within(table).getByText("Bậc đầu là số thùng tối thiểu của báo giá"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Đơn giá ₫ một cái (bậc 1)")).toHaveValue("1.250");
  });

  it("BO-UX-16: with units per carton and tax rate on the customer SKU, the total is previewed before saving", async () => {
    renderCreate({ unitsPerCarton: 1000, taxRate: 10 });
    // One valid SKU: chosen already, shown as plain text (R6).
    await screen.findByText("Ly 12oz xanh");
    await userEvent.type(screen.getByLabelText(/Số thùng/), "60");
    expect(await screen.findByText(/= 60\.000 cái \(1\.000 cái\/thùng\)/)).toBeInTheDocument();
    const preview = screen.getByRole("complementary", { name: "Tạm tính" });
    // 60 thùng × 1.000 cái × 1.150 ₫ (bậc 50 thùng của giá riêng), VAT 10%.
    expect(await within(preview).findByText(/69\.000\.000/)).toBeInTheDocument();
    expect(within(preview).getByText(/6\.900\.000/)).toBeInTheDocument();
    expect(within(preview).getByText(/75\.900\.000/)).toBeInTheDocument();
  });

  it("BO-UX-16: without those fields (older BE) the preview still waits for the save", async () => {
    renderCreate();
    // One valid SKU: chosen already, shown as plain text (R6).
    await screen.findByText("Ly 12oz xanh");
    await userEvent.type(screen.getByLabelText(/Số thùng/), "60");
    expect(screen.getByText("Quy đổi ra cái hiện sau khi lưu nháp.")).toBeInTheDocument();
    expect(
      within(screen.getByRole("complementary", { name: "Tạm tính" })).getByText("chưa đủ giá"),
    ).toBeInTheDocument();
  });

  it("BO-UX-15: 'Thêm dòng' sits with the lines, before the fees", async () => {
    renderCreate();
    const lines = await screen.findByRole("region", { name: "Các dòng báo giá" });
    expect(within(lines).getByRole("button", { name: /Thêm dòng/ })).toBeInTheDocument();
  });

  it("BO-UX-5: 'Bỏ thay đổi' leaves at once when nothing changed", async () => {
    renderCreate();
    await screen.findByText("Ly 12oz xanh");
    expect(screen.queryByRole("link", { name: "Huỷ" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    expect(push).toHaveBeenCalledWith("/admin/quotes");
  });

  it("BO-UX-5: with unsaved edits it asks first; 'Tiếp tục sửa' stays on the form", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_DRAFT_PLATE_UNPRICED,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        "/customer-skus": () => [sku()],
        [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () => price,
      },
    });
    renderScreen(<QuoteEdit id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.type(await screen.findByLabelText(/^Điều khoản/), " thêm");
    await userEvent.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Bỏ các thay đổi chưa lưu?")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Tiếp tục sửa" }));
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Bỏ thay đổi" }),
    );
    expect(push).toHaveBeenCalledWith(`/admin/quotes/${QUOTE_ID}`);
  });

  it("BO-UX-17: a save refused by the BE is announced and takes the focus", async () => {
    const message = "Khách hàng đang tạm khoá.";
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => ({ ...QUOTE_DRAFT_PLATE_UNPRICED, fees: QUOTE_ACCEPTED.fees }),
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        "/customer-skus": () => [sku()],
        [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () => price,
      },
      put: {
        [detailUrl]: () => {
          throw apiError(409, "SOMETHING_ELSE", undefined, message);
        },
      },
    });
    renderScreen(<QuoteEdit id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: "Lưu báo giá" }));
    const alert = await screen.findByText(message);
    expect(alert.closest('[role="alert"]')).not.toBeNull();
    await waitFor(() => expect(alert.closest("[tabindex]")).toHaveFocus());
  });
});
