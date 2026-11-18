import { describe, expect, it } from "vitest";

import { ORDER_PERMISSIONS } from "@/constants";

import { toOrderHistoryEntry } from "./history-api";
import { SHIPPING_ADDRESS_CHANGE_STATUSES, canChangeShippingAddress } from "./shipping-address";

import type { PermissionCode } from "@/lib/auth";
import type { Order, OrderReadStatus } from "./types";

type Facts = Pick<Order, "status" | "statusBeforeHold" | "firstLabeledAt" | "customerId">;

const sales = (code: PermissionCode) => code === ORDER_PERMISSIONS.shippingAddress;
const noPermission = () => false;
const order = (patch: Partial<Facts> = {}): Facts => ({
  status: "Picking",
  statusBeforeHold: null,
  firstLabeledAt: null,
  customerId: "c-1",
  ...patch,
});

describe("canChangeShippingAddress — docs 17 §4.7 bước 24, BR-16; 08 BR-04", () => {
  it("Draft và Pending Payment → Picking: Sale (sales-order-addresses:UPDATE) đổi được khi chưa dán nhãn", () => {
    for (const status of SHIPPING_ADDRESS_CHANGE_STATUSES) {
      expect(canChangeShippingAddress(order({ status }), sales)).toBe(true);
    }
    expect(SHIPPING_ADDRESS_CHANGE_STATUSES).toEqual([
      "Draft",
      "Pending Payment",
      "Confirmed",
      "Awaiting Stock",
      "Ready to Fulfill",
      "Picking",
    ]);
  });

  it("08 BR-04: thùng đầu tiên đã dán nhãn → ẩn, kể cả đơn còn Picking", () => {
    expect(canChangeShippingAddress(order({ firstLabeledAt: "2026-11-18T03:00:00Z" }), sales)).toBe(
      false,
    );
  });

  it("08 §6: đơn tạm giữ (lý do ADDRESS) từ bước cho đổi → đổi được; giữ từ Packed → không", () => {
    expect(
      canChangeShippingAddress(
        order({ status: "On Hold", statusBeforeHold: "Ready to Fulfill" }),
        sales,
      ),
    ).toBe(true);
    expect(
      canChangeShippingAddress(order({ status: "On Hold", statusBeforeHold: "Packed" }), sales),
    ).toBe(false);
  });

  it("hợp đồng đã gửi chờ ký, Packed trở đi, huỷ, trạng thái lạ: không đổi", () => {
    const closed: OrderReadStatus[] = [
      "Pending Contract",
      "Packed",
      "Partially Fulfilled",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Closed",
      "UNKNOWN",
    ];
    for (const status of closed) {
      expect(canChangeShippingAddress(order({ status }), sales)).toBe(false);
    }
  });

  it("thiếu mã quyền (vd quản lý kho, kế toán), hoặc đơn không gắn khách: không có nút", () => {
    expect(canChangeShippingAddress(order(), noPermission)).toBe(false);
    expect(canChangeShippingAddress(order({ customerId: null }), sales)).toBe(false);
  });
});

describe("toOrderHistoryEntry: ADDRESS_CHANGE (BE WF04 G2)", () => {
  const base = { occurredAt: "2026-11-18T02:00:00Z", actorName: "Sale A" };
  const address = (line1: string) => ({
    recipientName: "Kho Bến Thành",
    phone: "0901234567",
    line1,
    line2: null,
    wardName: "Phường Bến Nghé",
    provinceName: "TP. Hồ Chí Minh",
  });

  it("→ mục 'address-change' với địa chỉ cũ và mới thành một dòng", () => {
    expect(
      toOrderHistoryEntry({
        ...base,
        type: "ADDRESS_CHANGE",
        previousAddress: address("1 Lê Lợi"),
        newAddress: address("9 Hai Bà Trưng"),
      }),
    ).toEqual({
      kind: "address-change",
      from: "Kho Bến Thành · 0901234567 — 1 Lê Lợi, Phường Bến Nghé, TP. Hồ Chí Minh",
      to: "Kho Bến Thành · 0901234567 — 9 Hai Bà Trưng, Phường Bến Nghé, TP. Hồ Chí Minh",
      reason: null,
      actorName: "Sale A",
      occurredAt: "2026-11-18T02:00:00Z",
    });
  });

  it("thiếu địa chỉ mới → 'unknown', không đoán", () => {
    expect(toOrderHistoryEntry({ ...base, type: "ADDRESS_CHANGE" }).kind).toBe("unknown");
  });
});
