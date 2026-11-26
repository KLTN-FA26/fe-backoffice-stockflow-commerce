import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderScreen } from "@/test/api-screen";

import { QuoteDetail } from "..";
import { CUSTOMER, CUSTOMER_ID, QUOTE_ACCEPTED, QUOTE_ID, SKU } from "../__fixtures__/quote-ds02";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const detailUrl = `/quotes/${QUOTE_ID}`;
const CONVERSATION_ID = "c4a70000-0000-4000-8000-000000000101";
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 1,
  totalElements: items.length,
  totalPages: 1,
});

function renderDetail(quote: unknown, extra: Record<string, (params: unknown) => unknown> = {}) {
  const api = mockApi("SALES_STAFF", {
    get: { [detailUrl]: () => quote, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER, ...extra },
  });
  renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
  return api;
}

describe("Quote detail — round 5", () => {
  it("BO-UX-18: a line shows its design name and units per carton under the SKU; the rate sits by the tax", async () => {
    const line = { ...QUOTE_ACCEPTED.lines[0], designName: "Ly logo Tết" };
    renderDetail({ ...QUOTE_ACCEPTED, lines: [line] });
    const table = await screen.findByRole("table", { name: "Các dòng của báo giá" });
    expect(within(table).getByText(SKU)).toBeInTheDocument();
    expect(within(table).getByText("Ly logo Tết")).toBeInTheDocument();
    expect(within(table).getByText("1.000 cái/thùng")).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Thuế suất" })).toBeNull();
    expect(within(table).getByText("10%")).toBeInTheDocument();
  });

  it("BO-UX-20: history names who made the change when the BE sends it", async () => {
    const history = [
      { ...QUOTE_ACCEPTED.history[0], changedByName: "Trần Văn Sales" },
      ...QUOTE_ACCEPTED.history.slice(1),
    ];
    renderDetail({ ...QUOTE_ACCEPTED, history });
    expect(await screen.findByText(/· Trần Văn Sales/)).toBeInTheDocument();
  });

  it("BO-UX-19: a sent quote says who waits until when, and links the quote's conversation", async () => {
    const api = renderDetail(
      { ...QUOTE_ACCEPTED, status: "SENT", validUntil: "2099-11-26" },
      {
        "/chat/conversations": (params) =>
          (params as Record<string, string>).contextKind === "QUOTE"
            ? page([{ id: CONVERSATION_ID }])
            : page([]),
      },
    );
    expect(
      await screen.findByText("Chờ khách phản hồi trong chat, đến hết 26 thg 11, 2099."),
    ).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Mở hội thoại" })).toHaveAttribute(
      "href",
      `/admin/chat/${CONVERSATION_ID}`,
    );
    const call = api.get.mock.calls.find((c) => c[0] === "/chat/conversations");
    expect((call?.[1] as { params: Record<string, string> }).params).toMatchObject({
      contextKind: "QUOTE",
      contextId: QUOTE_ID,
    });
  });

  it("BO-UX-19: no conversation about the quote → the customer's latest one", async () => {
    renderDetail(
      { ...QUOTE_ACCEPTED, status: "SENT", validUntil: "2099-11-26" },
      {
        "/chat/conversations": (params) =>
          (params as Record<string, string>).customerId === CUSTOMER_ID
            ? page([{ id: CONVERSATION_ID }])
            : page([]),
      },
    );
    expect(await screen.findByRole("link", { name: "Mở hội thoại" })).toHaveAttribute(
      "href",
      `/admin/chat/${CONVERSATION_ID}`,
    );
  });

  it("BO-UX-19: an expired quote offers 'Lập báo giá mới' for the same customer", async () => {
    renderDetail({ ...QUOTE_ACCEPTED, status: "EXPIRED" });
    expect(await screen.findByText(/Báo giá hết hiệu lực/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lập báo giá mới" })).toHaveAttribute(
      "href",
      `/admin/quotes/create?customerId=${CUSTOMER_ID}`,
    );
  });

  it("send confirmation names the total the customer will see", async () => {
    renderDetail({ ...QUOTE_ACCEPTED, status: "DRAFT", accepted: undefined });
    await userEvent.click(await screen.findByRole("button", { name: /Gửi khách/ }));
    expect(
      within(await screen.findByRole("dialog")).getByText(/Tổng có thuế 77\.550\.000/),
    ).toBeInTheDocument();
  });

  it("BO-UX-21: 'Tạo đơn' writes the default address out, without a ★ glyph", async () => {
    const address = (id: string, line1: string, isDefault: boolean) => ({
      addressId: id,
      type: "SHIPPING",
      recipientName: "Kho A",
      phone: "0900000000",
      line1,
      wardName: "Bến Nghé",
      provinceName: "TP Hồ Chí Minh",
      defaultAddress: isDefault,
    });
    renderDetail(QUOTE_ACCEPTED, {
      [`/customers/${CUSTOMER_ID}/addresses`]: () => [
        address("a1", "12 Nguyễn Huệ", true),
        address("a2", "5 Lê Lợi", false),
      ],
    });
    await userEvent.click(await screen.findByRole("button", { name: "Tạo đơn" }));
    const dialog = await screen.findByRole("dialog");
    const select = within(dialog).getByLabelText("Địa chỉ giao hàng");
    // S03-2: a short label inside the box (recipient — ward, province); the full address is written under it.
    const first = await within(select).findByRole("option", {
      name: "Mặc định — Kho A — Bến Nghé, TP Hồ Chí Minh",
    });
    expect(first).toHaveValue("");
    expect(within(select).getAllByRole("option")).toHaveLength(2);
    expect(dialog.textContent).toContain("Kho A, 12 Nguyễn Huệ, Bến Nghé, TP Hồ Chí Minh");
    expect(dialog.textContent).not.toContain("★");
  });

  it("S03-2: a customer with a single address gets plain text, not a box to choose from", async () => {
    renderDetail(QUOTE_ACCEPTED, {
      [`/customers/${CUSTOMER_ID}/addresses`]: () => [
        {
          addressId: "a1",
          type: "SHIPPING",
          recipientName: "Kho A",
          phone: "0900000000",
          line1: "12 Nguyễn Huệ",
          wardName: "Bến Nghé",
          provinceName: "TP Hồ Chí Minh",
          defaultAddress: true,
        },
      ],
    });
    await userEvent.click(await screen.findByRole("button", { name: "Tạo đơn" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("Kho A, 12 Nguyễn Huệ, Bến Nghé, TP Hồ Chí Minh"),
    ).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Địa chỉ giao hàng")).toBeNull();
  });

  it("S03-2: one address of a type that is not marked default is sent by its id, not left to a default the BE does not have", async () => {
    const lone = (type: string, id: string) => ({
      addressId: id,
      type,
      recipientName: "Kho A",
      phone: "0900000000",
      line1: "12 Nguyễn Huệ",
      wardName: "Bến Nghé",
      provinceName: "TP Hồ Chí Minh",
      defaultAddress: false,
    });
    const api = mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_ACCEPTED,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        [`/customers/${CUSTOMER_ID}/addresses`]: () => [
          lone("SHIPPING", "ship-1"),
          lone("BILLING", "bill-1"),
        ],
      },
      post: { [`${detailUrl}/conversion`]: () => ({ ...QUOTE_ACCEPTED, status: "CONVERTED" }) },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: "Tạo đơn" }));
    const dialog = await screen.findByRole("dialog");
    // Plain text of that address, nothing to choose.
    expect(
      await within(dialog).findAllByText("Kho A, 12 Nguyễn Huệ, Bến Nghé, TP Hồ Chí Minh"),
    ).toHaveLength(2);
    await userEvent.click(within(dialog).getByRole("button", { name: "Tạo đơn" }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0]?.[1]).toMatchObject({
      shippingAddressId: "ship-1",
      billingAddressId: "bill-1",
    });
  });
});
