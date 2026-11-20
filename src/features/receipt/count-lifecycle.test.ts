import { describe, expect, it } from "vitest";

import { RECEIPT_COUNT_LABELS, RECEIPT_STATUSES, UI_LABELS } from "@/constants";

import { RECEIPT_ROLE_PERMISSIONS as ROLES } from "./__fixtures__/render";
import { allowedReceiptActions, productionReceiptCreateGate, receiptCountGate } from "./lifecycle";

import type { PermissionCode } from "@/lib/auth";

function can(granted: readonly PermissionCode[]) {
  return (code: PermissionCode) => granted.includes(code);
}

const NO_PRODUCTION_READ = { disabledReason: RECEIPT_COUNT_LABELS.noProductionRead };

describe("productionReceiptCreateGate — lập phiếu theo Đơn sản xuất (docs 03 §4.1 bước 1)", () => {
  it("Quản lý kho (goods-receipts:CREATE + production-orders:READ) → nút bấm được", () => {
    expect(productionReceiptCreateGate(can(ROLES.warehouseManager))).toEqual({});
  });

  it("NV kho (seed BE chưa cấp production-orders:READ) → hiện nút khoá kèm lý do", () => {
    expect(productionReceiptCreateGate(can(ROLES.warehouseStaff))).toEqual(NO_PRODUCTION_READ);
  });

  it("Sale (đọc Đơn sản xuất, không có goods-receipts) → không hiện nút", () => {
    expect(productionReceiptCreateGate(can(ROLES.salesStaff))).toBeNull();
    expect(productionReceiptCreateGate(can(ROLES.reader))).toBeNull();
  });
});

describe("receiptCountGate — kiểm đếm theo thùng (docs 03 §4.1 bước 2–5)", () => {
  const draft = { status: "Draft", receiptType: "PRODUCTION" } as const;

  it("Draft theo Đơn sản xuất + Quản lý kho → được đếm", () => {
    expect(receiptCountGate(draft, can(ROLES.warehouseManager))).toEqual({});
  });

  it("Draft + NV kho thiếu production-orders:READ → báo lý do thay vì form", () => {
    expect(receiptCountGate(draft, can(ROLES.warehouseStaff))).toEqual(NO_PRODUCTION_READ);
  });

  it("Draft + chỉ đọc phiếu → không hiện khối kiểm đếm", () => {
    expect(receiptCountGate(draft, can(ROLES.reader))).toBeNull();
  });

  it.each(RECEIPT_STATUSES.filter((status) => status !== "Draft"))(
    "%s → không đếm được nữa (chỉ phiếu Draft sửa được, docs 03 §5)",
    (status) => {
      expect(
        receiptCountGate({ status, receiptType: "PRODUCTION" }, can(ROLES.warehouseManager)),
      ).toBeNull();
    },
  );

  it("Phiếu mua hàng cũ / hàng hoàn → không có khối kiểm đếm theo Đơn sản xuất", () => {
    const manager = can(ROLES.warehouseManager);
    expect(receiptCountGate({ ...draft, receiptType: "PURCHASE" }, manager)).toBeNull();
    expect(receiptCountGate({ ...draft, receiptType: "RETURN" }, manager)).toBeNull();
  });
});

describe("allowedReceiptActions — bản đếm chưa lưu", () => {
  it("form kiểm đếm còn thay đổi → Xác nhận nhập kho khoá kèm lý do, Huỷ phiếu vẫn bấm được", () => {
    const actions = allowedReceiptActions(
      { status: "Draft", lineCount: 1, receiptType: "PRODUCTION", countDirty: true },
      can(ROLES.warehouseManager),
    );
    const confirm = actions.find(({ action }) => action.code === "confirm");
    const cancel = actions.find(({ action }) => action.code === "cancel");
    expect(confirm?.disabledReason).toBe(RECEIPT_COUNT_LABELS.count.dirtyBlocksConfirm);
    expect(cancel?.disabledReason).toBeUndefined();
  });

  it("chưa có dòng thì lý do 'chưa kiểm đếm' đứng trước lý do bản đếm chưa lưu", () => {
    const [confirm] = allowedReceiptActions(
      { status: "Draft", lineCount: 0, receiptType: "PRODUCTION", countDirty: true },
      can(ROLES.warehouseManager),
    );
    expect(confirm?.disabledReason).toBe(UI_LABELS.receipt.disabledReason.noLines);
  });
});
