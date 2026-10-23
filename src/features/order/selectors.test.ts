import { describe, expect, it } from "vitest";

import {
  availableRefusalActions,
  cancelConsequence,
  formatCancellationReason,
  parseCancellationReason,
  retainedAmountPreview,
  creditHoldSummary,
  creditOverage,
  creditState,
  customLineCount,
  depositState,
  groupProductionOrdersByLine,
  releaseBlockers,
  shouldFlagOrderRow,
} from "./selectors";

import type { ProductionOrder } from "./types";

describe("depositState — docs 15 BR-02 / docs 19 BR-09", () => {
  it("không phải đơn cọc → not-applicable", () => {
    expect(depositState({ paymentTerm: "PREPAID", depositReceivedAt: null })).toBe(
      "not-applicable",
    );
  });
  it("đơn cọc chưa / đã nhận cọc", () => {
    expect(depositState({ paymentTerm: "DEPOSIT", depositReceivedAt: null })).toBe("awaiting");
    expect(
      depositState({ paymentTerm: "DEPOSIT", depositReceivedAt: "2026-09-08T02:00:00Z" }),
    ).toBe("received");
  });
});

describe("creditState / creditOverage — docs 14 BR-06", () => {
  it("chờ duyệt vượt hạn mức ⇔ đơn CREDIT On Hold với lý do CREDIT (BE PR #133 holdReason)", () => {
    expect(creditState({ paymentTerm: "CREDIT", status: "On Hold", holdReason: "CREDIT" })).toBe(
      "on-hold",
    );
    expect(creditState({ paymentTerm: "CREDIT", status: "Confirmed", holdReason: null })).toBe(
      "within-limit",
    );
    expect(creditState({ paymentTerm: "DEPOSIT", status: "On Hold", holdReason: "ADDRESS" })).toBe(
      "not-applicable",
    );
  });
  it.each(["ADDRESS", "DESIGN_MISMATCH", "FRAUD", "UNKNOWN", null] as const)(
    "đơn CREDIT giữ vì %s → không phải chờ duyệt công nợ (đã qua kiểm hạn mức)",
    (holdReason) => {
      expect(creditState({ paymentTerm: "CREDIT", status: "On Hold", holdReason })).toBe(
        "within-limit",
      );
    },
  );
  it("phần vượt = dư nợ + giá trị đơn − hạn mức, không âm", () => {
    expect(creditOverage({ creditLimit: 100, exposure: 60, orderAmount: 70 })).toBe(30);
    expect(creditOverage({ creditLimit: 100, exposure: 10, orderAmount: 20 })).toBe(0);
  });
});

describe("creditHoldSummary — chỉ nêu tình trạng số liệu BE chứng minh được", () => {
  const order = { currency: "VND" };
  const hold = (creditLimit: number, exposure: number, orderAmount: number, currency = "VND") => ({
    creditLimit,
    exposure,
    orderAmount,
    order: { ...order, currency },
  });

  it("A. vượt > 0 → over-limit kèm đúng số vượt", () => {
    expect(creditHoldSummary(hold(1_000_000, 800_000, 350_000))).toEqual({
      kind: "over-limit",
      excess: 150_000,
    });
  });

  it("B. vượt = 0 (BE submitOnCredit chỉ giữ khi OVERDUE hoặc OVER_LIMIT) → overdue", () => {
    expect(creditHoldSummary(hold(1_000_000, 200_000, 350_000))).toEqual({ kind: "overdue" });
    // Đúng bằng hạn mức: BE coi là trong hạn mức (≤) → đang giữ thì chỉ có thể vì nợ quá hạn
    expect(creditHoldSummary(hold(1_000_000, 650_000, 350_000))).toEqual({ kind: "overdue" });
  });

  it("sai số số thực dưới đơn vị nhỏ nhất của tiền tệ không thành 'vượt 0,00'", () => {
    // 100.1 + 0.2 − 100.3 ≈ 5.7e-14 trên số thực
    expect(creditHoldSummary(hold(100.3, 100.1, 0.2, "USD"))).toEqual({ kind: "overdue" });
    expect(creditHoldSummary(hold(100, 100, 0.01, "USD"))).toEqual({
      kind: "over-limit",
      excess: expect.closeTo(0.01, 6),
    });
  });
});

describe("releaseBlockers — lý do chưa release biết trước", () => {
  it("BR-PRD-09: đơn cọc Pending Payment chưa nhận cọc", () => {
    expect(
      releaseBlockers({
        status: "Pending Payment",
        paymentTerm: "DEPOSIT",
        depositReceivedAt: null,
        holdReason: null,
      }),
    ).toEqual([{ rule: "BR-PRD-09", message: "Đơn đặt cọc chưa nhận đủ tiền cọc." }]);
  });
  it("BR-02: đơn công nợ giữ vì CREDIT chờ duyệt — không đoán nợ quá hạn", () => {
    const [blocker] = releaseBlockers({
      status: "On Hold",
      paymentTerm: "CREDIT",
      depositReceivedAt: null,
      holdReason: "CREDIT",
    });
    expect(blocker?.rule).toBe("BR-02");
    expect(blocker?.message).not.toMatch(/quá hạn/i);
  });
  it("đơn CREDIT giữ vì lý do khác (ADDRESS) → không bị nói là chưa duyệt công nợ", () => {
    expect(
      releaseBlockers({
        status: "On Hold",
        paymentTerm: "CREDIT",
        depositReceivedAt: null,
        holdReason: "ADDRESS",
      }),
    ).toEqual([]);
  });
  it("đơn Confirmed → không có lý do biết trước (BR-PRD-08 do BE kiểm)", () => {
    expect(
      releaseBlockers({
        status: "Confirmed",
        paymentTerm: "DEPOSIT",
        depositReceivedAt: "x",
        holdReason: null,
      }),
    ).toEqual([]);
  });
});

describe("dòng đơn & lệnh sản xuất", () => {
  const line = {
    lineId: "L1",
    sku: "A",
    quantity: 1,
    unitPrice: 1,
    lineTotal: 1,
    reservationIds: [],
    shippedQuantity: null,
    deliveredQuantity: null,
    cancelledQuantity: null,
  };
  it("customLineCount đếm dòng in", () => {
    expect(
      customLineCount({
        lines: [
          { ...line, isCustom: true, designSnapshotId: "d" },
          { ...line, lineId: "L2", isCustom: false, designSnapshotId: null },
        ],
      }),
    ).toBe(1);
  });

  it("groupProductionOrdersByLine tách LSX gốc / con theo dòng (docs 19 BR-01, BR-12)", () => {
    const base: ProductionOrder = {
      productionOrderId: "P1",
      productionOrderNumber: "LSX-1",
      salesOrderLineId: "L1",
      parentId: null,
      mode: "IN_HOUSE",
      status: "PRINTING",
      holdReason: null,
      plannedQuantity: 10,
      goodQuantity: 0,
      dueDate: null,
    };
    const grouped = groupProductionOrdersByLine([
      base,
      { ...base, productionOrderId: "P1-S1", parentId: "P1", mode: "SUBCONTRACTED" },
      { ...base, productionOrderId: "P2", salesOrderLineId: "L2" },
    ]);
    expect(grouped.get("L1")?.parents.map((p) => p.productionOrderId)).toEqual(["P1"]);
    expect(grouped.get("L1")?.children.map((p) => p.productionOrderId)).toEqual(["P1-S1"]);
    expect(grouped.get("L2")?.parents).toHaveLength(1);
  });

  it("shouldFlagOrderRow — On Hold và Delivery Failed (ngoại lệ chờ nhân viên quyết)", () => {
    expect(shouldFlagOrderRow({ status: "On Hold" })).toBe(true);
    expect(shouldFlagOrderRow({ status: "Delivery Failed" })).toBe(true);
    expect(shouldFlagOrderRow({ status: "In Production" })).toBe(false);
  });
});

describe("cancelConsequence — hệ quả huỷ theo trạng thái (19 trạng thái, BE PR #133)", () => {
  it("In Production → hệ quả với lệnh sản xuất theo BE, KHÔNG hứa phí huỷ (form không gửi phí)", () => {
    const text = cancelConsequence("In Production") ?? "";
    expect(text).toMatch(/lệnh sản xuất chưa in sẽ được huỷ/);
    expect(text).toMatch(/đang in hoặc gia công ngoài sẽ được treo/);
    expect(text).toMatch(/không áp dụng phí huỷ/);
    expect(text).not.toMatch(/tính phí|BR-10|hoàn đủ|đã hoàn/);
  });
  it("Ready to Fulfill → đã release, chưa lấy hàng: nhả giữ chỗ, KHÔNG nói put-back", () => {
    const text = cancelConsequence("Ready to Fulfill");
    expect(text).toContain("BR-03");
    expect(text).toContain("chưa lấy hàng");
    expect(text).not.toContain("put-back");
  });
  it("Picking → dừng lấy hàng + put-back (docs 17 BR-03)", () => {
    expect(cancelConsequence("Picking")).toContain("put-back");
  });
  it("Packed / Partially Fulfilled trở đi (BE không cho huỷ) → không có câu nào gợi ý huỷ được", () => {
    for (const status of ["Packed", "Partially Fulfilled", "Shipped", "Delivered"] as const) {
      expect(cancelConsequence(status)).toBeNull();
    }
  });
  it("On Hold → theo trạng thái đã bị giữ; không biết thì không cảnh báo thêm", () => {
    expect(cancelConsequence("On Hold", "Picking")).toContain("put-back");
    expect(cancelConsequence("On Hold", "In Production")).toBe(cancelConsequence("In Production"));
    expect(cancelConsequence("On Hold", null)).toBeNull();
    expect(cancelConsequence("On Hold")).toBeNull();
  });
  it("chưa giao kho / sản xuất, UNKNOWN → không có cảnh báo thêm", () => {
    expect(cancelConsequence("Pending Payment")).toBeNull();
    expect(cancelConsequence("UNKNOWN")).toBeNull();
  });
});

describe("availableRefusalActions — theo allowedTerms HIỆN TẠI (docs 14 BR-05)", () => {
  it("huỷ luôn được; chuyển trả trước / đặt cọc chỉ khi BE cho phép", () => {
    expect(availableRefusalActions(["PREPAID", "DEPOSIT", "CREDIT"])).toEqual([
      "CANCEL",
      "SWITCH_TO_PREPAID",
      "SWITCH_TO_DEPOSIT",
    ]);
    expect(availableRefusalActions(["PREPAID", "CREDIT"])).toEqual(["CANCEL", "SWITCH_TO_PREPAID"]);
    expect(availableRefusalActions(["CREDIT"])).toEqual(["CANCEL"]);
    expect(availableRefusalActions([])).toEqual(["CANCEL"]);
  });
  it("chưa có credit position (đang tải / lỗi / thiếu quyền) → chỉ huỷ, không đoán", () => {
    expect(availableRefusalActions(null)).toEqual(["CANCEL"]);
  });
});

describe('lý do huỷ — cột BE "CODE" / "CODE: ghi chú" (Order#cancel, CancelOrderCommand.fromText)', () => {
  it("mã đã biết + ghi chú → nhãn — ghi chú", () => {
    expect(parseCancellationReason("CUSTOMER_REQUEST: khách đổi ý")).toEqual({
      code: "CUSTOMER_REQUEST",
      note: "khách đổi ý",
    });
    expect(formatCancellationReason("CUSTOMER_REQUEST: khách đổi ý")).toBe(
      "Khách yêu cầu — khách đổi ý",
    );
  });

  it("chỉ mã (không ghi chú) → chỉ nhãn, không dấu thừa", () => {
    expect(formatCancellationReason("OUT_OF_STOCK")).toBe("Hết hàng, không thể giao");
    expect(formatCancellationReason("OUT_OF_STOCK:   ")).toBe("Hết hàng, không thể giao");
  });

  it("mã lạ: tách được khi có mã có cấu trúc; không có thì giữ nguyên chuỗi, không lỗi", () => {
    expect(parseCancellationReason("FRAUD_REVIEW: x", "FRAUD_REVIEW")).toEqual({
      code: "FRAUD_REVIEW",
      note: "x",
    });
    expect(formatCancellationReason("FRAUD_REVIEW: x")).toBe("FRAUD_REVIEW: x");
  });

  it("lý do tự do kiểu cũ / rỗng", () => {
    expect(formatCancellationReason("Khách gọi điện huỷ")).toBe("Khách gọi điện huỷ");
    expect(formatCancellationReason(null)).toBeNull();
    expect(formatCancellationReason("  ")).toBeNull();
  });
});

describe("retainedAmountPreview — như BE Order#cancel (làm tròn theo số lẻ của tiền tệ)", () => {
  it("VND: 0%, số nguyên, thập phân 30,5%, số lớn — luôn ra đồng nguyên", () => {
    expect(retainedAmountPreview(200_000, 0, "VND")).toBe(0);
    expect(retainedAmountPreview(200_000, 25, "VND")).toBe(50_000);
    expect(retainedAmountPreview(333_333, 30.5, "VND")).toBe(101_667);
    expect(retainedAmountPreview(9_876_543_210, 12.75, "VND")).toBe(1_259_259_259);
  });

  it("USD giữ xu (cách cũ làm tròn về đô la nguyên), không lộ sai số số thực", () => {
    expect(retainedAmountPreview(100.1, 33.3, "USD")).toBe(33.33);
    expect(retainedAmountPreview(0.3, 10, "USD")).toBe(0.03);
  });
});
