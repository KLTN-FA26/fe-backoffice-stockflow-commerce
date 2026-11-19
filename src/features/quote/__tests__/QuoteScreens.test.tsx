import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { useBreadcrumbLabelStore } from "@/lib/store/use-breadcrumb-labels";
import { apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";

import { QuoteCreate, QuoteDetail, QuoteEdit, QuoteList } from "..";
import {
  CUSTOMER,
  CUSTOMER_ID,
  ORDER_ID,
  QUOTE_ACCEPTED,
  QUOTE_DRAFT_PLATE_UNPRICED,
  QUOTE_ID,
  QUOTE_ROW,
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
const priced = {
  ...QUOTE_DRAFT_PLATE_UNPRICED,
  fees: QUOTE_ACCEPTED.fees,
  priced: true,
  proposed: QUOTE_ACCEPTED.proposed,
};

describe("Quote list", () => {
  it("real rows, Vietnamese status, status filter as repeated params (page 0-based)", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/quotes": () => bePage([QUOTE_ROW]), [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
    });
    renderScreen(<QuoteList />, "SALES_STAFF", "?status=CONVERTED");
    expect(await screen.findByRole("link", { name: "QT-20261120-9001" })).toHaveAttribute(
      "href",
      detailUrl.replace("/quotes", "/admin/quotes"),
    );
    expect(await screen.findAllByText("Đã tạo đơn")).not.toHaveLength(0);
    const call = api.get.mock.calls.find((c) => c[0] === "/quotes")?.[1] as {
      params: URLSearchParams;
    };
    expect(call.params.getAll("status")).toEqual(["CONVERTED"]);
    expect(call.params.get("page")).toBe("0");
  });
});

describe("Quote detail", () => {
  it("TC-F03-02: shows BE line total, fee and total with tax", async () => {
    mockApi("SALES_STAFF", {
      get: { [detailUrl]: () => QUOTE_ACCEPTED, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    const table = await screen.findByRole("table", { name: "Các dòng của báo giá" });
    expect(within(table).getByText(SKU)).toBeInTheDocument();
    expect(within(table).getAllByText(/69\.000\.000/)).not.toHaveLength(0);
    expect(screen.getAllByText(/1\.500\.000/)).not.toHaveLength(0);
    expect(screen.getByText(/77\.550\.000/)).toBeInTheDocument();
  });

  it("DRAFT with an unpriced plate fee: send is blocked with the reason", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_DRAFT_PLATE_UNPRICED,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    expect(await screen.findByRole("button", { name: /Gửi khách/ })).toBeDisabled();
    expect(screen.getByText("Chưa nhập phí khuôn — sửa báo giá để nhập")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo đơn" })).not.toBeInTheDocument();
  });

  it("DRAFT send posts {version}; a BE refusal shows its Vietnamese message", async () => {
    const message = "Báo giá QT-20261120-9001 đã hết hiệu lực.";
    const api = mockApi("SALES_STAFF", {
      get: { [detailUrl]: () => priced, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
      post: {
        [`${detailUrl}/sending`]: () => {
          throw apiError(409, "QUOTE_EXPIRED", undefined, message);
        },
      },
    });
    const toastError = vi.spyOn(toast, "error");
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: /Gửi khách/ }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Gửi khách" }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${detailUrl}/sending`, { version: 0 }),
    );
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(message));
  });

  it("stale version (409 OPTIMISTIC_LOCK) → 'đã tải lại' and refetch", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { [detailUrl]: () => priced, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
      post: {
        [`${detailUrl}/sending`]: () => {
          throw apiError(409, "OPTIMISTIC_LOCK");
        },
      },
    });
    const toastError = vi.spyOn(toast, "error");
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: /Gửi khách/ }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Gửi khách" }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Dữ liệu vừa thay đổi, đã tải lại."),
    );
    await waitFor(() =>
      expect(api.get.mock.calls.filter((c) => c[0] === detailUrl).length).toBeGreaterThan(1),
    );
  });

  it("TC-F04-01: ACCEPTED → Tạo đơn posts conversion and goes to the order's contract", async () => {
    const converted = {
      ...QUOTE_ACCEPTED,
      status: "CONVERTED",
      version: 3,
      convertedOrder: {
        orderId: ORDER_ID,
        orderNumber: "SO-20261120-900001",
        status: "DRAFT",
        total: 77550000,
      },
    };
    const api = mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_ACCEPTED,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        [`/customers/${CUSTOMER_ID}/addresses`]: () => [],
      },
      post: { [`${detailUrl}/conversion`]: () => converted },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: "Tạo đơn" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Đơn chưa giữ hàng; bước tiếp theo là lập hợp đồng/),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Tạo đơn" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${detailUrl}/conversion`, { version: 2 }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/orders/${ORDER_ID}#contract`));
  });
});

describe("Quote form", () => {
  it("lists only ACTIVE customer SKUs and fills tiers from the suggested price", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        "/customer-skus": () => [
          {
            variantId: "v1",
            productId: "p1",
            sku: SKU,
            name: "Ly 12oz xanh",
            ownerCustomerId: CUSTOMER_ID,
            status: "ACTIVE",
          },
          {
            variantId: "v2",
            productId: "p1",
            sku: "LY-CU",
            ownerCustomerId: CUSTOMER_ID,
            status: "OBSOLETE",
          },
        ],
        [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () => ({
          customerId: CUSTOMER_ID,
          sku: SKU,
          measure: "CARTON",
          moq: 20,
          tiers: QUOTE_ACCEPTED.lines[0]?.tiers ?? [],
          version: 1,
        }),
      },
    });
    renderScreen(<QuoteCreate />, "SALES_STAFF");
    const select = await screen.findByLabelText(/SKU riêng của khách/);
    expect(within(select).queryByRole("option", { name: /LY-CU/ })).not.toBeInTheDocument();
    await within(select).findByRole("option", { name: new RegExp(SKU) });
    await userEvent.selectOptions(select, SKU);
    await userEvent.click(await screen.findByRole("button", { name: /Dùng giá gợi ý/ }));
    expect(screen.getByLabelText("Đơn giá (bậc 2)")).toHaveValue("1150");
    expect(
      screen.getByText((_, el) => el?.tagName === "SPAN" && el.textContent === "MOQ: 20 thùng"),
    ).toBeInTheDocument();
  });

  it("WF-02 audit: editing a draft shows the line's SKU and names the quote in the breadcrumb", async () => {
    let releaseSkus: (value: unknown) => void = () => undefined;
    const skus = new Promise((resolve) => {
      releaseSkus = resolve;
    });
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_DRAFT_PLATE_UNPRICED,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        // The SKU list arrives after the form: the select must still show the line's SKU.
        "/customer-skus": () => skus,
        [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () => ({
          customerId: CUSTOMER_ID,
          sku: SKU,
          measure: "CARTON",
          moq: 20,
          tiers: QUOTE_ACCEPTED.lines[0]?.tiers ?? [],
          version: 1,
        }),
      },
    });
    renderScreen(<QuoteEdit id={QUOTE_ID} />, "SALES_STAFF");
    const select = await screen.findByLabelText(/SKU riêng của khách/);
    expect(select).toHaveValue(SKU);
    releaseSkus([
      {
        variantId: "v1",
        productId: "p1",
        sku: SKU,
        name: "Ly 12oz xanh",
        ownerCustomerId: CUSTOMER_ID,
        status: "ACTIVE",
      },
    ]);
    await within(select).findByRole("option", { name: /Ly 12oz xanh/ });
    expect(select).toHaveValue(SKU);
    expect(useBreadcrumbLabelStore.getState().labels[QUOTE_ID]).toBe(
      QUOTE_DRAFT_PLATE_UNPRICED.quoteNumber,
    );
  });
});
