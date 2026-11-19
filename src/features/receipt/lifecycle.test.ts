import { describe, expect, it } from "vitest";

import { GOODS_RECEIPT_PERMISSIONS, RECEIPT_STATUSES, UI_LABELS } from "@/constants";

import { allowedReceiptActions, isReceiptTerminal } from "./lifecycle";

import type { ReceiptStatus, ReceiptTypeApi } from "@/constants";
import type { PermissionCode } from "@/lib/auth";

const GR = GOODS_RECEIPT_PERMISSIONS;

/** Bộ quyền theo seed BE: NV kho / Quản lý kho có goods-receipts UPDATE; người xem chỉ READ. */
const ROLE_PERMISSIONS = {
  warehouseStaff: [GR.viewPage, GR.read, GR.create, GR.update],
  warehouseManager: [GR.viewPage, GR.read, GR.create, GR.update],
  reader: [GR.viewPage, GR.read],
  viewOnly: [GR.viewPage],
} satisfies Record<string, PermissionCode[]>;

type Role = keyof typeof ROLE_PERMISSIONS;

function can(role: Role) {
  const granted: readonly PermissionCode[] = ROLE_PERMISSIONS[role];
  return (code: PermissionCode) => granted.includes(code);
}

function codes(
  role: Role,
  status: ReceiptStatus,
  receiptType: ReceiptTypeApi = "PRODUCTION",
  lineCount = 1,
) {
  return allowedReceiptActions({ status, lineCount, receiptType }, can(role)).map(
    ({ action }) => action.code,
  );
}

describe("allowedReceiptActions — phiếu theo Đơn sản xuất (docs 03 §4.1)", () => {
  it.each(["warehouseStaff", "warehouseManager"] as const)(
    "Draft + %s → Xác nhận nhập kho, Huỷ phiếu",
    (role) => {
      expect(codes(role, "Draft")).toEqual(["confirm", "cancel"]);
    },
  );

  it("Draft chưa có dòng → xác nhận hiện nhưng khoá kèm lý do; huỷ vẫn được", () => {
    const actions = allowedReceiptActions(
      { status: "Draft", lineCount: 0, receiptType: "PRODUCTION" },
      can("warehouseStaff"),
    );
    expect(actions.find(({ action }) => action.code === "confirm")?.disabledReason).toBe(
      UI_LABELS.receipt.disabledReason.noLines,
    );
    expect(actions.find(({ action }) => action.code === "cancel")?.disabledReason).toBeUndefined();
  });

  it.each(["reader", "viewOnly"] as const)(
    "Draft + %s (không có UPDATE) → không nút nào",
    (role) => {
      expect(codes(role, "Draft")).toEqual([]);
    },
  );

  it("In Putaway → không nút mutating nào (BR-05: sửa bằng điều chỉnh tồn)", () => {
    expect(codes("warehouseManager", "In Putaway")).toEqual([]);
  });

  it("mã cũ Pending Approval → không còn duyệt / huỷ", () => {
    expect(codes("warehouseManager", "Pending Approval")).toEqual([]);
  });
});

describe("allowedReceiptActions — phiếu mua hàng cũ (BE 4A-8)", () => {
  it("Draft PURCHASE → chỉ huỷ, không xác nhận được", () => {
    expect(codes("warehouseManager", "Draft", "PURCHASE")).toEqual(["cancel"]);
  });

  it("PURCHASE đã ghi nhận → không nút nào", () => {
    expect(codes("warehouseManager", "In Putaway", "PURCHASE")).toEqual([]);
  });
});

describe("allowedReceiptActions — phiếu hàng hoàn (luồng riêng features/return)", () => {
  it("Draft RETURN → không xác nhận, không huỷ ở màn phiếu nhận", () => {
    expect(codes("warehouseManager", "Draft", "RETURN")).toEqual([]);
  });
});

describe("terminal — ẩn mọi nút mutating", () => {
  it.each(["Closed", "Cancelled"] as const)("%s → không nút nào với mọi vai trò", (status) => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
      expect(codes(role, status)).toEqual([]);
    }
    expect(isReceiptTerminal(status)).toBe(true);
  });

  it("chỉ Draft / Confirmed / In Putaway còn chuyển tiếp", () => {
    expect(RECEIPT_STATUSES.filter((s) => !isReceiptTerminal(s))).toEqual([
      "Draft",
      "Confirmed",
      "In Putaway",
    ]);
  });
});
