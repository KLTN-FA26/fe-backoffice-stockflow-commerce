import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACCOUNTANT_GRANTS,
  detailJson,
  listItemJson,
  mockEInvoiceApi,
  renderEInvoiceScreen,
} from "../__fixtures__/screen";
import { EInvoiceDetail } from "../components/EInvoiceDetail";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin/invoicing/einvoices/einv-1",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const issued = (over: Record<string, unknown> = {}) =>
  detailJson({
    status: "ISSUED",
    hasFiles: true,
    templateCode: "1",
    symbol: "C26TAA",
    invoiceNumber: 42,
    ...over,
  });
const get = (invoice: Record<string, unknown>, corrections: unknown[] = []) => ({
  "/einvoices/einv-1": () => invoice,
  "/einvoices/einv-1/provider-calls": () => [],
  "/einvoices/einv-1/corrections": () => corrections,
});

describe("corrections of an issued invoice (docs 21 §4.4)", () => {
  it("a trade discount only reduces: a positive quantity is refused before sending", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get(issued()) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Lập điều chỉnh" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: /Căn cứ/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Chiết khấu thương mại" }));
    await userEvent.type(within(dialog).getByLabelText(/Lý do/), "Chiết khấu doanh số Q4");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Chỉnh dòng 1" }));
    await userEvent.type(within(dialog).getByLabelText("Số lượng dòng 1"), "100");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lập nháp" }));
    expect(
      await within(dialog).findByText("Trả hàng / chiết khấu chỉ điều chỉnh giảm (số âm)"),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("draws a reducing adjustment up and opens the new draft", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(issued()),
      post: {
        "/einvoices/einv-1/adjustments": () => detailJson({ id: "einv-9", type: "ADJUSTMENT" }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Lập điều chỉnh" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: /Căn cứ/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Chiết khấu thương mại" }));
    await userEvent.type(within(dialog).getByLabelText(/Lý do/), "Chiết khấu");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Chỉnh dòng 1" }));
    await userEvent.type(within(dialog).getByLabelText("Số lượng dòng 1"), "-2000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lập nháp" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/adjustments", {
        basis: "TRADE_DISCOUNT",
        reason: "Chiết khấu",
        lines: [{ originalLineId: "line-1", quantity: -2000 }],
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/invoicing/einvoices/einv-9"));
  });

  it("BR-08: an adjusted invoice offers no replacement", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get(issued({ adjusted: true })) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByRole("button", { name: "Lập điều chỉnh" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lập thay thế" })).not.toBeInTheDocument();
  });

  it("lists the corrections of the original, each linked", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(issued(), [listItemJson({ id: "einv-9", code: "HDDT-0009", type: "ADJUSTMENT" })]),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    const link = await screen.findByRole("link", { name: "HDDT-0009" });
    expect(link).toHaveAttribute("href", "/admin/invoicing/einvoices/einv-9");
  });

  it("an error correction draft takes the signed agreement as multipart", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        detailJson({ type: "ADJUSTMENT", correctionBasis: "ERROR", agreementRequired: true }),
      ),
      put: {
        "/einvoices/einv-1/agreement": () =>
          detailJson({ agreement: { number: "TT-1", date: "2026-11-10" } }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Gắn thoả thuận" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Số văn bản/), "TT-1");
    const pdf = new File(["%PDF"], "tt.pdf", { type: "application/pdf" });
    await userEvent.upload(within(dialog).getByLabelText(/Tệp PDF/), pdf);
    await userEvent.click(within(dialog).getByRole("button", { name: "Gắn văn bản" }));
    // Thiếu ngày → bị chặn trước khi gửi
    expect(await within(dialog).findByText(/Ngày không hợp lệ/)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });
});
