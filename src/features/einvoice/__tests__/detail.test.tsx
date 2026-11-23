import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { formatDateTime, toLocalIsoDate } from "@/lib/format/date";

import {
  ACCOUNTANT_GRANTS,
  MANAGER_GRANTS,
  detailJson,
  listItemJson,
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

const get = (invoice: Record<string, unknown>, corrections: unknown[] = []) => ({
  "/einvoices/einv-1": () => invoice,
  "/einvoices/einv-1/provider-calls": () => [],
  "/einvoices/einv-1/error-notices": () => [],
  "/einvoices/einv-1/corrections": () => corrections,
});
/** Nháp giao hôm nay — phát hành không trễ (WF-05 Q-10). */
const today = () => toLocalIsoDate(new Date().toISOString());

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
      get: get(detailJson({ issueDate: today() })),
      post: {
        "/einvoices/einv-1/issuance": () => detailJson({ status: "SUBMITTING", version: 4 }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Phát hành" }));
    const dialog = screen.getByRole("dialog", { name: "Phát hành hoá đơn?" });
    expect(dialog).not.toHaveTextContent(/BR-\d/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Phát hành" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/issuance", { version: 3 }),
    );
  });

  it("BR-06: tells the accountant in Vietnamese why issuing was refused, inside the dialog", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(detailJson({ issueDate: today() })),
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
    expect(alert).not.toHaveTextContent(/BR-\d/);
    expect(alert).toHaveTextContent("HDDT-0007");
  });

  it("a submitting invoice says it waits for the provider and offers only a lookup", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get(detailJson({ status: "SUBMITTING" })) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText(/Đang chờ nhà cung cấp trả kết quả/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kiểm tra lại" })).toBeInTheDocument();
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
    for (const name of ["Phát hành", "Huỷ nháp", "Sửa nháp", "Kiểm tra lại"]) {
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

  it("shows when the invoice's delivery was corrected to a failure (deliveryFailedAt), only when BE sends it", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        detailJson({
          status: "ISSUED",
          issuedAt: "2026-11-08T03:00:00Z",
          deliveryFailedAt: "2026-11-09T07:00:00Z",
        }),
      ),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText("Giao thất bại lúc")).toBeInTheDocument();
    expect(screen.getByText(formatDateTime("2026-11-09T07:00:00Z"))).toBeInTheDocument();
  });

  it("no failed-delivery row on an invoice never marked", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get(detailJson()) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText("Ly giấy 8oz in logo")).toBeInTheDocument();
    expect(screen.queryByText("Giao thất bại lúc")).not.toBeInTheDocument();
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
    await userEvent.type(
      within(dialog).getByLabelText(/Đã kiểm tra gì/),
      "Cổng SePay không có hoá đơn",
    );
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
    await userEvent.type(within(dialog).getByLabelText(/Đã kiểm tra gì/), "Đã kiểm tra");
    await userEvent.click(within(dialog).getByRole("button", { name: "Rút hoá đơn" }));
    expect(await within(dialog).findByText(/Chưa rút được hoá đơn/)).toBeInTheDocument();
  });

  it("offered right after sending too — BE decides; its withdrawableFrom reads “Rút được từ <giờ>” (BE-59)", async () => {
    const from = "2026-11-23T08:30:00Z";
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get({ ...stuck, submittedAt: new Date().toISOString() }),
      post: {
        "/einvoices/einv-1/withdrawal": () => {
          throw new ApiError(
            409,
            "EINVOICE_WITHDRAWAL_REFUSED",
            "sent too recently",
            undefined,
            undefined,
            undefined,
            undefined,
            { withdrawableFrom: from, providerState: "NOT_FOUND" },
          );
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByRole("button", { name: "Kiểm tra lại" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rút hoá đơn" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Đã kiểm tra gì/), "Đã kiểm tra");
    await userEvent.click(within(dialog).getByRole("button", { name: "Rút hoá đơn" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(`Rút được từ ${formatDateTime(from)}`);
    expect(alert).toHaveTextContent(/chưa có bản ghi/);
    expect(alert).not.toHaveTextContent(/sent too recently/);
  });

  it("Q-5: a pending provider answer is never withdrawn — the refusal says so", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(stuck),
      post: {
        "/einvoices/einv-1/withdrawal": () => {
          throw new ApiError(
            409,
            "EINVOICE_WITHDRAWAL_REFUSED",
            "pending",
            undefined,
            undefined,
            undefined,
            undefined,
            { providerState: "PENDING", withdrawableFrom: null },
          );
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Rút hoá đơn" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Đã kiểm tra gì/), "Đã kiểm tra");
    await userEvent.click(within(dialog).getByRole("button", { name: "Rút hoá đơn" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/không bao giờ rút/);
  });

  it("Q-5 (F-12): an unconfirmed result needs the provider support's written answer before it is withdrawn", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(stuck),
      post: {
        "/einvoices/einv-1/withdrawal": (_params, body) => {
          if (!(body as { supportReference?: string }).supportReference)
            throw new ApiError(409, "EINVOICE_WITHDRAWAL_EVIDENCE_REQUIRED", "evidence");
          return detailJson({ status: "REJECTED", rejectionCode: "WITHDRAWN_RESULT_UNCONFIRMED" });
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Rút hoá đơn" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Đã kiểm tra gì/), "SePay không trả lời");
    const confirm = within(dialog).getByRole("button", { name: "Rút hoá đơn" });
    await userEvent.click(confirm);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /Không xác nhận được kết quả/,
    );
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/hỗ trợ nhà cung cấp/), "Phiếu SP-123");
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith("/einvoices/einv-1/withdrawal", {
        version: 3,
        reason: "SePay không trả lời",
        supportReference: "Phiếu SP-123",
      }),
    );
  });
});

describe("EInvoiceDetail — manual issue re-checked (WF-05 F-16, Q-10)", () => {
  it("Q-10: a draft delivered before today asks for the late reason and sends it", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(detailJson({ issueDate: "2026-11-10" })),
      post: { "/einvoices/einv-1/issuance": () => detailJson({ status: "SUBMITTING" }) },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Phát hành" }));
    const dialog = screen.getByRole("dialog", { name: "Phát hành hoá đơn?" });
    const confirm = within(dialog).getByRole("button", { name: "Phát hành" });
    expect(confirm).toBeDisabled();
    await userEvent.type(
      within(dialog).getByLabelText(/Lý do phát hành trễ/),
      "Hãng báo giao muộn",
    );
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/issuance", {
        version: 3,
        lateReason: "Hãng báo giao muộn",
      }),
    );
  });

  it("Q-10: when the BE asks for a late reason the FE did not foresee, the field appears", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(detailJson({ issueDate: today() })),
      post: {
        "/einvoices/einv-1/issuance": () => {
          throw new ApiError(400, "EINVOICE_LATE_ISSUE_REASON_REQUIRED", "late");
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Phát hành" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText(/Lý do phát hành trễ/)).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Phát hành" }));
    expect(await within(dialog).findByLabelText(/Lý do phát hành trễ/)).toBeInTheDocument();
  });

  it("F-16: sends the warnings seen; new ones from the BE are shown and acknowledged on the next click", async () => {
    let calls = 0;
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(detailJson({ issueDate: today(), warnings: ["TAX_RATE_NOT_ON_CONTRACT"] })),
      post: {
        "/einvoices/einv-1/issuance": () => {
          calls += 1;
          if (calls === 1)
            throw new ApiError(
              409,
              "EINVOICE_DRAFT_OUT_OF_DATE",
              "new",
              undefined,
              undefined,
              undefined,
              undefined,
              { warnings: ["TAX_CLASS_UNKNOWN"] },
            );
          return detailJson({ status: "SUBMITTING" });
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Phát hành" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/Dòng đơn chưa chốt thuế suất/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Phát hành" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/mức cao nhất 10%/);
    expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/issuance", {
      version: 3,
      acknowledgedWarnings: ["TAX_RATE_NOT_ON_CONTRACT"],
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "Phát hành" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith("/einvoices/einv-1/issuance", {
        version: 3,
        acknowledgedWarnings: ["TAX_RATE_NOT_ON_CONTRACT", "TAX_CLASS_UNKNOWN"],
      }),
    );
  });

  it("Q-10: an issued late invoice reads “Lập trễ N ngày”", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        detailJson({
          status: "ISSUED",
          issueDate: "2026-11-12",
          deliveredOn: "2026-11-10",
          warnings: ["ISSUED_LATE"],
        }),
      ),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText("Lập trễ 2 ngày")).toBeInTheDocument();
  });
});

describe("EInvoiceDetail — corrections the BE refuses are not offered (BO-03, Q-9)", () => {
  const issued = (over: Record<string, unknown> = {}) =>
    detailJson({ status: "ISSUED", hasFiles: true, invoiceNumber: 42, symbol: "C26TAA", ...over });

  it("an original with no correction offers adjust and replace", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get(issued()) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByRole("button", { name: "Lập điều chỉnh" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lập thay thế" })).toBeInTheDocument();
  });

  it("Q-9: a replacement is never adjusted; replace again and the portal reduction stay", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        issued({ type: "REPLACEMENT", originalEInvoiceId: "einv-0", correctionBasis: "ERROR" }),
      ),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByRole("button", { name: "Lập thay thế" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ghi hoá đơn giảm làm trên cổng NCC" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lập điều chỉnh" })).not.toBeInTheDocument();
  });

  it("a reversed original (reversedAt) offers neither, and says when it was reduced", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(issued({ reversedAt: "2026-11-09T08:00:00Z" })),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText("Đã giảm toàn bộ lúc")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lập điều chỉnh" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lập thay thế" })).not.toBeInTheDocument();
  });

  it("a pending system reduction hides replace", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(issued(), [
        listItemJson({ id: "einv-2", type: "ADJUSTMENT", correctionBasis: "DELIVERY_FAILED" }),
      ]),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByRole("button", { name: "Lập điều chỉnh" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lập thay thế" })).not.toBeInTheDocument();
  });

  it("Q-8 (F-14): a system reduction that cannot be sent is voided with the UNSENDABLE_REVERSAL code", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        detailJson({
          type: "ADJUSTMENT",
          originalEInvoiceId: "einv-0",
          correctionBasis: "DELIVERY_FAILED",
        }),
      ),
      post: { "/einvoices/einv-1/void": () => detailJson({ status: "VOIDED_DRAFT" }) },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ bản không gửi được" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText(/Vì sao không gửi được/),
      "NCC cũ ngừng dịch vụ",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Huỷ bản không gửi được" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/void", {
        version: 3,
        reason: "NCC cũ ngừng dịch vụ",
        reasonCode: "UNSENDABLE_REVERSAL",
      }),
    );
  });

  it("BE-11 (F-15): reduce a marked original for its failed delivery", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(issued({ deliveryFailedAt: "2026-11-09T07:00:00Z", adjusted: true })),
      post: {
        "/einvoices/einv-1/delivery-failure-reduction": () =>
          detailJson({ id: "einv-9", type: "ADJUSTMENT", correctionBasis: "DELIVERY_FAILED" }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Lập bản giảm do giao thất bại" }),
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Lập bản giảm do giao thất bại" }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/delivery-failure-reduction", {
        version: 3,
      }),
    );
  });

  it("Q-8 (F-13): a SUBMITTING invoice is recorded from the provider's portal as multipart", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(detailJson({ status: "SUBMITTING", provider: "SEPAY_EINVOICE" })),
      post: {
        "/einvoices/einv-1/portal-result": () =>
          detailJson({ status: "ISSUED", issuedVia: "PORTAL_RECORD" }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Ghi kết quả từ cổng NCC" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Đã kiểm gì/), "Cổng SePay có số 77");
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi kết quả" }));
    expect(await within(dialog).findByText(/Nhập số hoá đơn đã phát hành/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Số hoá đơn/), "77");
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi kết quả" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/einvoices/einv-1/portal-result",
        expect.any(FormData),
        expect.anything(),
      ),
    );
    const form = api.post.mock.calls.at(-1)?.[1] as FormData;
    expect(form.get("outcome")).toBe("ISSUED");
    expect(form.get("invoiceNumber")).toBe("77");
    expect(form.get("version")).toBe("3");
  });

  it("shows the portal-recorded origin of an issued invoice", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(issued({ issuedAt: "2026-11-08T03:00:00Z", issuedVia: "PORTAL_RECORD" })),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText(/Ghi lại từ cổng nhà cung cấp/)).toBeInTheDocument();
  });
});

describe("EInvoiceDetail — signature and provider handle (BO-09)", () => {
  it("checks the signature on demand and labels a SHA-1 one as unchecked, not invalid", async () => {
    const signature = vi.fn(() => ({
      status: "SHA1_UNCHECKED",
      valid: false,
      signer: "CÔNG TY TNHH STOCKFLOW",
      buyerSigned: false,
      chainChecked: false,
    }));
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: {
        ...get(detailJson({ status: "ISSUED", hasFiles: true, issuedAt: "2026-11-08T03:00:00Z" })),
        "/einvoices/einv-1/signature": signature,
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    const button = await screen.findByRole("button", { name: "Kiểm tra chữ ký số" });
    expect(signature).not.toHaveBeenCalled();
    await userEvent.click(button);
    expect(await screen.findByText(/SHA-1 — hệ thống chưa kiểm được/)).toBeInTheDocument();
  });

  it("shows the provider's tracking handle on its calls", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: {
        ...get(detailJson({ status: "SUBMITTING", provider: "SEPAY_EINVOICE" })),
        "/einvoices/einv-1/provider-calls": () => [
          {
            provider: "SEPAY_EINVOICE",
            operation: "SUBMIT",
            outcome: "PENDING",
            calledAt: "2026-11-08T03:00:00Z",
            durationMs: 300,
            providerReference: "create/TRK-42",
          },
        ],
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText(/create\/TRK-42/)).toBeInTheDocument();
  });
});

describe("EInvoiceDetail — agreement draft (BE feat/business-documents #7)", () => {
  it("a correction offers the agreement draft PDF; the original does not", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        detailJson({ type: "ADJUSTMENT", correctionBasis: "ERROR", agreementRequired: true }),
      ),
    });
    const view = renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(
      await screen.findByRole("button", { name: /Tải biên bản thoả thuận \(bản nháp\)/ }),
    ).toBeInTheDocument();
    view.unmount();
    vi.restoreAllMocks();
    mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get(detailJson()) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText("Ly giấy 8oz in logo")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Tải biên bản thoả thuận/ }),
    ).not.toBeInTheDocument();
  });
});
