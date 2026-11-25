/**
 * Audit r3 LM-3 (BE r3a): đóng phần còn lại cả lô — phần các đợt "trước khi giao" của lô đó còn phải trả trên giá trị hàng
 * đã đóng (phí khuôn, phí vận chuyển của lô) chuyển sang khoản phí của lần đóng (`carriedToFee`, `feeItemId`). Màn hoàn
 * tiền nêu phần chuyển; khoản phí đó không đọc là "Phí huỷ đơn", tên tiếng Anh của BE không lọt ra màn.
 */
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RefundDetail } from "..";
import {
  ACCOUNTANT_GRANTS,
  mockPaymentApi,
  refundJson,
  renderPaymentScreen,
} from "../__fixtures__/screen";
import {
  installmentMilestoneLabel,
  installmentName,
  installmentRef,
  installmentTitle,
  isFeeInstallment,
} from "../selectors";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

/** BE `OrderRefundResponse.Settlement` của lần đóng: 2.000.000 phí của lô 1 chuyển sang khoản phí `fee-1`, không phí thoả thuận. */
const closure = {
  settlementId: "stl-close",
  kind: "REMAINDER_CLOSED",
  collected: 0,
  closed: 18_000_000,
  reduced: 20_000_000,
  surplus: 0,
  fee: 0,
  feeCovered: 0,
  refundable: 0,
  feeOwed: 0,
  feeItemId: "fee-1",
  settledAt: "2026-11-20T04:00:00Z",
  shipmentId: null,
  shippingFeeWaived: 0,
  carriedToFee: 2_000_000,
};

describe("LM-3: what a closure carried onto its fee item", () => {
  it("shows the carried amount with a link to the fee item, even when no agreed fee is owed", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/refunds/orders/ord-15": () =>
          refundJson({ refundable: 0, remaining: 0, settlements: [closure], records: [] }),
      },
    });
    renderPaymentScreen(<RefundDetail orderId="ord-15" />);
    expect(await screen.findByText("Chuyển sang khoản phí")).toBeInTheDocument();
    expect(screen.getByText(/2\.000\.000/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Xem khoản phí" });
    expect(link).toHaveAttribute("href", expect.stringContaining("fee-1"));
    expect(screen.queryByText(/phí huỷ/i)).not.toBeInTheDocument();
  });

  it("an older BE without the field shows no such row", async () => {
    const { carriedToFee: _omitted, ...old } = closure;
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/refunds/orders/ord-15": () =>
          refundJson({ refundable: 0, remaining: 0, settlements: [old], records: [] }),
      },
    });
    renderPaymentScreen(<RefundDetail orderId="ord-15" />);
    expect(await screen.findByText("Đóng phần còn lại")).toBeInTheDocument();
    expect(screen.queryByText("Chuyển sang khoản phí")).not.toBeInTheDocument();
  });
});

describe("LM-3: the fee item is named for what it is", () => {
  it.each([
    ["Fee lines of the batches closed", "Khoản phải trả khi đóng phần còn lại"],
    [
      "Fee for the rest closed, with the fee lines of the batches closed",
      "Khoản phải trả khi đóng phần còn lại",
    ],
    ["Fee for the rest closed", "Khoản phải trả khi đóng phần còn lại"],
    ["Cancellation fee", "Phí huỷ đơn"],
  ])("%s → milestone %s", (name, label) => {
    expect(installmentMilestoneLabel({ milestone: "CANCELLATION_FEE", name })).toBe(label);
    expect(installmentName(name)).not.toBe(name);
  });

  it("names in Vietnamese; an unknown name stays as sent and reads the generic milestone", () => {
    expect(installmentTitle({ seq: 4, name: "Fee lines of the batches closed" })).toBe(
      "Đợt 4 — Phí khuôn, phí vận chuyển của các đợt giao đã đóng",
    );
    expect(installmentTitle({ seq: 1, name: "Đặt cọc" })).toBe("Đợt 1 — Đặt cọc");
    expect(installmentMilestoneLabel({ milestone: "CANCELLATION_FEE", name: "Phí mới" })).toBe(
      "Phí huỷ đơn / đóng phần còn lại",
    );
    expect(
      installmentMilestoneLabel({ milestone: "BEFORE_DELIVERY", name: "Cancellation fee" }),
    ).toBe("Trước khi giao");
  });
});

describe("FE-7 — a fee item is named, not numbered as an installment", () => {
  it("CANCELLATION_FEE / FAILED_TRIP_FEE are fee items; plan milestones are not", () => {
    expect(isFeeInstallment({ milestone: "CANCELLATION_FEE" })).toBe(true);
    expect(isFeeInstallment({ milestone: "FAILED_TRIP_FEE" })).toBe(true);
    expect(isFeeInstallment({ milestone: "BEFORE_DELIVERY" })).toBe(false);
    expect(isFeeInstallment({ milestone: null })).toBe(false);
  });

  it("title and reference drop 'Đợt 21' for a fee, keep it for a plan step", () => {
    const fee = { seq: 21, name: "Cancellation fee", milestone: "CANCELLATION_FEE" } as const;
    expect(installmentTitle(fee)).toBe("Phí huỷ đơn");
    expect(installmentRef(fee)).toBe("Phí huỷ đơn");
    expect(installmentTitle({ seq: 22, name: null, milestone: "CANCELLATION_FEE" })).toBe(
      "Phí huỷ đơn / đóng phần còn lại",
    );
    const step = { seq: 2, name: "Trước giao hàng", milestone: "BEFORE_DELIVERY" } as const;
    expect(installmentTitle(step)).toBe("Đợt 2 — Trước giao hàng");
    expect(installmentRef(step)).toBe("đợt 2");
  });
});
