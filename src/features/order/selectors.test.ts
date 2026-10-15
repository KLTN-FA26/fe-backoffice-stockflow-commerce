import { describe, expect, it } from "vitest";

import {
  cancelConsequence,
  creditHoldReason,
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
  it("đơn CREDIT On Hold = đang tạm giữ (chỉ trạng thái, không phải nguyên nhân)", () => {
    expect(creditState({ paymentTerm: "CREDIT", status: "On Hold" })).toBe("on-hold");
    expect(creditState({ paymentTerm: "CREDIT", status: "Confirmed" })).toBe("within-limit");
    expect(creditState({ paymentTerm: "DEPOSIT", status: "On Hold" })).toBe("not-applicable");
  });
  it("phần vượt = dư nợ + giá trị đơn − hạn mức, không âm", () => {
    expect(creditOverage({ creditLimit: 100, exposure: 60, orderAmount: 70 })).toBe(30);
    expect(creditOverage({ creditLimit: 100, exposure: 10, orderAmount: 20 })).toBe(0);
  });
});

describe("creditHoldReason — chỉ nêu nguyên nhân số liệu BE chứng minh được", () => {
  const order = { currency: "VND" };
  const hold = (creditLimit: number, exposure: number, orderAmount: number, currency = "VND") => ({
    creditLimit,
    exposure,
    orderAmount,
    order: { ...order, currency },
  });

  it("A. vượt > 0 → over-limit kèm đúng số vượt", () => {
    expect(creditHoldReason(hold(1_000_000, 800_000, 350_000))).toEqual({
      kind: "over-limit",
      excess: 150_000,
    });
  });

  it("B. vượt = 0 (BE submitOnCredit chỉ giữ khi OVERDUE hoặc OVER_LIMIT) → overdue", () => {
    expect(creditHoldReason(hold(1_000_000, 200_000, 350_000))).toEqual({ kind: "overdue" });
    // Đúng bằng hạn mức: BE coi là trong hạn mức (≤) → đang giữ thì chỉ có thể vì nợ quá hạn
    expect(creditHoldReason(hold(1_000_000, 650_000, 350_000))).toEqual({ kind: "overdue" });
  });

  it("sai số số thực dưới đơn vị nhỏ nhất của tiền tệ không thành 'vượt 0,00'", () => {
    // 100.1 + 0.2 − 100.3 ≈ 5.7e-14 trên số thực
    expect(creditHoldReason(hold(100.3, 100.1, 0.2, "USD"))).toEqual({ kind: "overdue" });
    expect(creditHoldReason(hold(100, 100, 0.01, "USD"))).toEqual({
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
      }),
    ).toEqual([{ rule: "BR-PRD-09", message: "Đơn đặt cọc chưa nhận đủ tiền cọc." }]);
  });
  it("BR-02: đơn công nợ On Hold chờ duyệt — không đoán nguyên nhân giữ", () => {
    const [blocker] = releaseBlockers({
      status: "On Hold",
      paymentTerm: "CREDIT",
      depositReceivedAt: null,
    });
    expect(blocker?.rule).toBe("BR-02");
    expect(blocker?.message).not.toMatch(/vượt hạn mức|quá hạn/i);
  });
  it("đơn Confirmed → không có lý do biết trước (BR-PRD-08 do BE kiểm)", () => {
    expect(
      releaseBlockers({ status: "Confirmed", paymentTerm: "DEPOSIT", depositReceivedAt: "x" }),
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
      statusBeforeHold: null,
      holdReason: null,
      plannedQuantity: 10,
      goodQuantity: 0,
      dueDate: null,
      subcontractorName: null,
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

  it("shouldFlagOrderRow — chỉ On Hold", () => {
    expect(shouldFlagOrderRow({ status: "On Hold" })).toBe(true);
    expect(shouldFlagOrderRow({ status: "In Production" })).toBe(false);
  });
});

describe("cancelConsequence — hệ quả huỷ theo trạng thái", () => {
  it("In Production → nhắc phí sản xuất (docs 19 BR-10)", () => {
    expect(cancelConsequence("In Production")).toContain("BR-10");
  });
  it("đã giao kho → dừng pick + put-back (docs 17 BR-03)", () => {
    expect(cancelConsequence("Ready to Fulfill")).toContain("BR-03");
    expect(cancelConsequence("In Fulfilment")).toContain("put-back");
  });
  it("chưa giao kho / sản xuất → không có cảnh báo thêm", () => {
    expect(cancelConsequence("Pending Payment")).toBeNull();
  });
});
