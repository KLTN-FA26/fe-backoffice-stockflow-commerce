import { describe, expect, it } from "vitest";

import {
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
  it("đơn CREDIT On Hold = đang chờ duyệt vượt hạn mức", () => {
    expect(creditState({ paymentTerm: "CREDIT", status: "On Hold" })).toBe("on-hold");
    expect(creditState({ paymentTerm: "CREDIT", status: "Confirmed" })).toBe("within-limit");
    expect(creditState({ paymentTerm: "DEPOSIT", status: "On Hold" })).toBe("not-applicable");
  });
  it("phần vượt = dư nợ + giá trị đơn − hạn mức, không âm", () => {
    expect(creditOverage({ creditLimit: 100, exposure: 60, orderAmount: 70 })).toBe(30);
    expect(creditOverage({ creditLimit: 100, exposure: 10, orderAmount: 20 })).toBe(0);
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
  it("BR-02: đơn công nợ On Hold chờ duyệt", () => {
    expect(
      releaseBlockers({ status: "On Hold", paymentTerm: "CREDIT", depositReceivedAt: null })[0]
        ?.rule,
    ).toBe("BR-02");
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
