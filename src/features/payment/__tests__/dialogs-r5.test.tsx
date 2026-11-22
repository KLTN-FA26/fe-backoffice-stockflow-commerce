import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CUSTOMER_LEGAL_PROFILE_PERMISSIONS, ORDER_PERMISSIONS } from "@/constants";
import { bePage } from "@/test/api-screen";

import { InstallmentList, ReceiptDetail, RefundDetail } from "..";
import {
  ACCOUNTANT_GRANTS,
  installmentJson,
  mockPaymentApi,
  receiptJson,
  refundJson,
  renderPaymentScreen,
} from "../__fixtures__/screen";

vi.mock("@/lib/api/file-download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/file-download")>()),
  saveFile: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

describe("Receipt dialog — round 5 (BO-UX-39, BO-UX-4)", () => {
  it("names the customer and tax code; the amount is grouped with ₫", async () => {
    const due = installmentJson({
      customerName: "Công ty Bao Bì An Phát",
      customerCode: "0312345678",
      dueDate: "2026-11-20",
    });
    mockPaymentApi(ACCOUNTANT_GRANTS, { get: { "/installments": () => bePage([due]) } });
    renderPaymentScreen(<InstallmentList />);
    // The row button names its contract and installment (BO-UX-11), so match the prefix.
    await userEvent.click(await screen.findByRole("button", { name: /^Lập phiếu thu — / }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("heading", {
        name: "Lập phiếu thu — Công ty Bao Bì An Phát (MST 0312345678)",
      }),
    ).toBeInTheDocument();
    expect(dialog.getByLabelText(/Số tiền/)).toHaveValue("25.000.000");
    // The chosen installment shows its due day and what it still owes.
    expect(dialog.getAllByText(/hạn 20 thg 11, 2026 · còn 25\.000\.000/).length).toBeGreaterThan(0);
  });
});

describe("Void receipt dialog — round 5 (BO-UX-40)", () => {
  const receipt = receiptJson({
    lines: [
      {
        installmentId: "inst-1",
        amount: 10_000_000,
        orderNumber: "SO-1",
        milestone: "ON_SIGNING",
      },
      {
        installmentId: "inst-2",
        amount: 15_000_000,
        orderNumber: "SO-2",
        milestone: "BEFORE_DELIVERY",
      },
    ],
  });

  it("speaks Vietnamese and names the orders the void may hold", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, { get: { "/payment-receipts/rcp-1": () => receipt } });
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ phiếu thu" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/chuyển sang Đã huỷ/)).toBeInTheDocument();
    expect(dialog.queryByText(/Voided|Confirmed/)).not.toBeInTheDocument();
    expect(dialog.getByText("Đơn có tiền trong phiếu này")).toBeInTheDocument();
    expect(dialog.getByText("SO-2")).toBeInTheDocument();
    expect(
      dialog.getByLabelText("Treo các đơn SO-1 nếu huỷ làm đơn thiếu đợt khi ký"),
    ).toBeInTheDocument();
  });
});

describe("Refund dialog — round 5 (BO-UX-41)", () => {
  const grants = [
    ...ACCOUNTANT_GRANTS,
    ORDER_PERMISSIONS.read,
    CUSTOMER_LEGAL_PROFILE_PERMISSIONS.read,
  ];
  const routes = (profile: () => unknown) => ({
    get: {
      "/refunds/orders/ord-15": () => refundJson({ settlements: [], records: [] }),
      "/orders/ord-15": () => ({ customerId: "cust-9", customerName: "Công ty An Phát" }),
      "/customers/cust-9/legal-profile": profile,
    },
  });

  it("shows the customer and the bank account from the legal profile above the amount", async () => {
    mockPaymentApi(
      grants,
      routes(() => ({
        companyName: "Công ty TNHH An Phát",
        taxCode: "0312345678",
        bankAccount: {
          accountNumber: "0071000123456",
          bankName: "Vietcombank",
          accountHolder: "CONG TY TNHH AN PHAT",
        },
      })),
    );
    renderPaymentScreen(<RefundDetail orderId="ord-15" />);
    await userEvent.click(await screen.findByRole("button", { name: "Ghi nhận đã hoàn" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(await dialog.findByText("Công ty TNHH An Phát")).toBeInTheDocument();
    expect(dialog.getByText("MST 0312345678")).toBeInTheDocument();
    expect(dialog.getByText("0071000123456")).toBeInTheDocument();
    expect(dialog.getByText(/Vietcombank · CONG TY TNHH AN PHAT/)).toBeInTheDocument();
    expect(dialog.getByLabelText(/Số tiền đã hoàn/)).toHaveFocus();
  });

  it("no account on the profile is said, not guessed", async () => {
    mockPaymentApi(
      grants,
      routes(() => ({ companyName: "Công ty TNHH An Phát" })),
    );
    renderPaymentScreen(<RefundDetail orderId="ord-15" />);
    await userEvent.click(await screen.findByRole("button", { name: "Ghi nhận đã hoàn" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      await dialog.findByText(/Chưa có tài khoản ngân hàng trong thông tin pháp lý/),
    ).toBeInTheDocument();
  });
});
