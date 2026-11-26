import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACCOUNTANT_GRANTS,
  bePage,
  detailJson,
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

const delivered = [
  {
    shipmentId: "shp-2",
    code: "SO-20261108-000013-S2",
    packageCount: 3,
    outcomeAt: "2026-11-12T03:00:00Z",
  },
  {
    shipmentId: "shp-1",
    code: "SO-20261108-000013-S1",
    packageCount: 4,
    outcomeAt: "2026-11-10T03:00:00Z",
  },
];

describe("DrawUpDialog — pick the delivered shipment by its code (UX audit S21-1)", () => {
  it("lists the order's delivered shipments instead of asking for an internal id", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: { "/fulfillment/shipments": () => bePage(delivered) },
    });
    renderEInvoiceScreen(<DrawUpDialog orderId="ord-13" onClose={vi.fn()} />);
    expect(screen.queryByText(/shipment ID/i)).not.toBeInTheDocument();
    const trigger = await screen.findByRole("combobox", { name: /Lô giao/ });
    expect(trigger).toHaveTextContent("Phần phí còn lại");
    await userEvent.click(trigger);
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Phần phí còn lại"),
      expect.stringContaining("SO-20261108-000013-S1"),
      expect.stringContaining("SO-20261108-000013-S2"),
    ]);
    const call = api.get.mock.calls.find(([url]) => url === "/fulfillment/shipments");
    expect(call?.[1]).toMatchObject({ params: { orderId: "ord-13", status: "DELIVERED" } });
  });

  it("sends the chosen shipment id, and nothing for the remaining-fee draft", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: { "/fulfillment/shipments": () => bePage(delivered) },
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
