import { describe, expect, it } from "vitest";

import {
  GOODS_RECEIPT_PERMISSIONS,
  PO_PERMISSIONS,
  QC_TASK_PERMISSIONS,
  RECEIPT_STATUSES,
  UI_LABELS,
} from "@/constants";

import {
  allowedLineActions,
  allowedReceiptActions,
  isReceiptEditable,
  isReceiptTerminal,
} from "./lifecycle";

import type { PermissionCode } from "@/lib/auth";

/**
 * Bộ quyền đúng seed BE (V20260903000100 + V20260929000100 + V20261029002000): WAREHOUSE_STAFF có
 * goods-receipts nhưng KHÔNG có purchase-orders:READ; WAREHOUSE_MANAGER có cả hai và
 * goods-receipts:APPROVE (duyệt nhận vượt dung sai, BR-RCP-001); QC_STAFF có qc-tasks:APPROVE.
 */
const WAREHOUSE_STAFF: readonly PermissionCode[] = [
  GOODS_RECEIPT_PERMISSIONS.viewPage,
  GOODS_RECEIPT_PERMISSIONS.read,
  GOODS_RECEIPT_PERMISSIONS.create,
  GOODS_RECEIPT_PERMISSIONS.update,
];

const ROLE_PERMISSIONS: Record<string, readonly PermissionCode[]> = {
  warehouseStaff: WAREHOUSE_STAFF,
  warehouseManager: [
    ...WAREHOUSE_STAFF,
    PO_PERMISSIONS.viewPage,
    PO_PERMISSIONS.read,
    GOODS_RECEIPT_PERMISSIONS.approve,
  ],
  qcStaff: [
    GOODS_RECEIPT_PERMISSIONS.viewPage,
    GOODS_RECEIPT_PERMISSIONS.read,
    QC_TASK_PERMISSIONS.approve,
  ],
  viewer: [GOODS_RECEIPT_PERMISSIONS.viewPage, GOODS_RECEIPT_PERMISSIONS.read],
};

const canAs = (role: keyof typeof ROLE_PERMISSIONS) => (code: PermissionCode) =>
  ROLE_PERMISSIONS[role]?.includes(code) ?? false;

const codes = (actions: readonly { action: { code: string } }[]) =>
  actions.map((a) => a.action.code);

describe("allowedReceiptActions (docs 03 §5.1)", () => {
  it("Draft + quản lý kho (có quyền đọc PO) → lưu kiểm đếm, xác nhận, huỷ", () => {
    const actions = allowedReceiptActions(
      { status: "Draft", lineCount: 2 },
      canAs("warehouseManager"),
    );
    expect(codes(actions)).toEqual(["saveLines", "confirm", "cancel"]);
    expect(actions.every((a) => !a.disabledReason)).toBe(true);
  });

  it("Draft + NV kho theo seed BE (thiếu purchase-orders:READ) → không lưu kiểm đếm được", () => {
    const actions = allowedReceiptActions(
      { status: "Draft", lineCount: 2 },
      canAs("warehouseStaff"),
    );
    expect(codes(actions)).toEqual(["confirm", "cancel"]);
  });

  it("Draft chưa có dòng → nút xác nhận hiện nhưng khoá kèm lý do", () => {
    const confirm = allowedReceiptActions(
      { status: "Draft", lineCount: 0 },
      canAs("warehouseManager"),
    ).find((a) => a.action.code === "confirm");
    expect(confirm?.disabledReason).toBe(UI_LABELS.receipt.disabledReason.noLines);
  });

  it("Draft + NV QC / người chỉ xem → không có nút thao tác phiếu", () => {
    expect(allowedReceiptActions({ status: "Draft", lineCount: 2 }, canAs("qcStaff"))).toEqual([]);
    expect(allowedReceiptActions({ status: "Draft", lineCount: 2 }, canAs("viewer"))).toEqual([]);
  });

  it("BR-05: sau khi ghi nhận không còn huỷ / sửa kiểm đếm, kể cả quản lý kho", () => {
    for (const status of RECEIPT_STATUSES.filter(
      (s) => s !== "Draft" && s !== "Pending Approval",
    )) {
      expect(allowedReceiptActions({ status, lineCount: 2 }, canAs("warehouseManager"))).toEqual(
        [],
      );
      expect(isReceiptEditable(status)).toBe(false);
    }
  });

  it("BR-RCP-001: Pending Approval không sửa được kiểm đếm, và không có nút 'Xác nhận nhập kho'", () => {
    expect(isReceiptEditable("Pending Approval")).toBe(false);
    expect(isReceiptTerminal("Pending Approval")).toBe(false);
    for (const role of ["warehouseStaff", "warehouseManager"]) {
      const actions = codes(
        allowedReceiptActions({ status: "Pending Approval", lineCount: 2 }, canAs(role)),
      );
      expect(actions).not.toContain("saveLines");
      expect(actions).not.toContain("confirm");
    }
  });

  it("BR-RCP-001: người có quyền goods-receipts:APPROVE thấy Duyệt / Từ chối phần vượt / Huỷ", () => {
    const actions = allowedReceiptActions(
      { status: "Pending Approval", lineCount: 2 },
      canAs("warehouseManager"),
    );
    expect(codes(actions)).toEqual(["approve", "rejectExcess", "cancel"]);
    expect(actions.every((a) => !a.disabledReason)).toBe(true);
  });

  it("BR-RCP-001: nút duyệt gate theo MÃ QUYỀN, không theo vai trò — NV kho (không có APPROVE) chỉ huỷ được", () => {
    expect(
      codes(
        allowedReceiptActions(
          { status: "Pending Approval", lineCount: 2 },
          canAs("warehouseStaff"),
        ),
      ),
    ).toEqual(["cancel"]);
    // Một tài khoản bất kỳ chỉ cần APPROVE (không cần quyền đọc PO) là thấy hai nút duyệt
    expect(
      codes(
        allowedReceiptActions(
          { status: "Pending Approval", lineCount: 2 },
          (code) => code === GOODS_RECEIPT_PERMISSIONS.approve,
        ),
      ),
    ).toEqual(["approve", "rejectExcess"]);
  });

  it("BR-RCP-001: NV QC / người chỉ xem không thấy nút nào ở phiếu chờ duyệt", () => {
    for (const role of ["qcStaff", "viewer"]) {
      expect(
        allowedReceiptActions({ status: "Pending Approval", lineCount: 2 }, canAs(role)),
      ).toEqual([]);
    }
  });

  it("quyền duyệt không mở nút nào ở trạng thái khác Pending Approval", () => {
    const manager = canAs("warehouseManager");
    expect(codes(allowedReceiptActions({ status: "Draft", lineCount: 2 }, manager))).toEqual([
      "saveLines",
      "confirm",
      "cancel",
    ]);
    expect(allowedReceiptActions({ status: "In QC", lineCount: 2 }, manager)).toEqual([]);
  });

  it("Closed / Cancelled là terminal", () => {
    expect(isReceiptTerminal("Closed")).toBe(true);
    expect(isReceiptTerminal("Cancelled")).toBe(true);
    expect(isReceiptTerminal("In QC")).toBe(false);
  });
});

describe("allowedLineActions (docs 03 §4 chặng 2, BR-08)", () => {
  it("dòng chờ chuyển QC → chỉ NV kho thấy 'Chuyển sang khu QC'", () => {
    const line = { qcProgress: "AWAITING_MOVE_TO_QC" as const };
    expect(allowedLineActions("In QC", line, canAs("warehouseStaff")).map((a) => a.code)).toEqual([
      "moveToQc",
    ]);
    expect(allowedLineActions("In QC", line, canAs("qcStaff"))).toEqual([]);
  });

  it("dòng đã ở khu QC → chỉ NV QC thấy 'Kết luận QC'", () => {
    const line = { qcProgress: "IN_QC_AREA" as const };
    expect(allowedLineActions("In QC", line, canAs("qcStaff")).map((a) => a.code)).toEqual([
      "inspect",
    ]);
    expect(allowedLineActions("In QC", line, canAs("warehouseStaff"))).toEqual([]);
    expect(allowedLineActions("In QC", line, canAs("viewer"))).toEqual([]);
  });

  it("phiếu không ở In QC, hoặc dòng không cần QC / đã kết luận → không có nút", () => {
    const all = canAs("warehouseStaff");
    expect(allowedLineActions("In Putaway", { qcProgress: "AWAITING_MOVE_TO_QC" }, all)).toEqual(
      [],
    );
    expect(allowedLineActions("In QC", { qcProgress: "NOT_REQUIRED" }, all)).toEqual([]);
    expect(allowedLineActions("In QC", { qcProgress: "INSPECTED" }, canAs("qcStaff"))).toEqual([]);
  });
});
