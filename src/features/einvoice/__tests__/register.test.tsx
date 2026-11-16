import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EINVOICE_PERMISSIONS } from "@/constants/einvoice";

import {
  ACCOUNTANT_GRANTS,
  MANAGER_GRANTS,
  mockEInvoiceApi,
  renderEInvoiceScreen,
} from "../__fixtures__/screen";
import { EInvoiceRegister } from "../components/EInvoiceRegister";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/invoicing/register",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const entry = (n: number, grandTotal: number) => ({
  templateCode: "1",
  symbol: "C26TAA",
  invoiceNumber: n,
  issueDate: "2026-11-10",
  type: "ORIGINAL",
  status: "ISSUED",
  adjusted: false,
  buyerName: "CÔNG TY TNHH CÀ PHÊ SÀI GÒN XƯA",
  buyerTaxCode: "0315987654",
  orderNumber: "SO-13",
  subtotal: grandTotal,
  taxTotal: 0,
  grandTotal,
  totalsByRate: [],
});

describe("EInvoiceRegister", () => {
  it("lists the period's issued invoices from the URL range, with the period total", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: { "/einvoices/register": () => [entry(41, 1_000_000), entry(42, 2_000_000)] },
    });
    renderEInvoiceScreen(<EInvoiceRegister />, "?from=2026-11-01&to=2026-11-30");
    expect(await screen.findByText("1C26TAA-0000042")).toBeInTheDocument();
    expect(screen.getByText(/2 hoá đơn/)).toHaveTextContent(/3\.000\.000/);
    const params = api.get.mock.calls.find(([url]) => url === "/einvoices/register")?.[1] as {
      params: URLSearchParams;
    };
    expect(Object.fromEntries(params.params)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("refuses a range that ends before it starts, asking nothing", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: { "/einvoices/register": () => [] } });
    renderEInvoiceScreen(<EInvoiceRegister />, "?from=2026-11-30&to=2026-11-01");
    expect(await screen.findByText("Đến ngày phải sau từ ngày")).toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => url === "/einvoices/register")).toBe(false);
  });

  it("exports the CSV only with einvoices:EXPORT", async () => {
    globalThis.URL.createObjectURL ??= () => "blob:x";
    globalThis.URL.revokeObjectURL ??= () => {};
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: {
        "/einvoices/register": () => [entry(41, 1)],
        "/einvoices/register/export": () => new Blob(["x"]),
      },
    });
    const { unmount } = renderEInvoiceScreen(
      <EInvoiceRegister />,
      "?from=2026-11-01&to=2026-11-30",
    );
    await userEvent.click(await screen.findByRole("button", { name: /Xuất CSV/ }));
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        "/einvoices/register/export",
        expect.objectContaining({ responseType: "blob" }),
      ),
    );
    unmount();
    vi.restoreAllMocks();
    mockEInvoiceApi([...MANAGER_GRANTS], { get: { "/einvoices/register": () => [] } });
    renderEInvoiceScreen(<EInvoiceRegister />, "?from=2026-11-01&to=2026-11-30");
    await screen.findByText(/Không có hoá đơn/);
    expect(screen.queryByRole("button", { name: /Xuất CSV/ })).not.toBeInTheDocument();
    expect(MANAGER_GRANTS).not.toContain(EINVOICE_PERMISSIONS.export);
  });
});
