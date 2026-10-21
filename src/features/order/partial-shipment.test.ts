import { describe, expect, it } from "vitest";

import { ORDER_PERMISSIONS } from "@/constants";

import { isAwaitingProduction, partialShipmentControl } from "./partial-shipment";

import type { PermissionCode } from "@/lib/auth";
import type { OrderStatus } from "./types";

/** SALES_STAFF (và SYSTEM_ADMIN) có mã quyền; điều phối viên / kho thì không — theo seed BE PR #150. */
const SALES: readonly PermissionCode[] = [ORDER_PERMISSIONS.partialShipment];
const checkerFor =
  (role: "SALES_STAFF" | "ORDER_COORDINATOR" | "WAREHOUSE_STAFF") => (code: PermissionCode) =>
    role === "SALES_STAFF" && SALES.includes(code);

describe("partialShipmentControl — Giao một phần (sales-order-partial-shipments:UPDATE)", () => {
  const order = (
    status: OrderStatus,
    allowPartialShipment: boolean | null,
    printLinesReady: boolean | null = true,
    statusBeforeHold: OrderStatus | null = null,
  ) => ({ status, statusBeforeHold, allowPartialShipment, printLinesReady });

  it("BE không trả cờ (dòng danh sách) → null, không đoán", () => {
    expect(partialShipmentControl(order("Picking", null), checkerFor("SALES_STAFF"))).toBeNull();
  });

  it("SALES_STAFF (có mã quyền) đổi được; nút đặt giá trị ngược với cờ hiện tại", () => {
    expect(partialShipmentControl(order("Picking", false), checkerFor("SALES_STAFF"))).toEqual({
      allowed: false,
      next: true,
      canChange: true,
      lock: null,
    });
    expect(partialShipmentControl(order("Picking", true), checkerFor("SALES_STAFF"))).toMatchObject(
      {
        allowed: true,
        next: false,
        canChange: true,
      },
    );
  });

  it("gate theo MÃ quyền: điều phối viên / kho không có mã → thấy trạng thái nhưng không đổi được", () => {
    expect(
      partialShipmentControl(order("Picking", false), checkerFor("ORDER_COORDINATOR")),
    ).toMatchObject({ allowed: false, canChange: false, lock: null });
    expect(
      partialShipmentControl(order("Picking", true), checkerFor("WAREHOUSE_STAFF")),
    ).toMatchObject({ canChange: false });
  });

  it.each([
    "Draft",
    "Pending Payment",
    "Confirmed",
    "In Production",
    "Ready to Fulfill",
    "Picking",
    "Partially Fulfilled",
    "Packed",
    "On Hold",
  ] as const)("%s → còn đổi được (BE Order#decidePartialShipment)", (status) => {
    expect(partialShipmentControl(order(status, false), checkerFor("SALES_STAFF"))).toMatchObject({
      canChange: true,
      lock: null,
    });
  });

  it.each([
    "Shipped",
    "Delivery Failed",
    "Delivered",
    "Return Requested",
    "Returned",
    "Refunded",
    "Partially Refunded",
    "Completed",
    "Cancelled",
    "Closed",
  ] as const)("%s → khoá (BE 409 ORDER_PARTIAL_SHIPMENT_LOCKED)", (status) => {
    expect(partialShipmentControl(order(status, true), checkerFor("SALES_STAFF"))).toMatchObject({
      canChange: false,
      lock: "closed",
    });
  });

  it("PARTIALLY_FULFILLED đang chờ hàng in (printLinesReady=false) → không dừng được; hàng in đã xong thì dừng được", () => {
    expect(
      partialShipmentControl(order("Partially Fulfilled", true, false), checkerFor("SALES_STAFF")),
    ).toMatchObject({ canChange: false, lock: "awaiting-prints" });
    expect(
      partialShipmentControl(order("Partially Fulfilled", true, true), checkerFor("SALES_STAFF")),
    ).toMatchObject({ canChange: true, lock: null });
  });

  it("ON_HOLD giữ từ PARTIALLY_FULFILLED mà vẫn chờ hàng in → vẫn khoá (BE awaitingProduction tồn tại suốt lúc giữ)", () => {
    expect(
      partialShipmentControl(
        order("On Hold", true, false, "Partially Fulfilled"),
        checkerFor("SALES_STAFF"),
      ),
    ).toMatchObject({ canChange: false, lock: "awaiting-prints" });
  });

  it("IN_PRODUCTION chưa giao lô nào (printLinesReady=false vì còn đang in) → vẫn dừng được", () => {
    expect(
      partialShipmentControl(order("In Production", true, false), checkerFor("SALES_STAFF")),
    ).toMatchObject({ canChange: true, lock: null, next: false });
  });

  it("ON_HOLD giữ từ IN_PRODUCTION (chưa lô nào đi) → vẫn dừng được; giữ từ trạng thái đã xong hàng in → dừng được", () => {
    expect(
      partialShipmentControl(
        order("On Hold", true, false, "In Production"),
        checkerFor("SALES_STAFF"),
      ),
    ).toMatchObject({ canChange: true, lock: null });
    expect(
      partialShipmentControl(
        order("On Hold", true, true, "Ready to Fulfill"),
        checkerFor("SALES_STAFF"),
      ),
    ).toMatchObject({ canChange: true, lock: null });
  });

  it("đang tắt thì không bao giờ có khoá 'awaiting-prints' (BE chỉ chặn việc tắt)", () => {
    expect(
      partialShipmentControl(order("Partially Fulfilled", false, false), checkerFor("SALES_STAFF")),
    ).toMatchObject({ canChange: true, lock: null, next: true });
  });

  it("trạng thái chưa hỗ trợ → chỉ hiện cờ, không cho đổi, không bảo 'đã đóng'", () => {
    expect(partialShipmentControl(order("UNKNOWN", true), checkerFor("SALES_STAFF"))).toEqual({
      allowed: true,
      next: false,
      canChange: false,
      lock: null,
    });
  });
});

describe("isAwaitingProduction — suy từ printLinesReady đúng Order#printLinesReady", () => {
  const base = { statusBeforeHold: null } as const;
  it("chỉ true khi printLinesReady=false và đơn không còn 'đang in'", () => {
    expect(
      isAwaitingProduction({ ...base, status: "Partially Fulfilled", printLinesReady: false }),
    ).toBe(true);
    expect(isAwaitingProduction({ ...base, status: "Packed", printLinesReady: false })).toBe(true);
    expect(isAwaitingProduction({ ...base, status: "In Production", printLinesReady: false })).toBe(
      false,
    );
    expect(
      isAwaitingProduction({
        status: "On Hold",
        statusBeforeHold: "In Production",
        printLinesReady: false,
      }),
    ).toBe(false);
    expect(
      isAwaitingProduction({
        status: "On Hold",
        statusBeforeHold: "Partially Fulfilled",
        printLinesReady: false,
      }),
    ).toBe(true);
  });

  it("printLinesReady true / null (BE không trả) → không đoán là đang chờ", () => {
    expect(
      isAwaitingProduction({ ...base, status: "Partially Fulfilled", printLinesReady: true }),
    ).toBe(false);
    expect(
      isAwaitingProduction({ ...base, status: "Partially Fulfilled", printLinesReady: null }),
    ).toBe(false);
  });
});
