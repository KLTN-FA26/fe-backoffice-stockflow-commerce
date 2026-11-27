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
    // Bảng lịch sử có cột "Người thực hiện"
    const table = within(await screen.findByRole("region", { name: "Lịch sử" }));
    expect(await table.findByRole("cell", { name: "Trần Văn Sales" })).toBeInTheDocument();
  });

  it("#286: customer name, sender and responder come from the quote — no customer lookup for the name", async () => {
    const api = mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => ({
          ...QUOTE_ACCEPTED,
          status: "CHANGES_REQUESTED",
          customerName: "Khách hàng demo",
          customerCode: "0399990001",
          sentAt: "2099-11-12T06:00:00Z",
          sentBy: "aa40c7cb-70b4-2d3a-f730-e2b5a217c662",
          sentByName: "Trần Văn Sales",
          respondedAt: "2099-11-13T06:00:00Z",
          respondedBy: "82c2b7d7-c0ae-51e1-4414-23e2e625febb",
          respondedByName: "Nguyễn Thị Khách",
        }),
      },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    const profile = within(await screen.findByRole("region", { name: "Hồ sơ báo giá" }));
    expect(profile.getByRole("link", { name: "Khách hàng demo" })).toBeInTheDocument();
    expect(profile.getByText(/Trần Văn Sales/)).toBeInTheDocument();
    expect(profile.getByText(/Nguyễn Thị Khách/)).toBeInTheDocument();
    expect(profile.queryByText(/aa40c7cb/)).toBeNull();
    expect(api.get.mock.calls.some(([url]) => String(url).startsWith("/customers"))).toBe(false);
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
    // the default address is the one chosen, written out
    await waitFor(() => expect(select).toHaveTextContent(/^Mặc định — Kho A, 12 Nguyễn Huệ/));
    await userEvent.click(select);
    const first = await screen.findByRole("option", { name: /^Mặc định — Kho A, 12 Nguyễn Huệ/ });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getAllByRole("option")[0]).toBe(first);
    expect(dialog.textContent).not.toContain("★");
  });
});
