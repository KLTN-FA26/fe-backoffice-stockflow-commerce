import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatDate } from "@/lib/format/date";
import { mockApi, renderScreen } from "@/test/api-screen";
import "@/test/jsdom-popover";

import { QuoteCreate, QuoteDetail } from "..";
import {
  CUSTOMER,
  CUSTOMER_ID,
  QUOTE_ACCEPTED,
  QUOTE_DRAFT_PLATE_UNPRICED,
  QUOTE_ID,
  SKU,
} from "../__fixtures__/quote-ds02";
import { QUOTE_DEFAULT_VALIDITY_DAYS, defaultValidUntil, emptyQuoteForm } from "../form-body";
import { pickSku } from "./sku-picker";

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
const skuRow = (variantId: string, sku: string, name: string) => ({
  variantId,
  productId: "p1",
  sku,
  name,
  ownerCustomerId: CUSTOMER_ID,
  status: "ACTIVE",
});
const TWO_SKUS = [skuRow("v1", SKU, "Ly 12oz xanh"), skuRow("v2", "LY-16OZ-DO", "Ly 16oz đỏ")];

describe("default quote validity (UX-Q2, S02-2)", () => {
  it("is today + 30 days, in Vietnam time", () => {
    expect(QUOTE_DEFAULT_VALIDITY_DAYS).toBe(30);
    expect(defaultValidUntil("2026-11-26")).toBe("2026-12-26");
    expect(defaultValidUntil("2026-12-10")).toBe("2027-01-09");
  });

  it("fills a new form but never a saved quote's own date", () => {
    expect(emptyQuoteForm("c1").validUntil).toBe(defaultValidUntil());
  });
});

describe("Quote line — SKU box (S02-1)", () => {
  it("with several SKUs: a search box (name first, code below), and a SKU used on another line is not offered again", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        "/customer-skus": () => TWO_SKUS,
      },
    });
    renderScreen(<QuoteCreate />, "SALES_STAFF");
    const user = userEvent.setup();
    const box = await screen.findByRole("combobox", { name: /Sản phẩm \(SKU riêng\)/ });
    expect(box).toHaveValue("");
    // Typing part of the NAME finds it; the code is the second line of the row.
    await user.type(box, "16oz");
    const option = await screen.findByRole("option", { name: /Ly 16oz đỏ/ });
    expect(option).toHaveTextContent("LY-16OZ-DO");
    expect(screen.queryByRole("option", { name: /Ly 12oz xanh/ })).toBeNull();
    await user.click(option);
    expect(box).toHaveValue("Ly 16oz đỏ");
    // The code stays readable under the box once chosen.
    expect(screen.getByText("LY-16OZ-DO")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Thêm dòng/ }));
    const boxes = await screen.findAllByRole("combobox", { name: /Sản phẩm \(SKU riêng\)/ });
    await user.type(boxes[1] as HTMLElement, "Ly");
    expect(await screen.findByRole("option", { name: /Ly 12oz xanh/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Ly 16oz đỏ/ })).toBeNull();
  });

  it("with one SKU only: chosen already and shown as text; no second line to add", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        "/customer-skus": () => [TWO_SKUS[0]],
      },
    });
    renderScreen(<QuoteCreate />, "SALES_STAFF");
    expect(await screen.findByText("Ly 12oz xanh")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Sản phẩm/ })).toBeNull();
    // BE: one line per SKU → "Thêm dòng" has nothing left to offer.
    expect(screen.getByRole("button", { name: /Thêm dòng/ })).toBeDisabled();
  });

  it("picks through the helper a SKU of a second line", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        "/customer-skus": () => TWO_SKUS,
      },
    });
    renderScreen(<QuoteCreate />, "SALES_STAFF");
    const user = userEvent.setup();
    await pickSku(user, "Ly 12oz");
    await user.click(screen.getByRole("button", { name: /Thêm dòng/ }));
    await screen.findByText("Dòng 2");
    await pickSku(user, "Ly 16oz", 1);
    const boxes = screen.getAllByRole("combobox", { name: /Sản phẩm \(SKU riêng\)/ });
    expect(boxes.map((box) => (box as HTMLInputElement).value)).toEqual([
      "Ly 12oz xanh",
      "Ly 16oz đỏ",
    ]);
  });
});

describe("Quote detail — next step and send confirmation (S03-1)", () => {
  const priced = {
    ...QUOTE_DRAFT_PLATE_UNPRICED,
    fees: QUOTE_ACCEPTED.fees,
    priced: true,
    proposed: QUOTE_ACCEPTED.proposed,
    validUntil: "2099-11-26T16:59:59Z",
  };

  it("a draft still missing prices says to enter them; a fully priced one says to check and send", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_DRAFT_PLATE_UNPRICED,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      },
    });
    const first = renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    expect(
      await screen.findByText("Bước tiếp theo: nhập đủ giá và phí, rồi Gửi khách."),
    ).toBeInTheDocument();
    first.unmount();

    mockApi("SALES_STAFF", {
      get: { [detailUrl]: () => priced, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    expect(
      await screen.findByText("Báo giá đã đủ giá và phí — kiểm tra rồi bấm Gửi khách."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/nhập đủ giá và phí/)).toBeNull();
  });

  it("the confirmation says who the quote goes to and until which day it is valid", async () => {
    mockApi("SALES_STAFF", {
      get: { [detailUrl]: () => priced, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: /Gửi khách/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Gửi cho")).toBeInTheDocument();
    expect(await within(dialog).findByText("Khách hàng demo")).toBeInTheDocument();
    expect(within(dialog).getByText("Hiệu lực đến hết ngày")).toBeInTheDocument();
    // The same formatter the quote screens use, so the test follows the app's date format.
    expect(dialog.textContent).toContain(formatDate("2099-11-26T16:59:59Z"));
  });
});
