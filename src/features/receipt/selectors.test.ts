import { describe, expect, it } from "vitest";

import {
  SOFA_PO_LINE_ID,
  TABLE_PO_LINE_ID,
  apiLine,
  apiReceipt,
  receivablePo,
} from "./__fixtures__/receipt";
import {
  countedByPoLine,
  initialCountLines,
  inspectionTotals,
  lineQualityStatuses,
  pendingQcLineCount,
  poLinesOverOpenQuantity,
  receiptReceivedOn,
  receivableLimit,
} from "./selectors";

describe("receipt selectors", () => {
  it("BR-02: giới hạn = SL đặt × (1 + dung sai), làm tròn xuống như BE", () => {
    expect(receivableLimit(10, 5)).toBe(10);
    expect(receivableLimit(20, 5)).toBe(21);
    expect(receivableLimit(6, 0)).toBe(6);
  });

  it("gom SL theo dòng PO khi một dòng tách nhiều lô", () => {
    expect(
      countedByPoLine([
        { purchaseOrderLineId: TABLE_PO_LINE_ID, quantity: 4 },
        { purchaseOrderLineId: TABLE_PO_LINE_ID, quantity: 2 },
        { purchaseOrderLineId: SOFA_PO_LINE_ID, quantity: 10 },
      ]),
    ).toEqual({ [TABLE_PO_LINE_ID]: 6, [SOFA_PO_LINE_ID]: 10 });
  });

  it("cảnh báo dòng PO đếm vượt SL còn mở", () => {
    const over = poLinesOverOpenQuantity(receivablePo.lines, [
      { purchaseOrderLineId: TABLE_PO_LINE_ID, quantity: 7 },
      { purchaseOrderLineId: SOFA_PO_LINE_ID, quantity: 10 },
    ]);
    expect(over).toEqual([TABLE_PO_LINE_ID]);
  });

  it("ngày nhận lấy theo giờ VN (06:30 ngày 09/10, không phải 08/10 UTC)", () => {
    expect(receiptReceivedOn(apiReceipt())).toBe("2026-10-09");
  });

  it("form kiểm đếm: phiếu mới gợi ý dòng PO còn mở; phiếu đã lưu giữ dòng đã lưu", () => {
    const suggested = initialCountLines(apiReceipt(), receivablePo);
    expect(suggested.map((l) => [l.purchaseOrderLineId, l.quantity])).toEqual([
      [SOFA_PO_LINE_ID, 10],
      [TABLE_PO_LINE_ID, 6],
    ]);
    const saved = initialCountLines(
      apiReceipt({ lines: [apiLine({ quantity: 3 })] }),
      receivablePo,
    );
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      quantity: 3,
      lotNumber: "LOT-2026-10",
      locationCode: "HCM-RCV01",
    });
  });

  it("trạng thái chất lượng dòng theo nguyên văn docs 03 §5.2", () => {
    expect(lineQualityStatuses(apiLine({ qcProgress: "NOT_REQUIRED" }))).toEqual(["Not Required"]);
    expect(lineQualityStatuses(apiLine({ qcProgress: "IN_QC_AREA" }))).toEqual(["Pending"]);
    const inspected = apiLine({
      qcProgress: "INSPECTED",
      inspections: [
        {
          id: "i1",
          outcome: "ACCEPTED",
          quantity: 4,
          locationCode: null,
          reason: null,
          inspectedBy: "u",
          inspectedAt: "2026-10-09T03:00:00Z",
        },
        {
          id: "i2",
          outcome: "REJECTED",
          quantity: 2,
          locationCode: "HCM-RTV01",
          reason: "Nứt",
          inspectedBy: "u",
          inspectedAt: "2026-10-09T03:00:00Z",
        },
      ],
    });
    expect(lineQualityStatuses(inspected)).toEqual(["Accepted", "Rejected"]);
    expect(inspectionTotals(inspected)).toEqual({ accepted: 4, quarantined: 0, rejected: 2 });
  });

  it("đếm dòng còn chờ QC — chỉ khi phiếu đang In QC", () => {
    const { lines } = apiReceipt({
      lines: [
        apiLine(),
        apiLine({ qcProgress: "IN_QC_AREA" }),
        apiLine({ qcProgress: "NOT_REQUIRED" }),
      ],
    });
    expect(pendingQcLineCount({ status: "In QC", lines })).toBe(2);
    // BE vẫn trả AWAITING_MOVE_TO_QC cho dòng cần QC của phiếu nháp / đã huỷ
    expect(pendingQcLineCount({ status: "Draft", lines })).toBe(0);
    expect(pendingQcLineCount({ status: "Cancelled", lines })).toBe(0);
  });
});
