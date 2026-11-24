import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_TAX_CLASS_PERMISSION } from "@/constants/einvoice";

import {
  ACCOUNTANT_GRANTS,
  detailJson,
  mockEInvoiceApi,
  renderEInvoiceScreen,
} from "../__fixtures__/screen";
import { EInvoiceDetail } from "../components/EInvoiceDetail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/invoicing/einvoices/einv-1",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

/** WF5-HD7's draft: LY-TRE-DEMO-MOC, whose product has no tax class - invoiced at 10%, held back. */
const draft = (over: Record<string, unknown> = {}) =>
  detailJson({
    warnings: ["TAX_CLASS_UNKNOWN", "TAX_RATE_DIFFERS_FROM_CONTRACT"],
    lines: [
      {
        id: "line-1",
        lineNo: 1,
        kind: "GOODS",
        sku: "LY-TRE-DEMO-MOC",
        itemName: "Ly tre in logo (demo)",
        unit: "Thùng",
        quantity: 2,
        unitsPerCarton: 1000,
        unitPrice: 1_500_000,
        taxRate: 10,
        amount: 3_000_000,
        taxAmount: 300_000,
      },
    ],
    ...over,
  });

const bamboo = (taxClass: string | null, version = 4) => ({
  sku: "LY-TRE-DEMO-MOC",
  productId: "prod-tre",
  productCode: "LY-TRE-DEMO",
  productName: "Ly tre in logo (demo)",
  status: "PUBLISHED",
  taxClass,
  version,
});

const routes = (invoice: Record<string, unknown>, lookups: unknown[]) => ({
  "/einvoices/einv-1": () => invoice,
  "/einvoices/einv-1/provider-calls": () => [],
  "/einvoices/einv-1/error-notices": () => [],
  "/einvoices/einv-1/corrections": () => [],
  "/products/tax-classes": (params: unknown) => {
    lookups.push(params);
    return [bamboo(null)];
  },
});

describe("D-8: the draft that tells the accountant to assign a tax class offers it", () => {
  it("lists the SKU's product, saves STANDARD with a reason and the version read", async () => {
    const lookups: unknown[] = [];
    const api = mockEInvoiceApi([...ACCOUNTANT_GRANTS, PRODUCT_TAX_CLASS_PERMISSION], {
      get: routes(draft(), lookups),
      put: { "/products/prod-tre/tax-class": () => bamboo("STANDARD", 5) },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);

    await userEvent.click(
      await screen.findByRole("button", { name: /Gán nhóm thuế cho sản phẩm/ }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Gán nhóm thuế cho sản phẩm" });
    expect(await within(dialog).findByText("Hiện tại: Chưa xác định")).toBeInTheDocument();
    expect(lookups).toEqual([{ sku: "LY-TRE-DEMO-MOC" }]);

    const save = within(dialog).getByRole("button", { name: "Lưu nhóm thuế" });
    expect(save).toBeDisabled();
    await userEvent.selectOptions(within(dialog).getByLabelText(/Nhóm thuế mới/), "STANDARD");
    expect(save).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Lý do/), "NĐ 174: ly tre 8%");
    await userEvent.click(save);

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/products/prod-tre/tax-class", {
        taxClass: "STANDARD",
        reason: "NĐ 174: ly tre 8%",
        version: 4,
      }),
    );
    expect(
      await within(dialog).findByText(/Huỷ nháp này rồi lập lại để hoá đơn theo nhóm mới/),
    ).toBeInTheDocument();
  });

  it("is not offered without product-tax-class:UPDATE, nor on a draft without the warning", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: routes(draft(), []) });
    const first = renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText("Ly tre in logo (demo)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gán nhóm thuế/ })).not.toBeInTheDocument();
    first.unmount();
    vi.restoreAllMocks();

    mockEInvoiceApi([...ACCOUNTANT_GRANTS, PRODUCT_TAX_CLASS_PERMISSION], {
      get: routes(draft({ warnings: [] }), []),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText("Ly tre in logo (demo)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gán nhóm thuế/ })).not.toBeInTheDocument();
  });
});
