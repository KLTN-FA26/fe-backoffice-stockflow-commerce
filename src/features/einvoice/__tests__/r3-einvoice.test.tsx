/**
 * Audit r3 (BE r3b): EINV-3 dòng "đang tra lại giao dịch cũ tới ngày …" sau khi rút (QĐ HĐ-1 bước 3), EINV-2 ghi hoá đơn giảm
 * trả hàng làm trên cổng NCC cho cả hoá đơn gốc, EINV-4 một mốc rút duy nhất cho hoá đơn NCC không xác nhận được.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { formatDate, formatDateTime } from "@/lib/format/date";

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
