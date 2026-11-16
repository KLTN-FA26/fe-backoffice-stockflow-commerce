import { describe, expect, it } from "vitest";

import {
  INSTALLMENT_API_STATUSES,
  INSTALLMENT_STATUS_BY_API,
  RECEIPT_API_STATUSES,
  RECEIPT_STATUS_BY_API,
} from "@/constants/payment";
import { statusLabelVi, toneOf } from "@/lib/status-map";

describe("installment and receipt statuses render in the shared status map", () => {
  it("every installment status has a Vietnamese label and a deliberate tone", () => {
    const tones = Object.fromEntries(
      INSTALLMENT_API_STATUSES.map((status) => [
        INSTALLMENT_STATUS_BY_API[status],
        toneOf(INSTALLMENT_STATUS_BY_API[status]),
      ]),
    );
    expect(tones).toEqual({
      "Not Due": "neutral",
      Due: "info",
      "Partially Paid": "warning",
      Paid: "positive",
      Overdue: "danger",
      Cancelled: "danger",
    });
    for (const status of INSTALLMENT_API_STATUSES)
      expect(statusLabelVi(INSTALLMENT_STATUS_BY_API[status], "payment")).toBeTruthy();
  });

  it("labels follow the docs wording: chưa đến hạn, đến hạn, quá hạn", () => {
    expect(statusLabelVi("Not Due", "payment")).toBe("Chưa đến hạn");
    expect(statusLabelVi("Due", "payment")).toBe("Đến hạn");
    expect(statusLabelVi("Overdue", "payment")).toBe("Quá hạn");
  });

  it("a voided receipt reads 'Đã huỷ' (not the generic 'Đã vô hiệu' of other modules)", () => {
    expect(statusLabelVi(RECEIPT_STATUS_BY_API.RECORDED, "payment")).toBe("Đã ghi nhận");
    expect(statusLabelVi(RECEIPT_STATUS_BY_API.VOIDED, "payment")).toBe("Đã huỷ");
    expect(statusLabelVi("Voided", "product")).toBe("Đã vô hiệu");
    expect(RECEIPT_API_STATUSES.map((status) => toneOf(RECEIPT_STATUS_BY_API[status]))).toEqual([
      "positive",
      "muted",
    ]);
  });
});
