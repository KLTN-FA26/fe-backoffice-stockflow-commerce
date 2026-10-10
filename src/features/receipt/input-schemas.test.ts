import { describe, expect, it } from "vitest";

import { RECEIPT_FIELD_MESSAGES as MSG } from "@/constants";

import { SOFA_PO_LINE_ID, TABLE_PO_LINE_ID } from "./__fixtures__/receipt";
import {
  buildQcDecisionSchema,
  buildReceiptLinesSchema,
  receiptCreateInputSchema,
} from "./input-schemas";

const line = (overrides: Record<string, unknown> = {}) => ({
  purchaseOrderLineId: TABLE_PO_LINE_ID,
  quantity: 6,
  lotNumber: "LOT-1",
  expiryDate: "2027-10-01",
  locationCode: " hcm-rcv01 ",
  note: "",
  ...overrides,
});

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("receiptLinesSchema (docs 03 §6)", () => {
  const schema = buildReceiptLinesSchema({ receivedOn: "2026-10-09" });

  it("hợp lệ: mã vị trí được trim + viết hoa như BE", () => {
    const parsed = schema.parse({ lines: [line()] });
    expect(parsed.lines[0]?.locationCode).toBe("HCM-RCV01");
  });

  it("cần ít nhất một dòng; SL phải là số nguyên > 0; mã vị trí bắt buộc", () => {
    expect(messages(schema.safeParse({ lines: [] }))).toContain(MSG.linesRequired);
    expect(messages(schema.safeParse({ lines: [line({ quantity: 0 })] }))).toContain(MSG.quantity);
    expect(messages(schema.safeParse({ lines: [line({ quantity: 1.5 })] }))).toContain(
      MSG.quantity,
    );
    expect(messages(schema.safeParse({ lines: [line({ locationCode: "  " })] }))).toContain(
      MSG.locationRequired,
    );
  });

  it("BR-06: hạn dùng phải sau ngày nhận", () => {
    expect(messages(schema.safeParse({ lines: [line({ expiryDate: "2026-10-09" })] }))).toContain(
      MSG.expiryNotAfterReceipt,
    );
    expect(schema.safeParse({ lines: [line({ expiryDate: "2026-10-10" })] }).success).toBe(true);
  });

  it("BR-03: SKU theo dõi lô / hạn dùng thì bắt buộc nhập", () => {
    const tracked = buildReceiptLinesSchema({
      receivedOn: "2026-10-09",
      trackingByPoLine: { [TABLE_PO_LINE_ID]: { lotTracked: true, expiryTracked: true } },
    });
    const result = tracked.safeParse({ lines: [line({ lotNumber: "", expiryDate: "" })] });
    expect(messages(result)).toEqual(expect.arrayContaining([MSG.lotRequired, MSG.expiryRequired]));
    // SKU chưa biết cách theo dõi → không ép ở FE (BE chặn bằng RECEIPT_LOT_DATA_INVALID)
    expect(schema.safeParse({ lines: [line({ lotNumber: "", expiryDate: "" })] }).success).toBe(
      true,
    );
  });

  it("BR-02: tổng các lô của một dòng PO không vượt giới hạn", () => {
    const limited = buildReceiptLinesSchema({
      receivedOn: "2026-10-09",
      limitByPoLine: { [TABLE_PO_LINE_ID]: 6 },
    });
    const split = [line({ quantity: 4, lotNumber: "A" }), line({ quantity: 3, lotNumber: "B" })];
    expect(messages(limited.safeParse({ lines: split }))).toContain(MSG.overLimit);
    const ok = [
      line({ quantity: 4, lotNumber: "A" }),
      line({ quantity: 2, lotNumber: "B" }),
      line({ purchaseOrderLineId: SOFA_PO_LINE_ID, quantity: 99 }),
    ];
    expect(limited.safeParse({ lines: ok }).success).toBe(true);
  });

  it("BE requireDistinctLines: một dòng PO không được có hai dòng cùng số lô", () => {
    const same = [line({ quantity: 4, lotNumber: "A" }), line({ quantity: 2, lotNumber: "A" })];
    expect(messages(schema.safeParse({ lines: same }))).toContain(MSG.duplicateLot);
    // SKU không theo lô: hai dòng không lô của cùng dòng PO cũng bị BE coi là trùng
    const noLot = [line({ lotNumber: "", quantity: 1 }), line({ lotNumber: "", quantity: 1 })];
    expect(messages(schema.safeParse({ lines: noLot }))).toContain(MSG.duplicateLot);
  });
});

describe("receiptCreateInputSchema — BR-01", () => {
  it("phải chọn PO", () => {
    expect(messages(receiptCreateInputSchema.safeParse({ purchaseOrderId: "" }))).toContain(
      MSG.purchaseOrderRequired,
    );
  });
});

describe("qcDecisionSchema — BR-08", () => {
  const schema = buildQcDecisionSchema(6);
  const empty = { quantity: 0, locationCode: "", reason: "" };

  it("tổng ba phần phải bằng SL đã chuyển sang khu QC", () => {
    expect(schema.safeParse({ accepted: 6, quarantined: empty, rejected: empty }).success).toBe(
      true,
    );
    expect(
      messages(schema.safeParse({ accepted: 5, quarantined: empty, rejected: empty })),
    ).toContain(MSG.qcSum);
  });

  it("phần cách ly / không đạt bắt buộc có vị trí và lý do", () => {
    const result = schema.safeParse({
      accepted: 4,
      quarantined: empty,
      rejected: { quantity: 2, locationCode: "", reason: "" },
    });
    expect(messages(result)).toEqual(
      expect.arrayContaining([MSG.qcLocationRequired, MSG.qcReasonRequired]),
    );
  });

  it("cách ly và không đạt không được chung một vị trí", () => {
    const result = schema.safeParse({
      accepted: 2,
      quarantined: { quantity: 2, locationCode: "HCM-QC01", reason: "Nghi trầy" },
      rejected: { quantity: 2, locationCode: "hcm-qc01", reason: "Nứt" },
    });
    expect(messages(result)).toContain(MSG.qcSameLocation);
  });
});
