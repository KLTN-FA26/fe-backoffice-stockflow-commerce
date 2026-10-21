import { describe, expect, it } from "vitest";

import { apiTransfer } from "./__fixtures__/transfer";
import {
  defaultDispatchLines,
  isPartialDispatch,
  totalRequested,
  totalShipped,
  toTransferFormValues,
} from "./selectors";

describe("transfer selectors", () => {
  it("tổng SL yêu cầu / đã xuất", () => {
    const transfer = apiTransfer({
      lines: [
        { lineId: "a", lineNo: 1, sku: "A-1", lotNumber: null, requested: 10, shipped: 10 },
        { lineId: "b", lineNo: 2, sku: "B-1", lotNumber: null, requested: 5, shipped: 2 },
      ],
    });
    expect(totalRequested(transfer)).toBe(15);
    expect(totalShipped(transfer)).toBe(12);
  });

  it("xuất thiếu chỉ tính khi đã xuất kho", () => {
    const lines = [
      { lineId: "a", lineNo: 1, sku: "A-1", lotNumber: null, requested: 10, shipped: 4 },
    ];
    expect(isPartialDispatch(apiTransfer({ lines }))).toBe(false);
    expect(isPartialDispatch(apiTransfer({ lines, dispatchedAt: "2026-10-12T03:00:00Z" }))).toBe(
      true,
    );
  });

  it("form xuất kho mặc định = xuất đủ", () => {
    expect(defaultDispatchLines(apiTransfer())).toEqual([
      { lineId: "l-1", shippedQuantity: 40 },
      { lineId: "l-2", shippedQuantity: 20 },
    ]);
  });

  it("lệnh BE → giá trị form sửa nháp (null → chuỗi rỗng)", () => {
    const values = toTransferFormValues(apiTransfer({ reason: null, expectedDate: null }));
    expect(values.reason).toBe("");
    expect(values.lines[1]).toEqual({ sku: "TSHIRT-WHT-L", lotNumber: "", quantity: 20 });
  });
});
