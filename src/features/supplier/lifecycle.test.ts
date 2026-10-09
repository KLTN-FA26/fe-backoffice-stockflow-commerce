import { describe, expect, it } from "vitest";

import { SUPPLIER_PERMISSIONS } from "@/constants";

import { SUPPLIER_TRANSITIONS, allowedSupplierActions } from "./lifecycle";

import type { PermissionCode } from "@/lib/auth";

const { viewPage, read, create, update } = SUPPLIER_PERMISSIONS;

/** Bộ quyền giả lập `/me/permissions` — theo mã quyền, không theo tên vai trò. */
const PERMISSION_SETS = {
  none: [],
  readOnly: [viewPage, read],
  editor: [viewPage, read, create, update],
  full: Object.values(SUPPLIER_PERMISSIONS),
} satisfies Record<string, PermissionCode[]>;

const checker = (codes: readonly PermissionCode[]) => (code: PermissionCode) =>
  codes.includes(code);

const keys = (status: "Active" | "Inactive" | "Blacklisted", codes: readonly PermissionCode[]) =>
  allowedSupplierActions(status, checker(codes)).map((a) => a.key);

describe("SUPPLIER_TRANSITIONS (BE SupplierStatus ACTIVE/INACTIVE/BLACKLISTED)", () => {
  it("Active ↔ Inactive; danh sách đen chỉ gỡ ra bằng kích hoạt lại", () => {
    expect(SUPPLIER_TRANSITIONS).toEqual({
      Active: ["Inactive", "Blacklisted"],
      Inactive: ["Active", "Blacklisted"],
      Blacklisted: ["Active"],
    });
  });
});

describe("allowedSupplierActions — action-gating theo mã quyền", () => {
  it("không có quyền NCC nào → không có hành động", () => {
    expect(keys("Active", PERMISSION_SETS.none)).toEqual([]);
    expect(keys("Inactive", PERMISSION_SETS.none)).toEqual([]);
  });

  it("chỉ VIEW_PAGE + READ → không có nút mutating", () => {
    expect(keys("Active", PERMISSION_SETS.readOnly)).toEqual([]);
    expect(keys("Inactive", PERMISSION_SETS.readOnly)).toEqual([]);
  });

  it("CREATE + UPDATE (không DELETE) → kích hoạt lại / đưa vào danh sách đen, không ngừng hợp tác", () => {
    expect(keys("Inactive", PERMISSION_SETS.editor)).toEqual(["activate", "blacklist"]);
    expect(keys("Active", PERMISSION_SETS.editor)).toEqual(["blacklist"]);
    expect(keys("Blacklisted", PERMISSION_SETS.editor)).toEqual(["activate"]);
  });

  it("có DELETE → ngừng hợp tác NCC đang hoạt động", () => {
    expect(keys("Active", PERMISSION_SETS.full)).toEqual(["deactivate", "blacklist"]);
    expect(keys("Inactive", PERMISSION_SETS.full)).toEqual(["activate", "blacklist"]);
  });

  it("mỗi hành động gắn đúng mã quyền BE", () => {
    const [deactivate] = allowedSupplierActions("Active", () => true);
    const [activate, blacklist] = allowedSupplierActions("Inactive", () => true);
    expect(deactivate?.permission).toBe("procurement-suppliers:DELETE");
    expect(activate?.permission).toBe("procurement-suppliers:UPDATE");
    expect(blacklist?.permission).toBe("procurement-suppliers:UPDATE");
  });
});
