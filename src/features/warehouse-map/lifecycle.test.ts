import { describe, expect, it } from "vitest";

import {
  LOCATION_STATUSES,
  WAREHOUSE_LOCATION_PERMISSIONS as LP,
  WAREHOUSE_PERMISSIONS as WP,
} from "@/constants";

import { LOCATION_STATUS_TRANSITIONS, placeStatusTargets, warehouseMapActions } from "./lifecycle";

import type { PermissionCode } from "@/lib/auth";

const actor = (codes: readonly PermissionCode[]) => ({
  can: (code: PermissionCode) => codes.includes(code),
});
/** Ba bộ quyền theo seed BE V20260928006000. */
const MANAGER = actor([...Object.values(WP), ...Object.values(LP)]);
const STAFF = actor([WP.viewPage, WP.read, LP.viewPage, LP.read]);
const PLANNER = actor([WP.viewPage, WP.read]);

describe("LOCATION_STATUS_TRANSITIONS (docs 06 §5)", () => {
  it("có đủ bốn trạng thái của bảng vòng đời", () => {
    expect(Object.keys(LOCATION_STATUS_TRANSITIONS).sort()).toEqual([...LOCATION_STATUSES].sort());
  });

  it("Active ⇄ Blocked ⇄ Maintenance, cả ba → Inactive", () => {
    expect(LOCATION_STATUS_TRANSITIONS.ACTIVE).toEqual(["BLOCKED", "MAINTENANCE", "INACTIVE"]);
    expect(LOCATION_STATUS_TRANSITIONS.BLOCKED).toContain("MAINTENANCE");
    expect(LOCATION_STATUS_TRANSITIONS.MAINTENANCE).toContain("BLOCKED");
  });

  it("Inactive chỉ về Active (khi chỗ còn trống — BE kiểm 409 LAYOUT_OVERLAP)", () => {
    expect(LOCATION_STATUS_TRANSITIONS.INACTIVE).toEqual(["ACTIVE"]);
  });

  it("không có trạng thái kết thúc: kệ / khu vực không xoá (BR-04)", () => {
    for (const status of LOCATION_STATUSES)
      expect(LOCATION_STATUS_TRANSITIONS[status].length).toBeGreaterThan(0);
  });
});

describe("action-gating theo quyền (3 vai trò)", () => {
  it("Quản lý kho: tạo kho, vẽ bản đồ, xoá tường / cửa, đổi trạng thái", () => {
    expect(warehouseMapActions(MANAGER)).toEqual({
      createWarehouse: true,
      editLayout: true,
      deleteBoundary: true,
    });
    expect(placeStatusTargets("ACTIVE", MANAGER)).toEqual(["BLOCKED", "MAINTENANCE", "INACTIVE"]);
  });

  it("NV kho: chỉ xem bản đồ — không nút mutating nào", () => {
    expect(warehouseMapActions(STAFF)).toEqual({
      createWarehouse: false,
      editLayout: false,
      deleteBoundary: false,
    });
    expect(placeStatusTargets("ACTIVE", STAFF)).toEqual([]);
  });

  it("Inventory Planner: chỉ xem danh mục kho", () => {
    expect(warehouseMapActions(PLANNER).createWarehouse).toBe(false);
    expect(placeStatusTargets("INACTIVE", PLANNER)).toEqual([]);
  });
});
