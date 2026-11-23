import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RMA_PERMISSIONS } from "@/constants/returns";

import {
  ACCOUNTANT_GRANTS,
  bePage,
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
  "/einvoices/einv-1/error-notices": () => [],
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

  it("H-1: shows the VAT rate as BE sends it (8 = 8%), never 800%", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get(issued()) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText("Thuế suất 8%")).toBeInTheDocument();
    expect(screen.getAllByText("8%").length).toBeGreaterThan(0);
    expect(screen.queryByText(/800/)).not.toBeInTheDocument();
  });

  it("H-1: a replacement prefills the rate as a percent and sends the typed percent", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(issued()),
      post: {
        "/einvoices/einv-1/replacements": () => detailJson({ id: "einv-9", type: "REPLACEMENT" }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Lập thay thế" }));
    const dialog = screen.getByRole("dialog");
    const rate = within(dialog).getByLabelText("Thuế suất dòng 1");
    expect(rate).toHaveValue("8");
    await userEvent.clear(rate);
    await userEvent.type(rate, "10");
    await userEvent.type(within(dialog).getByLabelText(/Lý do/), "Sai thuế suất");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lập nháp" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/replacements", {
        reason: "Sai thuế suất",
        lines: [{ originalLineId: "line-1", quantity: 20_000, unitPrice: 780, taxRate: 10 }],
      }),
    );
  });

  it("H-1: a rate typed as a fraction-of-100 or with 3 decimals is refused before sending", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get(issued()) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Lập thay thế" }));
    const dialog = screen.getByRole("dialog");
    const rate = within(dialog).getByLabelText("Thuế suất dòng 1");
    await userEvent.clear(rate);
    await userEvent.type(rate, "800");
    await userEvent.type(within(dialog).getByLabelText(/Lý do/), "Sai");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lập nháp" }));
    expect(await within(dialog).findByText("Thuế suất từ 0 tới dưới 100 (%)")).toBeInTheDocument();
    await userEvent.clear(rate);
    await userEvent.type(rate, "8.125");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lập nháp" }));
    expect(await within(dialog).findByText("Thuế suất tối đa 2 số lẻ")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("M-9: a RETURN adjustment picks one of the order's returns and sends its id", async () => {
    const returns = vi.fn(() =>
      bePage([
        { id: "0193a1b2-0000-7000-8000-000000000001", rmaNumber: "RMA-0001", status: "RESOLVED" },
        { id: "0193a1b2-0000-7000-8000-000000000002", rmaNumber: "RMA-0002", status: "REJECTED" },
      ]),
    );
    const api = mockEInvoiceApi([...ACCOUNTANT_GRANTS, RMA_PERMISSIONS.read], {
      get: { ...get(issued()), "/returns": returns },
      post: {
        "/einvoices/einv-1/adjustments": () => detailJson({ id: "einv-9", type: "ADJUSTMENT" }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Lập điều chỉnh" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: /Căn cứ/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Trả hàng" }));
    // không còn ô gõ tay: BE nhận UUID của yêu cầu thuộc đúng đơn
    expect(within(dialog).queryByRole("textbox", { name: /yêu cầu trả hàng/i })).toBeNull();
    await userEvent.type(within(dialog).getByLabelText(/Lý do/), "Khách trả 2 thùng");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Chỉnh dòng 1" }));
    await userEvent.type(within(dialog).getByLabelText("Số lượng dòng 1"), "-2000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lập nháp" }));
    expect(
      await within(dialog).findByText("Điều chỉnh vì trả hàng phải nêu yêu cầu trả hàng"),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("combobox", { name: /Yêu cầu trả hàng/ }));
    await userEvent.click(await screen.findByRole("option", { name: "RMA-0001 · Đã xử lý xong" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Lập nháp" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/adjustments", {
        basis: "RETURN",
        reason: "Khách trả 2 thùng",
        returnRequestId: "0193a1b2-0000-7000-8000-000000000001",
        lines: [{ originalLineId: "line-1", quantity: -2000 }],
      }),
    );
    const call = api.get.mock.calls.find(([url]) => url === "/returns");
    const params = (call?.[1] as { params?: URLSearchParams } | undefined)?.params;
    expect(params?.get("orderId")).toBe("ord-13");
    expect(returns).toHaveBeenCalled();
  });

  it("M-9: without sales-rmas:READ the picker says why it is empty", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get(issued()) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Lập điều chỉnh" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: /Căn cứ/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Trả hàng" }));
    expect(within(dialog).getByText("Cần quyền xem yêu cầu trả hàng để chọn.")).toBeInTheDocument();
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
