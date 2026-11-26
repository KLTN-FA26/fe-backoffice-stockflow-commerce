import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACCOUNTANT_GRANTS,
  bePage,
  detailJson,
  listItemJson,
  mockEInvoiceApi,
  renderEInvoiceScreen,
} from "../__fixtures__/screen";
import { DrawUpDialog } from "../components/DrawUpDialog";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin/einvoices",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

// Kế toán không đọc được lô giao (403), nên các lô lấy từ hoá đơn của đơn: S1 đã có nháp bị huỷ, S2 đang là nháp.
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
    shipmentId: "shp-2",
    shipmentCode: "SO-20261108-000013-S2",
  }),
  listItemJson({ id: "e-4", shipmentId: null, shipmentCode: null }),
];

describe("DrawUpDialog — pick the delivered shipment by its code (UX audit S21-1)", () => {
  it("lists the order's delivered shipments instead of asking for an internal id", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: { "/einvoices": () => bePage(invoices) },
    });
    renderEInvoiceScreen(<DrawUpDialog orderId="ord-13" onClose={vi.fn()} />);
    expect(screen.queryByText(/shipment ID/i)).not.toBeInTheDocument();
    const trigger = await screen.findByRole("combobox", { name: /Lô giao/ });
    expect(trigger).toHaveTextContent("Phần phí còn lại");
    await userEvent.click(trigger);
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Phần phí còn lại"),
      expect.stringMatching(/-S1 · hoá đơn đã huỷ/),
      expect.stringMatching(/-S2 · hoá đơn nháp/),
    ]);
    const call = api.get.mock.calls.find(([url]) => url === "/einvoices");
    expect((call?.[1] as { params: URLSearchParams }).params.get("orderId")).toBe("ord-13");
    expect(api.get.mock.calls.some(([url]) => url === "/fulfillment/shipments")).toBe(false);
  });

  it("sends the chosen shipment id, and nothing for the remaining-fee draft", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: { "/einvoices": () => bePage(invoices) },
      post: { "/einvoices": () => detailJson() },
    });
    renderEInvoiceScreen(<DrawUpDialog orderId="ord-13" onClose={vi.fn()} />);
    await userEvent.click(await screen.findByRole("combobox", { name: /Lô giao/ }));
    await userEvent.click(
      within(await screen.findByRole("listbox")).getByRole("option", { name: /-S2/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Lập nháp" }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0]?.[1]).toMatchObject({ orderId: "ord-13", shipmentId: "shp-2" });
  });
});
