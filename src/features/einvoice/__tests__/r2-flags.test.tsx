/**
 * Audit r2 (FE pass 2): "Ghi hoá đơn giảm" theo cờ và lựa chọn của BE (M-10), lỗi từng ô của BE (M-2 / M-10), và "Gửi lại
 * hoá đơn qua e-mail" (einvoice M-1).
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EINVOICE_RESEND_EMAIL_PERMISSION } from "@/constants/einvoice";
import { ApiError } from "@/lib/api/error";

import {
  ACCOUNTANT_GRANTS,
  detailJson,
  mockEInvoiceApi,
  renderEInvoiceScreen,
} from "../__fixtures__/screen";
import { EInvoiceDetail } from "../components/EInvoiceDetail";

import type { PermissionCode } from "@/lib/auth";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin/invoicing/einvoices/einv-1",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const RETURN_ID = "0193a1b2-0000-7000-8000-0000000000aa";
const issuedReplacement = (over: Record<string, unknown> = {}) =>
  detailJson({
    status: "ISSUED",
    type: "REPLACEMENT",
    originalEInvoiceId: "einv-0",
    correctionBasis: "ERROR",
    hasFiles: true,
    templateCode: "1",
    symbol: "C26TAA",
    invoiceNumber: 42,
    ...over,
  });
const get = (invoice: Record<string, unknown>) => ({
  "/einvoices/einv-1": () => invoice,
  "/einvoices/einv-1/provider-calls": () => [],
  "/einvoices/einv-1/error-notices": () => [],
  "/einvoices/einv-1/corrections": () => [],
});

/** Điền đủ các ô bắt buộc của hộp thoại ghi hoá đơn giảm (ngày = hôm nay). */
async function fillReduction(dialog: HTMLElement) {
  await userEvent.type(within(dialog).getByLabelText(/Ký hiệu/), "C26TAB");
  await userEvent.type(within(dialog).getByLabelText(/Số hoá đơn/), "12");
  await userEvent.click(within(dialog).getByLabelText(/Ngày hoá đơn/));
  await userEvent.click(await screen.findByRole("button", { name: "Hôm nay" }));
  await userEvent.upload(
    within(dialog).getByLabelText(/Bản PDF/),
    new File(["%PDF"], "g.pdf", { type: "application/pdf" }),
  );
  await userEvent.upload(
    within(dialog).getByLabelText(/Tệp XML/),
    new File(["<HDon/>"], "g.xml", { type: "text/xml" }),
  );
  await userEvent.type(within(dialog).getByLabelText(/Ghi chú/), "Giảm trên cổng SePay");
}

describe("audit r2 M-10: recording a portal reduction follows the BE's options", () => {
  it("a replacement in force with nothing waiting to be reduced has no “Ghi hoá đơn giảm”", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(issuedReplacement({ externalReductionAllowed: false })),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByRole("button", { name: "Lập thay thế" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ghi hoá đơn giảm làm trên cổng NCC" }),
    ).not.toBeInTheDocument();
  });

  it("offers only the BE's bases, picks among the BE's returns (no /returns call) and sends the return's id", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        issuedReplacement({
          externalReductionAllowed: true,
          externalReductionBases: ["RETURN", "SOMETHING_NEW"],
          externalReductionReturns: [{ returnRequestId: RETURN_ID, rmaNumber: "RMA-0042" }],
        }),
      ),
      post: {
        "/einvoices/einv-1/external-reductions": () =>
          detailJson({ id: "einv-7", type: "ADJUSTMENT", status: "ISSUED" }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Ghi hoá đơn giảm làm trên cổng NCC" }),
    );
    const dialog = screen.getByRole("dialog");
    // Căn cứ duy nhất BE nhận lúc này: trả hàng; căn cứ lạ bị bỏ
    await userEvent.click(within(dialog).getByRole("combobox", { name: /Căn cứ giảm/ }));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Trả hàng (hàng đã hoàn tiền)"]);
    await userEvent.keyboard("{Escape}");
    // Một yêu cầu chờ giảm → chọn sẵn
    expect(within(dialog).getByRole("combobox", { name: /Yêu cầu trả hàng/ })).toHaveTextContent(
      "RMA-0042",
    );
    await fillReduction(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi hoá đơn giảm" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/einvoices/einv-1/external-reductions",
        expect.any(FormData),
        expect.anything(),
      ),
    );
    const form = api.post.mock.calls.at(-1)?.[1] as FormData;
    expect(form.get("basis")).toBe("RETURN");
    expect(form.get("returnRequestId")).toBe(RETURN_ID);
    expect(api.get.mock.calls.some(([url]) => url === "/returns")).toBe(false);
  });

  it("CF-4/CF-10: a rest invoice (no shipment) records DELIVERY_FAILED with no amount and no ids, when the BE offers it", async () => {
    const rest = (over: Record<string, unknown> = {}) =>
      issuedReplacement({ shipmentId: null, type: "ORIGINAL", correctionBasis: null, ...over });
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        rest({ externalReductionAllowed: true, externalReductionBases: ["DELIVERY_FAILED"] }),
      ),
      post: {
        "/einvoices/einv-1/external-reductions": () =>
          detailJson({ id: "einv-7", type: "ADJUSTMENT", status: "ISSUED" }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Ghi hoá đơn giảm làm trên cổng NCC" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("combobox", { name: /Căn cứ giảm/ })).toHaveTextContent(
      "phí vận chuyển đã miễn",
    );
    expect(dialog).toHaveTextContent("hệ thống tự tính số tiền");
    await fillReduction(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi hoá đơn giảm" }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const form = api.post.mock.calls.at(-1)?.[1] as FormData;
    expect(form.get("basis")).toBe("DELIVERY_FAILED");
    expect(form.has("returnRequestId")).toBe(false);
    expect(form.has("voidedAdjustmentId")).toBe(false);
    expect(form.has("amount")).toBe(false);
  });

  it("marks the box the BE names in fieldErrors, in Vietnamese (never the BE's English)", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        issuedReplacement({
          externalReductionAllowed: true,
          externalReductionBases: ["DELIVERY_FAILED"],
        }),
      ),
      post: {
        "/einvoices/einv-1/external-reductions": () => {
          throw new ApiError(400, "VALIDATION_FAILED", "issueDate: not in the future", {
            issueDate: "not in the future",
          });
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Ghi hoá đơn giảm làm trên cổng NCC" }),
    );
    const dialog = screen.getByRole("dialog");
    await fillReduction(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi hoá đơn giảm" }));
    expect(
      await within(dialog).findByText("Ngày hoá đơn không được ở tương lai."),
    ).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("not in the future");
  });
});

describe("audit r2 M-2: portal result — the BE's missing fields are marked", () => {
  it("a 400 naming lookupCode marks that box", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(detailJson({ status: "SUBMITTING", provider: "SEPAY_EINVOICE" })),
      post: {
        "/einvoices/einv-1/portal-result": () => {
          throw new ApiError(400, "VALIDATION_FAILED", "lookupCode required", {
            lookupCode: "required",
          });
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Ghi kết quả từ cổng NCC" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Số hoá đơn/), "77");
    await userEvent.type(within(dialog).getByLabelText(/Mã cơ quan thuế/), "M1-26-ABCDE");
    await userEvent.type(within(dialog).getByLabelText(/Mã tra cứu/), "X");
    await userEvent.upload(
      within(dialog).getByLabelText(/Tệp XML/),
      new File(["<HDon/>"], "hd.xml", { type: "text/xml" }),
    );
    await userEvent.upload(
      within(dialog).getByLabelText(/Bản PDF/),
      new File(["%PDF"], "hd.pdf", { type: "application/pdf" }),
    );
    await userEvent.type(within(dialog).getByLabelText(/Đã kiểm gì/), "Cổng SePay có số 77");
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi kết quả" }));
    expect(
      await within(dialog).findByText("Nhập mã tra cứu hoá đơn trên cổng."),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Mã tra cứu/)).toHaveAttribute("aria-invalid", "true");
  });
});

describe("audit r2 einvoice M-1: e-mail an issued invoice again", () => {
  const LEGAL: PermissionCode[] = [...ACCOUNTANT_GRANTS, EINVOICE_RESEND_EMAIL_PERMISSION];

  it("sends it and says where it went", async () => {
    const api = mockEInvoiceApi(LEGAL, {
      get: get(issuedReplacement()),
      post: {
        "/einvoices/einv-1/email": () => ({
          einvoiceId: "einv-1",
          recipient: "ketoan@saigonxua.vn",
          requestedAt: "2026-11-24T02:00:00Z",
        }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(
      await screen.findByRole("button", { name: /Gửi lại hoá đơn qua e-mail/ }),
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Gửi lại hoá đơn qua e-mail/ }),
    );
    expect(await screen.findByText(/Đã yêu cầu gửi tới ketoan@saigonxua.vn/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/einvoices/einv-1/email");
  });

  it("a customer with no invoice e-mail is told to record it first (details.missing EMAIL)", async () => {
    mockEInvoiceApi(LEGAL, {
      get: get(issuedReplacement()),
      post: {
        "/einvoices/einv-1/email": () => {
          throw new ApiError(
            409,
            "EINVOICE_BUYER_PROFILE_INCOMPLETE",
            "no e-mail",
            undefined,
            undefined,
            undefined,
            undefined,
            { missing: ["EMAIL"] },
          );
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(
      await screen.findByRole("button", { name: /Gửi lại hoá đơn qua e-mail/ }),
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Gửi lại hoá đơn qua e-mail/ }),
    );
    expect(
      await within(dialog).findByText(/Khách chưa có e-mail nhận hoá đơn/),
    ).toBeInTheDocument();
  });

  it("is not offered without customer-legal-profiles:UPDATE, nor on an invoice whose signature fails", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, { get: get(issuedReplacement()) });
    const view = renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByRole("button", { name: "Lập thay thế" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gửi lại hoá đơn qua e-mail/ })).toBeNull();
    view.unmount();
    vi.restoreAllMocks();
    mockEInvoiceApi(LEGAL, { get: get(issuedReplacement({ warnings: ["SIGNATURE_INVALID"] })) });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByRole("button", { name: "Lập thay thế" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gửi lại hoá đơn qua e-mail/ })).toBeNull();
  });
});
