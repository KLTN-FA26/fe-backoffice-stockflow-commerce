import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  ACCOUNTANT_GRANTS,
  MANAGER_GRANTS,
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

const get = (invoice: Record<string, unknown>) => ({
  "/einvoices/einv-1": () => invoice,
  "/einvoices/einv-1/provider-calls": () => [],
});

describe("EInvoiceDetail — issuing (docs 21 §4.2)", () => {
  it("shows the draft: lines, totals by rate, total in words and the buyer", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get(detailJson()) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText("Ly giấy 8oz in logo")).toBeInTheDocument();
    expect(screen.getByText("20 thùng × 1000 cái")).toBeInTheDocument();
    expect(screen.getByText(/Bằng chữ: Mười sáu triệu/)).toBeInTheDocument();
    expect(screen.getAllByText("0315987654").length).toBeGreaterThan(0);
  });

  it("issues a draft after confirming, sending the version read", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(detailJson()),
      post: {
        "/einvoices/einv-1/issuance": () => detailJson({ status: "SUBMITTING", version: 4 }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Phát hành" }));
    const dialog = screen.getByRole("dialog", { name: "Phát hành hoá đơn?" });
    expect(within(dialog).getByText(/BR-03/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Phát hành" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/issuance", { version: 3 }),
    );
  });

  it("BR-06: tells the accountant in Vietnamese why issuing was refused, inside the dialog", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(detailJson()),
      post: {
        "/einvoices/einv-1/issuance": () => {
          throw new ApiError(409, "EINVOICE_BUYER_PROFILE_INCOMPLETE", "Buyer incomplete");
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Phát hành" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Phát hành" }));
    expect(
      await within(dialog).findByText(/Thiếu tên, mã số thuế hoặc địa chỉ bên mua/),
    ).toBeInTheDocument();
  });

  it("voiding a draft asks for a reason and sends it", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(detailJson()),
      post: { "/einvoices/einv-1/void": () => detailJson({ status: "VOIDED_DRAFT" }) },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ nháp" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "Lập sai lần giao");
    await userEvent.click(within(dialog).getByRole("button", { name: "Huỷ nháp" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/void", {
        version: 3,
        reason: "Lập sai lần giao",
      }),
    );
  });

  it("shows the BE warnings in words", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        detailJson({
          warnings: ["BUYER_PROFILE_INCOMPLETE", "EARLIER_INVOICE_PENDING"],
          earlierPendingInvoice: "HDDT-0007",
        }),
      ),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("BR-06");
    expect(alert).toHaveTextContent("HDDT-0007");
  });

  it("a submitting invoice says it waits for the provider and offers only a lookup", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get(detailJson({ status: "SUBMITTING" })) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText(/Đang chờ nhà cung cấp trả kết quả/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tra lại" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Gửi lại như giao dịch mới" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phát hành" })).not.toBeInTheDocument();
  });

  it("a rejected invoice shows why and offers to reopen it", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        detailJson({
          status: "REJECTED",
          rejectionCode: "INVALID_SERIES",
          rejectionMessage: "Ký hiệu không hợp lệ",
        }),
      ),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText(/Ký hiệu không hợp lệ/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở lại thành nháp" })).toBeInTheDocument();
  });

  it("an issued invoice offers its files; the sales manager gets only those", async () => {
    mockEInvoiceApi(MANAGER_GRANTS, {
      get: get(
        detailJson({
          status: "ISSUED",
          hasFiles: true,
          templateCode: "1",
          symbol: "C26TAA",
          invoiceNumber: 42,
        }),
      ),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByRole("button", { name: /Tải PDF/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tải XML/ })).toBeInTheDocument();
    for (const name of ["Phát hành", "Huỷ nháp", "Sửa nháp", "Tra lại"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});
