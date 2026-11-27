import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatDate } from "@/lib/format/date";

import {
  ACCOUNTANT_GRANTS,
  bePage,
  detailJson,
  listItemJson,
  mockEInvoiceApi,
  renderEInvoiceScreen,
} from "../__fixtures__/screen";
import { DrawUpDialog } from "../components/DrawUpDialog";
import { EInvoiceList } from "../components/EInvoiceList";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin/einvoices",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

// Kế toán không đọc được lô giao (403): lô lấy từ hoá đơn của đơn (S1 nháp đã huỷ, S2 đang nháp + 1 bản điều chỉnh)
// và từ các lô đã giao của đơn (S3 chưa có hoá đơn nào — nháp tự động bị từ chối).
const invoices = [
  listItemJson({ id: "e-2", shipmentId: "shp-2", shipmentCode: "SO-20261108-000013-S2" }),
  listItemJson({
    id: "e-1",
    status: "VOIDED_DRAFT",
    shipmentId: "shp-1",
    shipmentCode: "SO-20261108-000013-S1",
  }),
  listItemJson({
    id: "e-3",
    type: "ADJUSTMENT",
    status: "VOIDED_DRAFT",
    shipmentId: "shp-2",
    shipmentCode: "SO-20261108-000013-S2",
  }),
  listItemJson({ id: "e-4", shipmentId: null, shipmentCode: null }),
];
const DAY3 = formatDate("2026-11-12T03:00:00Z");
const orderJson = {
  orderId: "ord-13",
  shipments: [
    { shipmentId: "shp-1", status: "DELIVERED", outcomeAt: "2026-11-10T03:00:00Z" },
    { shipmentId: "shp-2", status: "DELIVERED", outcomeAt: "2026-11-11T03:00:00Z" },
    { shipmentId: "shp-3", status: "DELIVERED", outcomeAt: "2026-11-12T03:00:00Z" },
    { shipmentId: "shp-4", status: "HANDED_OVER", outcomeAt: null },
  ],
};
const routes = (items: unknown[] = invoices) => ({
  get: { "/einvoices": () => bePage(items), "/orders/ord-13": () => orderJson },
  post: { "/einvoices": () => detailJson() },
});

describe("DrawUpDialog — pick the shipment by name, never type an id (UX audit S21-1, R3)", () => {
  it("lists every delivered shipment: the ones with invoices by code, the one without by its delivery date", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, routes());
    renderEInvoiceScreen(<DrawUpDialog orderId="ord-13" onClose={vi.fn()} />);
    expect(screen.queryByText(/shipment ID/i)).not.toBeInTheDocument();
    const trigger = await screen.findByRole("combobox", { name: /Lô giao/ });
    expect(trigger).toHaveTextContent("Phần phí còn lại");
    await userEvent.click(trigger);
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Phần phí còn lại"),
      "SO-20261108-000013-S1 · hoá đơn đã huỷ nháp",
      // S2 has a live base invoice and a voided adjustment: the live base one names it
      "SO-20261108-000013-S2 · hoá đơn nháp",
      `Lô giao ngày ${DAY3} · chưa có hoá đơn`,
    ]);
    // a shipment that was not delivered is not offered, and no id is ever shown
    expect(options.some((o) => /shp-/.test(o.textContent ?? ""))).toBe(false);
    expect(api.get.mock.calls.some(([url]) => url === "/fulfillment/shipments")).toBe(false);
  });

  it("a shipment with several invoices is shown by its live base invoice, not by a voided one", async () => {
    mockEInvoiceApi(
      ACCOUNTANT_GRANTS,
      routes([
        listItemJson({
          id: "old",
          status: "VOIDED_DRAFT",
          shipmentId: "shp-1",
          shipmentCode: "SO-20261108-000013-S1",
        }),
        listItemJson({ id: "new", shipmentId: "shp-1", shipmentCode: "SO-20261108-000013-S1" }),
      ]),
    );
    renderEInvoiceScreen(<DrawUpDialog orderId="ord-13" onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole("combobox", { name: /Lô giao/ }));
    expect(
      await screen.findByRole("option", { name: "SO-20261108-000013-S1 · hoá đơn nháp" }),
    ).toBeInTheDocument();
  });

  it("says so when the order has more invoices than were read", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      ...routes(),
      get: {
        "/einvoices": () => ({ ...bePage(invoices.slice(0, 2)), totalElements: 450 }),
        "/orders/ord-13": () => orderJson,
      },
    });
    renderEInvoiceScreen(<DrawUpDialog orderId="ord-13" onClose={vi.fn()} />);
    expect(await screen.findByText(/Chỉ đọc được 2 trong 450 hoá đơn/)).toBeInTheDocument();
  });

  it("keeps the shipment box wired to its hint for assistive technology", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, routes());
    renderEInvoiceScreen(<DrawUpDialog orderId="ord-13" onClose={vi.fn()} />);
    const trigger = await screen.findByRole("combobox", { name: /Lô giao/ });
    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-describedby", "drawup-shipment-hint"),
    );
  });

  it("sends the id of the chosen shipment, also for one with no invoice yet, and nothing for the remaining-fee draft", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, routes());
    renderEInvoiceScreen(<DrawUpDialog orderId="ord-13" onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole("combobox", { name: /Lô giao/ }));
    await userEvent.click(
      within(await screen.findByRole("listbox")).getByRole("option", { name: /chưa có hoá đơn/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Lập nháp" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0]?.[1]).toMatchObject({ orderId: "ord-13", shipmentId: "shp-3" });
  });
});

describe("DrawUpDialog from the invoice list without an order", () => {
  it("asks for the order first (a search box, no id), then offers that order's shipments", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      ...routes(),
      get: {
        ...routes().get,
        "/orders": () =>
          bePage([
            {
              orderId: "ord-13",
              orderNumber: "SO-20261108-000013",
              customerId: "cust-9",
              customerName: "Công ty Bao Bì An Phát",
            },
          ]),
      },
    });
    renderEInvoiceScreen(<EInvoiceList />);
    await userEvent.click(await screen.findByRole("button", { name: /Lập nháp/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Lập nháp" })).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("combobox", { name: "Đơn hàng" }), "SO-2026");
    await userEvent.click(await screen.findByRole("option", { name: /SO-20261108-000013/ }));
    expect(await within(dialog).findByText("Đơn SO-20261108-000013")).toBeInTheDocument();
    await userEvent.click(await within(dialog).findByRole("combobox", { name: /Lô giao/ }));
    expect(
      await screen.findByRole("option", { name: new RegExp(`Lô giao ngày ${DAY3}`) }),
    ).toBeInTheDocument();
    const shipmentCalls = api.get.mock.calls.filter(([url]) => url === "/orders/ord-13");
    expect(shipmentCalls.length).toBeGreaterThan(0);
    // changing the order goes back to the search
    await userEvent.click(within(dialog).getByRole("button", { name: "Đổi đơn" }));
    expect(within(dialog).getByRole("combobox", { name: "Đơn hàng" })).toBeInTheDocument();
  });
});
