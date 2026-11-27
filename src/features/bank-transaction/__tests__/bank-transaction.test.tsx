import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BANK_TRANSACTION_PERMISSIONS } from "@/constants/bank-transaction";
import { bePage, mockApi, renderScreen } from "@/test/api-screen";

import { BankTransactionDetail } from "../components/BankTransactionDetail";
import { BankTransactionList } from "../components/BankTransactionList";
import { allowedBankTransactionActions, BANK_TRANSACTION_TRANSITIONS } from "../lifecycle";
import { payableInstallments } from "../selectors";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const ID = "55555555-0000-4000-8000-0000000000d1";
const CUSTOMER_ID = "66666666-0000-4000-8000-0000000000d2";
const INSTALLMENT_ID = "77777777-0000-4000-8000-0000000000d3";
const needsReview = {
  id: ID,
  provider: "SEPAY",
  source: "WEBHOOK",
  providerTransactionId: "92704",
  accountNumber: "0071000888888",
  amount: 660_000,
  currency: "VND",
  content: "HD-20261126-0001-1 DOT2",
  bankReference: "FT26330123456",
  transactionAt: "2026-11-26T03:00:00Z",
  receivedAt: "2026-11-26T03:00:05Z",
  status: "NEEDS_REVIEW",
  reviewReason: "OVERPAYMENT",
  reviewNote: "Amount 660000 exceeds outstanding 600000",
  customerId: CUSTOMER_ID,
  customerName: "Công ty Ly Giấy Xanh",
  customerCode: "KH-0001",
  installmentId: INSTALLMENT_ID,
  automatic: false,
};
const installment = {
  installmentId: INSTALLMENT_ID,
  contractNumber: "HD-20261126-0001-1",
  orderNumber: "SO-0001",
  customerId: CUSTOMER_ID,
  seq: 2,
  name: "Đợt 2",
  outstanding: 600_000,
  currency: "VND",
  status: "DUE",
};
const DETAIL = `/bank-transactions/${ID}`;

afterEach(() => vi.restoreAllMocks());

describe("BANK_TRANSACTION_TRANSITIONS + gating (phần C)", () => {
  it("IGNORED / UNKNOWN là cuối; APPLIED chỉ quay lại hàng chờ khi phiếu thu bị huỷ", () => {
    expect(BANK_TRANSACTION_TRANSITIONS.IGNORED).toEqual([]);
    expect(BANK_TRANSACTION_TRANSITIONS.UNKNOWN).toEqual([]);
    expect(BANK_TRANSACTION_TRANSITIONS.APPLIED).toEqual(["NEEDS_REVIEW"]);
  });
  it("chỉ NEEDS_REVIEW + UPDATE mới gán / bỏ qua", () => {
    const update = (code: string) => code === BANK_TRANSACTION_PERMISSIONS.update;
    expect(allowedBankTransactionActions("NEEDS_REVIEW", update)).toEqual(["assign", "ignore"]);
    expect(allowedBankTransactionActions("APPLIED", update)).toEqual([]);
    expect(allowedBankTransactionActions("NEEDS_REVIEW", () => false)).toEqual([]);
  });
  it("đợt đã trả đủ / đã huỷ không vào form gán", () => {
    expect(
      payableInstallments([
        installment,
        { ...installment, installmentId: "x", status: "PAID", outstanding: 0 },
        { ...installment, installmentId: "y", status: "CANCELLED" },
      ]).map((row) => row.installmentId),
    ).toEqual([INSTALLMENT_ID]);
  });
});

describe("Danh sách giao dịch ngân hàng", () => {
  it("mặc định tab Chờ xử lý gửi status=NEEDS_REVIEW; tab Tất cả không gửi status", async () => {
    const { get } = mockApi("ACCOUNTANT", {
      get: { "/bank-transactions": () => bePage([needsReview]) },
    });
    renderScreen(<BankTransactionList />, "ACCOUNTANT");
    expect(await screen.findByText("Số tiền lớn hơn số còn phải thu của đợt")).toBeInTheDocument();
    const statusOf = (index: number) =>
      (
        get.mock.calls.filter(([url]) => url === "/bank-transactions")[index]?.[1] as {
          params: URLSearchParams;
        }
      ).params.get("status");
    expect(statusOf(0)).toBe("NEEDS_REVIEW");
    await userEvent.click(screen.getByRole("tab", { name: "Tất cả" }));
    await waitFor(() => expect(statusOf(1)).toBeNull());
  });
});

describe("Chi tiết giao dịch — gán / bỏ qua", () => {
  it("Gán: điền sẵn khách + đợt gợi ý; gửi customerId + lines đã sửa", async () => {
    const { post } = mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => needsReview,
        "/installments": () => bePage([installment]),
        [`/customers/${CUSTOMER_ID}`]: () => ({
          customerId: CUSTOMER_ID,
          name: "Công ty Ly Giấy Xanh",
        }),
      },
      post: { [`${DETAIL}/assignment`]: () => ({ ...needsReview, status: "APPLIED" }) },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    await userEvent.click(await screen.findByRole("button", { name: /Gán vào đợt/ }));
    const dialog = await screen.findByRole("dialog");
    const amount = await within(dialog).findByLabelText(/Số tiền gán/);
    await userEvent.clear(amount);
    await userEvent.type(amount, "600000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Gán và lập phiếu thu" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${DETAIL}/assignment`, {
        customerId: CUSTOMER_ID,
        lines: [{ installmentId: INSTALLMENT_ID, amount: 600_000 }],
        note: "",
      }),
    );
  });

  it("Gán vượt số tiền giao dịch → báo ngay, khoá nút", async () => {
    mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => needsReview,
        "/installments": () => bePage([installment]),
        [`/customers/${CUSTOMER_ID}`]: () => ({
          customerId: CUSTOMER_ID,
          name: "Công ty Ly Giấy Xanh",
        }),
      },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    await userEvent.click(await screen.findByRole("button", { name: /Gán vào đợt/ }));
    const dialog = await screen.findByRole("dialog");
    const amount = await within(dialog).findByLabelText(/Số tiền gán/);
    await userEvent.clear(amount);
    await userEvent.type(amount, "700000");
    expect(within(dialog).getByText(/vượt số tiền của giao dịch/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gán và lập phiếu thu" })).toBeDisabled();
  });

  it("Bỏ qua: lý do bắt buộc, gửi tới /ignore", async () => {
    const { post } = mockApi("ACCOUNTANT", {
      get: { [DETAIL]: () => needsReview },
      post: { [`${DETAIL}/ignore`]: () => ({ ...needsReview, status: "IGNORED" }) },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    await userEvent.click(await screen.findByRole("button", { name: /Bỏ qua/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "Tiền chuyển nhầm");
    await userEvent.click(within(dialog).getByRole("button", { name: "Bỏ qua" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${DETAIL}/ignore`, { reason: "Tiền chuyển nhầm" }),
    );
  });

  it("Đã tự lập phiếu thu → không nút, người xử lý 'Tự động', link phiếu thu", async () => {
    mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => ({
          ...needsReview,
          status: "APPLIED",
          reviewReason: null,
          automatic: true,
          receiptId: "r-1",
          receiptReference: "FT26330123456",
          decidedAt: "2026-11-26T03:00:06Z",
        }),
      },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    expect(await screen.findByText("Tự động")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FT26330123456" })).toHaveAttribute(
      "href",
      "/admin/payment/receipts/r-1",
    );
    expect(screen.queryByRole("button", { name: /Gán vào đợt/ })).not.toBeInTheDocument();
  });
});
