/**
 * Kho xuất của đơn — luật gating (docs 17 §4.2 bước 2-3, BR-22; BE `Order#chooseShippingWarehouse`): chỉ đơn Đã xác nhận /
 * Đang chờ hàng; Sale (UPDATE) chọn được, quản lý kho (READ) chỉ xem, người không có mã nào không thấy gì.
 */
import { describe, expect, it } from "vitest";

import { ORDER_STATUSES } from "@/constants";

import {
  SHIPPING_WAREHOUSE_STATUSES,
  cartonTotals,
  holdOutcome,
  isWarehouseLocked,
  shippingWarehouseControl,
} from "./shipping-warehouse-rules";
import { shippingCoverageSchema } from "./shipping-warehouse-schemas";

import { apiCoverage, SHIPPING_PERMISSION_SETS } from "./__fixtures__/shipping-warehouse";

import type { PermissionCode } from "@/lib/auth";

const canOf = (codes: readonly PermissionCode[]) => (code: PermissionCode) => codes.includes(code);
const coverage = (...args: Parameters<typeof apiCoverage>) =>
  shippingCoverageSchema.parse(apiCoverage(...args));

describe("shippingWarehouseControl — trạng thái đơn × mã quyền", () => {
  it("Sale (READ + UPDATE) chọn được ở Đã xác nhận và Đang chờ hàng", () => {
    for (const status of ["Confirmed", "Awaiting Stock"] as const) {
      expect(shippingWarehouseControl({ status }, canOf(SHIPPING_PERMISSION_SETS.sale))).toEqual({
        canRead: true,
        canChoose: true,
      });
    }
  });

  it("quản lý kho (chỉ READ) thấy thẻ nhưng không chọn được", () => {
    expect(
      shippingWarehouseControl(
        { status: "Confirmed" },
        canOf(SHIPPING_PERMISSION_SETS.warehouseManager),
      ),
    ).toEqual({ canRead: true, canChoose: false });
  });

  it("chỉ có UPDATE (không READ) vẫn thấy thẻ để chọn", () => {
    const control = shippingWarehouseControl(
      { status: "Confirmed" },
      canOf(["sales-order-shipping-warehouses:UPDATE"]),
    );
    expect(control).toEqual({ canRead: true, canChoose: true });
  });

  it("không có mã kho xuất nào → không có thẻ", () => {
    expect(
      shippingWarehouseControl(
        { status: "Confirmed" },
        canOf(SHIPPING_PERMISSION_SETS.noShippingCodes),
      ),
    ).toBeNull();
  });

  it("mọi trạng thái khác (kể cả đã release, đang giữ, kết thúc) → không có thẻ, dù có đủ quyền", () => {
    const others = ORDER_STATUSES.filter((status) => !SHIPPING_WAREHOUSE_STATUSES.includes(status));
    expect(others.length).toBeGreaterThan(10);
    for (const status of others) {
      expect(shippingWarehouseControl({ status }, canOf(SHIPPING_PERMISSION_SETS.sale))).toBeNull();
    }
  });
});

describe("holdOutcome — kết quả giữ hàng sau khi chọn kho (17 §4.2 bước 3)", () => {
  it("đủ thùng → full; giữ k < N → partial; chưa giữ được thùng nào → none", () => {
    expect(
      holdOutcome(
        coverage([
          [8, 8],
          [4, 4],
        ]),
      ),
    ).toBe("full");
    expect(
      holdOutcome(
        coverage([
          [8, 8],
          [3, 4],
        ]),
      ),
    ).toBe("partial");
    expect(
      holdOutcome(
        coverage([
          [0, 8],
          [0, 4],
        ]),
      ),
    ).toBe("none");
  });

  it("cartonTotals cộng thùng cần / đã giữ / còn thiếu của mọi dòng", () => {
    expect(
      cartonTotals(
        coverage([
          [8, 8],
          [3, 4],
        ]).lines,
      ),
    ).toEqual({ cartons: 12, held: 11, short: 1 });
  });
});

describe("isWarehouseLocked — đã giữ hàng thì không đổi kho (BR-22)", () => {
  it("có kho + có thùng đã giữ → khoá; có kho nhưng chưa giữ gì → đổi được; chưa chọn / chưa biết → không khoá", () => {
    expect(
      isWarehouseLocked(
        coverage([
          [1, 8],
          [0, 4],
        ]),
      ),
    ).toBe(true);
    expect(
      isWarehouseLocked(
        coverage([
          [0, 8],
          [0, 4],
        ]),
      ),
    ).toBe(false);
    expect(
      isWarehouseLocked(
        coverage(
          [
            [0, 8],
            [0, 4],
          ],
          null,
        ),
      ),
    ).toBe(false);
    expect(isWarehouseLocked(undefined)).toBe(false);
  });
});
