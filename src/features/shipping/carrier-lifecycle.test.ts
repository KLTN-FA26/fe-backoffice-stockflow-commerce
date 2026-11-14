import { describe, expect, it } from "vitest";

import {
  FULFILLMENT_CARRIER_PERMISSIONS,
  FULFILLMENT_DISPATCH_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
} from "@/constants";

import { carrierActions } from "./carrier-lifecycle";

import type { ShippingActor } from "./lifecycle";

const actor = (permissions: readonly string[]): ShippingActor => ({
  can: (code) => permissions.includes(code),
});
const READ = [SHIPMENT_PERMISSIONS.viewPage, SHIPMENT_PERMISSIONS.read];

describe("carrierActions — danh mục hãng (fulfillment-carriers:UPDATE)", () => {
  it("quản lý kho (có fulfillment-carriers:UPDATE): thêm và sửa hãng", () => {
    const manager = actor([
      ...READ,
      FULFILLMENT_DISPATCH_PERMISSIONS.update,
      FULFILLMENT_CARRIER_PERMISSIONS.update,
    ]);
    expect(carrierActions(manager)).toEqual({ create: true, edit: true });
  });

  it("nhân viên kho (chỉ xếp xe, chọn hãng từ danh mục): không thêm, không sửa", () => {
    const staff = actor([...READ, FULFILLMENT_DISPATCH_PERMISSIONS.update]);
    expect(carrierActions(staff)).toEqual({ create: false, edit: false });
  });

  it("chỉ xem và không quyền nào: không thao tác", () => {
    expect(carrierActions(actor(READ))).toEqual({ create: false, edit: false });
    expect(carrierActions(actor([]))).toEqual({ create: false, edit: false });
  });
});
