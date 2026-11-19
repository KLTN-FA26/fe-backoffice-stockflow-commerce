import { describe, expect, it } from "vitest";

import {
  PRODUCTION_ORDER_ID,
  apiLine,
  apiPurchaseReceipt,
  apiReceipt,
} from "./__fixtures__/receipt";
import {
  isLegacyPurchaseReceipt,
  productionOrderCodeOf,
  receiptReceivedOn,
  totalReceivedQuantity,
} from "./selectors";

describe("receipt selectors", () => {
  it("ngày nhận lấy theo giờ VN (06:30 ngày 09/10, không phải 08/10 UTC)", () => {
    expect(receiptReceivedOn(apiReceipt())).toBe("2026-10-09");
  });

  it("tổng SL nhận cộng mọi dòng", () => {
    const receipt = apiReceipt({ lines: [apiLine({ quantity: 100 }), apiLine({ quantity: 50 })] });
    expect(totalReceivedQuantity(receipt)).toBe(150);
    expect(totalReceivedQuantity(apiReceipt())).toBe(0);
  });

  it("BE 4A-8: chỉ phiếu PURCHASE là phiếu mua hàng cũ", () => {
    expect(isLegacyPurchaseReceipt(apiPurchaseReceipt())).toBe(true);
    expect(isLegacyPurchaseReceipt(apiReceipt())).toBe(false);
    expect(isLegacyPurchaseReceipt(apiReceipt({ receiptType: "RETURN" }))).toBe(false);
  });

  it("mã Đơn sản xuất của bộ lọc lấy từ dòng khớp id; không có dòng khớp → null", () => {
    const rows = [apiPurchaseReceipt(), apiReceipt()];
    expect(productionOrderCodeOf(rows, PRODUCTION_ORDER_ID)).toBe("PO-HCM-0007");
    expect(productionOrderCodeOf([apiPurchaseReceipt()], PRODUCTION_ORDER_ID)).toBeNull();
    expect(productionOrderCodeOf(rows, "")).toBeNull();
  });
});
