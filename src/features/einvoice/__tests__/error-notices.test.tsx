import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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

const issued = detailJson({
  status: "ISSUED",
  hasFiles: true,
  invoiceNumber: 42,
  symbol: "C26TAA",
});
const notice = (over: Record<string, unknown> = {}) => ({
  id: "n-1",
  einvoiceId: "einv-1",
  formCode: "04/SS-HDDT",
  subject: "BUYER_NAME_ADDRESS",
  reason: "Sai địa chỉ bên mua",
  correctBuyerAddress: "46 Lê Lợi",
  status: "SENT",
  recordedAt: "2026-11-12T03:00:00Z",
  ...over,
});
const get = (notices: unknown[]) => ({
  "/einvoices/einv-1": () => issued,
  "/einvoices/einv-1/provider-calls": () => [],
  "/einvoices/einv-1/corrections": () => [],
  "/einvoices/einv-1/error-notices": () => notices,
});

describe("error notices 04/SS-HDDT (TT 91/2026 Điều 10 khoản 1 điểm a)", () => {
  it("needs the right name or address of the buyer before sending", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get([]) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Thông báo sai sót" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Sai sót/), "Sai địa chỉ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Gửi thông báo" }));
    expect(
      await within(dialog).findByText("Nêu tên hoặc địa chỉ đúng của bên mua"),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("sends the notice with the buyer's right address", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get([]),
      post: { "/einvoices/einv-1/error-notices": () => notice() },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Thông báo sai sót" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Sai sót/), "Sai địa chỉ");
    await userEvent.type(within(dialog).getByLabelText(/Địa chỉ đúng/), "46 Lê Lợi");
    await userEvent.click(within(dialog).getByRole("button", { name: "Gửi thông báo" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/error-notices", {
        subject: "BUYER_NAME_ADDRESS",
        reason: "Sai địa chỉ",
        correctBuyerAddress: "46 Lê Lợi",
      }),
    );
  });

  it("lists the notices with the tax authority's answer, and asks for the result of one on its way", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get([
        notice({
          id: "n-0",
          status: "ACCEPTED",
          responseMessage: "Đã tiếp nhận",
          responseCode: "00",
        }),
        notice(),
      ]),
      post: { "/einvoices/einv-1/error-notices/n-1/sending": () => notice({ status: "ACCEPTED" }) },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText("Phản hồi: Đã tiếp nhận (00)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hỏi kết quả" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/error-notices/n-1/sending", {}),
    );
    expect(screen.getAllByRole("button", { name: /Hỏi kết quả|Gửi lại/ })).toHaveLength(1);
  });

  it("the sales manager sees the notices but cannot send one", async () => {
    mockEInvoiceApi(MANAGER_GRANTS, { get: get([notice()]) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText("Sai địa chỉ bên mua")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thông báo sai sót" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hỏi kết quả" })).not.toBeInTheDocument();
  });
});
