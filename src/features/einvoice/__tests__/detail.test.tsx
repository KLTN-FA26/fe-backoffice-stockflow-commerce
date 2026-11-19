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
  "/einvoices/einv-1/error-notices": () => [],
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

describe("EInvoiceDetail — system-drawn reduction of a failed delivery (WF-05 HĐ-3)", () => {
  it("opens the DELIVERY_FAILED correction, labels its basis and offers no void", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        detailJson({
          type: "ADJUSTMENT",
          originalEInvoiceId: "einv-0",
          correctionBasis: "DELIVERY_FAILED",
          correctionReason: "Lần giao bị sửa thành thất bại",
        }),
      ),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText(/Giao hàng thất bại/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phát hành" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gắn thoả thuận" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Huỷ nháp" })).not.toBeInTheDocument();
  });
});

describe("EInvoiceDetail — withdrawing an invoice stuck at the provider (BE HĐ-1)", () => {
  const stuck = detailJson({
    status: "SUBMITTING",
    provider: "SEPAY_EINVOICE",
    submittedAt: "2026-11-01T00:00:00Z",
  });

  it("asks what was checked with the provider and sends it with the version", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(stuck),
      post: {
        "/einvoices/einv-1/withdrawal": () =>
          detailJson({ status: "REJECTED", rejectionCode: "WITHDRAWN_NO_PROVIDER_RECORD" }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Rút hoá đơn" }));
    const dialog = screen.getByRole("dialog", { name: "Rút hoá đơn khỏi nhà cung cấp?" });
    await userEvent.type(within(dialog).getByRole("textbox"), "Cổng SePay không có hoá đơn");
    await userEvent.click(within(dialog).getByRole("button", { name: "Rút hoá đơn" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/withdrawal", {
        version: 3,
        reason: "Cổng SePay không có hoá đơn",
      }),
    );
  });

  it("says in Vietnamese why the provider's answer refused it", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(stuck),
      post: {
        "/einvoices/einv-1/withdrawal": () => {
          throw new ApiError(409, "EINVOICE_WITHDRAWAL_REFUSED", "may hold it");
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Rút hoá đơn" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "Đã kiểm tra");
    await userEvent.click(within(dialog).getByRole("button", { name: "Rút hoá đơn" }));
    expect(await within(dialog).findByText(/Chưa rút được hoá đơn/)).toBeInTheDocument();
  });

  it("not offered while the last send is recent", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get({ ...stuck, submittedAt: new Date().toISOString() }),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByRole("button", { name: "Tra lại" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rút hoá đơn" })).not.toBeInTheDocument();
  });
});
