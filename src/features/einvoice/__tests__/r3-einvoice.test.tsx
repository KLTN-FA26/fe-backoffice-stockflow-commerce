/**
 * Audit r3 (BE r3b): EINV-3 dòng "đang tra lại giao dịch cũ tới ngày …" sau khi rút (QĐ HĐ-1 bước 3), EINV-2 ghi hoá đơn giảm
 * trả hàng làm trên cổng NCC cho cả hoá đơn gốc và điều chỉnh sai sót đã huỷ (căn cứ ERROR kèm `voidedAdjustmentId`, BE r3
 * merge 9d837fb3d), EINV-4 một mốc rút duy nhất cho hoá đơn NCC không xác nhận được.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { ApiError } from "@/lib/api/error";
import { formatMoney } from "@/lib/format";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { openDatePicker } from "@/test/date-picker";

import {
  ACCOUNTANT_GRANTS,
  detailJson,
  mockEInvoiceApi,
  renderEInvoiceScreen,
} from "../__fixtures__/screen";
import { EInvoiceDetail } from "../components/EInvoiceDetail";
import { transactionWatchText, withdrawalBlockedText } from "../selectors";

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
  "/einvoices/einv-1/corrections": () => [],
});

const W = EINVOICE_LABELS.watch;
const FUTURE = "2099-12-20T05:00:00Z";

describe("EINV-3: the 30-day watch after a withdrawal", () => {
  it("a withdrawn invoice says until which day the old transaction is looked up", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        detailJson({
          status: "REJECTED",
          rejectionCode: "WITHDRAWN_RESULT_UNCONFIRMED",
          rejectionMessage: "Phiếu hỗ trợ 123",
          watchUntil: FUTURE,
        }),
      ),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText(W.until(formatDate(FUTURE)))).toBeInTheDocument();
    expect(W.until("20/12/2099")).toContain("Đang tra lại giao dịch cũ tới ngày");
  });

  it("found issued after all: a warning, also after the invoice was reopened", async () => {
    const found = "2026-11-21T02:00:00Z";
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(detailJson({ status: "DRAFT", watchUntil: FUTURE, watchFoundAt: found })),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText(W.found(formatDateTime(found)))).toBeInTheDocument();
    expect(screen.queryByText(W.until(formatDate(FUTURE)))).not.toBeInTheDocument();
  });

  it("audit r3 CF-9: an older watch that found the provider issuing wins over a newer watch still running", async () => {
    // Lượt A (giao dịch tx-0 đã rút) thấy NCC phát hành; lượt B (tx-1, gửi lại rồi bị buông) còn tra tới FUTURE
    const found = "2026-11-22T01:00:00Z";
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        detailJson({
          status: "REJECTED",
          rejectionCode: "WITHDRAWN_RESULT_UNCONFIRMED",
          watchUntil: FUTURE,
          watchFoundAt: found,
        }),
      ),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    expect(await screen.findByText(W.found(formatDateTime(found)))).toBeInTheDocument();
    expect(screen.queryByText(W.until(formatDate(FUTURE)))).not.toBeInTheDocument();
    expect(transactionWatchText({ watchUntil: FUTURE, watchFoundAt: found })?.tone).toBe("warning");
  });

  it("no watch (nothing let go, or an older BE) → no line; a past day reads as done", () => {
    expect(transactionWatchText({})).toBeNull();
    expect(transactionWatchText({ watchUntil: null, watchFoundAt: null })).toBeNull();
    const past = "2026-01-02T00:00:00Z";
    expect(transactionWatchText({ watchUntil: past }, new Date("2026-03-01T00:00:00Z"))).toEqual({
      text: W.ended(formatDate(past)),
      tone: "info",
    });
  });
});

describe("EINV-2: a portal reduction of a return on an original", () => {
  it("an ORIGINAL the BE opens for RETURN offers the action and the return the BE names", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        detailJson({
          status: "ISSUED",
          type: "ORIGINAL",
          hasFiles: true,
          symbol: "C26TAA",
          invoiceNumber: 7,
          externalReductionAllowed: true,
          externalReductionBases: ["RETURN"],
          externalReductionReturns: [
            { returnRequestId: "0193a1b2-0000-7000-8000-0000000000bb", rmaNumber: "RMA-0050" },
          ],
        }),
      ),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Ghi hoá đơn giảm làm trên cổng NCC" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("RMA-0050");
    // Căn cứ không còn nói "trên hoá đơn thay thế": hoá đơn này là hoá đơn gốc
    expect(dialog).toHaveTextContent("Trả hàng (hàng đã hoàn tiền)");
    expect(dialog).not.toHaveTextContent("giảm trên hoá đơn thay thế");
  });
});

const DRAFT_A = "0193a1b2-0000-7000-8000-00000000e001";
const DRAFT_B = "0193a1b2-0000-7000-8000-00000000e002";
const errorOriginal = (over: Record<string, unknown> = {}) =>
  detailJson({
    status: "ISSUED",
    type: "ORIGINAL",
    hasFiles: true,
    symbol: "C26TAA",
    invoiceNumber: 7,
    externalReductionAllowed: true,
    externalReductionBases: ["ERROR"],
    externalReductionErrors: [
      {
        voidedAdjustmentId: DRAFT_A,
        code: "HDDT-0101",
        reason: "Sai đơn giá",
        grandTotal: -540000,
      },
      {
        voidedAdjustmentId: DRAFT_B,
        code: "HDDT-0102",
        reason: "Ghi thừa 2 thùng",
        grandTotal: -1684800,
      },
    ],
    ...over,
  });

/** Điền đủ các ô bắt buộc của hộp thoại ghi hoá đơn giảm (ngày = hôm nay). */
async function fillReduction(dialog: HTMLElement) {
  await userEvent.type(within(dialog).getByLabelText(/Ký hiệu/), "C26TAB");
  await userEvent.type(within(dialog).getByLabelText(/Số hoá đơn/), "12");
  await openDatePicker(userEvent.setup(), within(dialog).getByLabelText(/Ngày hoá đơn/));
  await userEvent.click(await screen.findByRole("button", { name: "Hôm nay" }));
  await userEvent.upload(
    within(dialog).getByLabelText(/Bản PDF/),
    new File(["%PDF"], "g.pdf", { type: "application/pdf" }),
  );
  await userEvent.upload(
    within(dialog).getByLabelText(/Tệp XML/),
    new File(["<HDon/>"], "g.xml", { type: "text/xml" }),
  );
  await userEvent.type(within(dialog).getByLabelText(/Ghi chú/), "Điều chỉnh sai sót trên cổng");
}

async function openReduction() {
  await userEvent.click(
    await screen.findByRole("button", { name: "Ghi hoá đơn giảm làm trên cổng NCC" }),
  );
  return screen.getByRole("dialog");
}

async function pickDraft(dialog: HTMLElement, index: number) {
  await userEvent.click(
    within(dialog).getByRole("combobox", { name: /Bản điều chỉnh sai sót đã huỷ/ }),
  );
  const options = await screen.findAllByRole("option");
  await userEvent.click(options[index] as HTMLElement);
  return options;
}

describe("EINV-2, the ERROR half: a voided error correction recorded from the portal", () => {
  it("picks among the BE's voided drafts only, requires one, and sends basis ERROR with its voidedAdjustmentId", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(errorOriginal()),
      post: {
        "/einvoices/einv-1/external-reductions": () =>
          detailJson({ id: "einv-9", type: "ADJUSTMENT", status: "ISSUED" }),
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    const dialog = await openReduction();
    expect(within(dialog).getByRole("combobox", { name: /Căn cứ giảm/ })).toHaveTextContent(
      "Điều chỉnh sai sót",
    );
    // Hai bản nháp → không chọn sẵn; thiếu thì FE chặn, không gửi
    await fillReduction(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi hoá đơn giảm" }));
    expect(
      await within(dialog).findByText(
        "Chọn bản điều chỉnh sai sót đã huỷ mà hoá đơn trên cổng thay cho",
      ),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    const options = await pickDraft(dialog, 1);
    expect(options.map((option) => option.textContent)).toEqual([
      `HDDT-0101 · Sai đơn giá · ${formatMoney(-540000, "VND")}`,
      `HDDT-0102 · Ghi thừa 2 thùng · ${formatMoney(-1684800, "VND")}`,
    ]);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi hoá đơn giảm" }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const form = api.post.mock.calls.at(-1)?.[1] as FormData;
    expect(form.get("basis")).toBe("ERROR");
    expect(form.get("voidedAdjustmentId")).toBe(DRAFT_B);
    expect(form.has("returnRequestId")).toBe(false);
  });

  it("a 409 says why in Vietnamese for an error correction (recorded already, or the original holds too little)", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(
        errorOriginal({
          externalReductionErrors: [
            { voidedAdjustmentId: DRAFT_A, code: "HDDT-0101", reason: null, grandTotal: -540000 },
          ],
        }),
      ),
      post: {
        "/einvoices/einv-1/external-reductions": () => {
          throw new ApiError(
            409,
            "EINVOICE_EXTERNAL_REDUCTION_NOT_APPLICABLE",
            "Not recorded against HDDT-0001: it holds fewer of those goods than the correction takes off",
          );
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    const dialog = await openReduction();
    // Một bản nháp → chọn sẵn; lý do vắng thì nhãn không có "null"
    const picker = within(dialog).getByRole("combobox", { name: /Bản điều chỉnh sai sót đã huỷ/ });
    // So chuỗi thô: `toHaveTextContent` gộp khoảng trắng không ngắt của định dạng tiền
    expect(picker.textContent).toBe(`HDDT-0101 · ${formatMoney(-540000, "VND")}`);
    await fillReduction(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi hoá đơn giảm" }));
    expect(
      await within(dialog).findByText(/Không ghi được bản điều chỉnh sai sót đã chọn/),
    ).toHaveTextContent("không còn đủ số hàng mà bản điều chỉnh giảm");
    expect(dialog).not.toHaveTextContent("holds fewer");
  });

  it("after a 409 the reloaded list no longer naming the chosen draft clears the choice: it is not sent again", async () => {
    let recorded = false;
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: {
        ...get(errorOriginal()),
        "/einvoices/einv-1": () =>
          recorded
            ? errorOriginal({
                externalReductionErrors: [
                  {
                    voidedAdjustmentId: DRAFT_A,
                    code: "HDDT-0101",
                    reason: "Sai đơn giá",
                    grandTotal: -540000,
                  },
                ],
              })
            : errorOriginal(),
      },
      post: {
        "/einvoices/einv-1/external-reductions": () => {
          recorded = true;
          throw new ApiError(409, "EINVOICE_EXTERNAL_REDUCTION_NOT_APPLICABLE", "recorded once");
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    const dialog = await openReduction();
    await pickDraft(dialog, 1);
    await fillReduction(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi hoá đơn giảm" }));
    await within(dialog).findByText(/Không ghi được bản điều chỉnh sai sót đã chọn/);
    const picker = within(dialog).getByRole("combobox", { name: /Bản điều chỉnh sai sót đã huỷ/ });
    await waitFor(() => expect(picker).toHaveTextContent("Chọn bản điều chỉnh sai sót"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi hoá đơn giảm" }));
    expect(
      await within(dialog).findByText(
        "Chọn bản điều chỉnh sai sót đã huỷ mà hoá đơn trên cổng thay cho",
      ),
    ).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("a date before the reduced invoice's is stopped on the box (the BE answers it with no field)", async () => {
    const api = mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(errorOriginal({ issueDate: "2099-01-05" })),
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    const dialog = await openReduction();
    await pickDraft(dialog, 0);
    await fillReduction(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi hoá đơn giảm" }));
    expect(
      await within(dialog).findByText(/không được trước ngày của hoá đơn bị giảm/),
    ).toHaveTextContent(formatDate("2099-01-05"));
    expect(api.post).not.toHaveBeenCalled();
  });

  it("a 400 naming no box gets a Vietnamese sentence saying what to check", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {
      get: get(errorOriginal()),
      post: {
        "/einvoices/einv-1/external-reductions": () => {
          throw new ApiError(
            400,
            "VALIDATION_FAILED",
            "voidedAdjustmentId: required for an error, and no returnRequestId",
          );
        },
      },
    });
    renderEInvoiceScreen(<EInvoiceDetail id="einv-1" />);
    const dialog = await openReduction();
    await pickDraft(dialog, 0);
    await fillReduction(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ghi hoá đơn giảm" }));
    expect(
      await within(dialog).findByText(/bản điều chỉnh sai sót đã chọn\. Kiểm tra lại rồi ghi/),
    ).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("voidedAdjustmentId");
  });
});

describe("EINV-4: one withdrawal time for an invoice the provider cannot confirm", () => {
  it("shows the BE's single time (lastSent + 1 day), never its own +3 h", () => {
    const from = "2026-11-25T03:00:00Z";
    const text = withdrawalBlockedText({
      status: "SUBMITTING",
      withdrawable: false,
      withdrawalBlockedBy: "TOO_RECENT",
      withdrawableFrom: from,
    });
    expect(text).toContain(`Rút được từ ${formatDateTime(from)}`);
  });
});
