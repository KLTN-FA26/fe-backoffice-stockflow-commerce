import { describe, expect, it } from "vitest";

import { capacityActions } from "../lifecycle";

import type { PermissionCode } from "@/lib/auth";

/** Bộ quyền theo seed BE V20261125000100 (bảng sức chứa) + quyền danh mục kho / bản đồ có sẵn. */
const ROLE: Record<string, readonly string[]> = {
  WAREHOUSE_MANAGER: [
    "warehouse-capacity:VIEW_PAGE",
    "warehouse-capacity:READ",
    "warehouse-warehouses:READ",
    "warehouse-warehouses:UPDATE",
    "warehouse-locations:READ",
  ],
  SALES_STAFF: [
    "warehouse-capacity:VIEW_PAGE",
    "warehouse-capacity:READ",
    "warehouse-warehouses:READ",
  ],
  PRODUCTION_COORDINATOR: ["warehouse-capacity:VIEW_PAGE", "warehouse-capacity:READ"],
  WAREHOUSE_STAFF: ["warehouse-warehouses:READ", "warehouse-locations:READ"],
};
const actorOf = (role: string) => ({
  can: (code: PermissionCode) => (ROLE[role] ?? []).includes(code),
});

describe("capacityActions — bảng chỉ đọc, sửa hệ số là việc của Quản lý kho (docs 06 §2, §4.6)", () => {
  it("Quản lý kho: xem, sửa hệ số, mở bản đồ", () => {
    expect(capacityActions(actorOf("WAREHOUSE_MANAGER"))).toEqual({
      read: true,
      editFactor: true,
      openMap: true,
    });
  });
  it("Sale: chỉ xem — không có nút sửa hệ số", () => {
    expect(capacityActions(actorOf("SALES_STAFF"))).toEqual({
      read: true,
      editFactor: false,
      openMap: false,
    });
  });
  it("Điều phối sản xuất: chỉ xem", () => {
    expect(capacityActions(actorOf("PRODUCTION_COORDINATOR")).editFactor).toBe(false);
  });
  it("Nhân viên kho: không có quyền bảng sức chứa", () => {
    const actions = capacityActions(actorOf("WAREHOUSE_STAFF"));
    expect(actions.read).toBe(false);
    expect(actions.editFactor).toBe(false);
  });
  it("UPDATE thiếu READ kho → không sửa được (cần đọc version trước khi PUT)", () => {
    const only = { can: (code: PermissionCode) => code === "warehouse-warehouses:UPDATE" };
    expect(capacityActions(only).editFactor).toBe(false);
  });
});
