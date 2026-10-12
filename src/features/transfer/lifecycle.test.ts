import { describe, expect, it } from "vitest";

import { TRANSFER_STATUSES, UI_LABELS } from "@/constants";
import { TRANSFER_TRANSITIONS } from "@/lib/domain/lifecycle";

import { TRANSFER_ROLE_PERMISSIONS as ROLES } from "./__fixtures__/render";
import { allowedTransferActions, isTransferEditable, isTransferTerminal } from "./lifecycle";

import type { TransferStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";

const canAs = (role: keyof typeof ROLES) => (code: PermissionCode) =>
  (ROLES[role] as readonly PermissionCode[]).includes(code);

const codes = (status: TransferStatus, role: keyof typeof ROLES, submittedBy?: string) =>
  allowedTransferActions({ status, submittedBy }, canAs(role), "me").map((a) => a.action.code);

describe("TRANSFER_TRANSITIONS (docs 10 §5 = BE TransferStatus)", () => {
  it("toàn bảng khớp BE TransferStatus.canTransitionTo", () => {
    expect(TRANSFER_TRANSITIONS).toEqual({
      DRAFT: ["PENDING_APPROVAL", "APPROVED", "CANCELLED"],
      PENDING_APPROVAL: ["APPROVED", "DRAFT"],
      APPROVED: ["PICKING", "CANCELLED"],
      PICKING: ["IN_TRANSIT", "APPROVED"],
      IN_TRANSIT: ["PARTIALLY_RECEIVED", "RECEIVED"],
      PARTIALLY_RECEIVED: ["RECEIVED", "CLOSED"],
      RECEIVED: ["COMPLETED"],
      COMPLETED: [],
      CLOSED: [],
      CANCELLED: [],
    });
  });

  it("có đủ 10 trạng thái của BE", () => {
    expect(Object.keys(TRANSFER_TRANSITIONS).sort()).toEqual([...TRANSFER_STATUSES].sort());
  });

  it("DRAFT → PENDING_APPROVAL / APPROVED (dưới ngưỡng) / CANCELLED", () => {
    expect(TRANSFER_TRANSITIONS.DRAFT).toEqual(["PENDING_APPROVAL", "APPROVED", "CANCELLED"]);
  });

  it("PENDING_APPROVAL bị từ chối quay về DRAFT; PICKING dừng thì về APPROVED", () => {
    expect(TRANSFER_TRANSITIONS.PENDING_APPROVAL).toContain("DRAFT");
    expect(TRANSFER_TRANSITIONS.PICKING).toEqual(["IN_TRANSIT", "APPROVED"]);
  });

  it("BR-04: sau khi xuất kho không còn huỷ được", () => {
    for (const status of ["PICKING", "IN_TRANSIT", "PARTIALLY_RECEIVED", "RECEIVED"] as const) {
      expect(TRANSFER_TRANSITIONS[status]).not.toContain("CANCELLED");
    }
  });

  it("COMPLETED / CLOSED / CANCELLED là terminal — không transition nào", () => {
    expect(TRANSFER_TRANSITIONS.COMPLETED).toEqual([]);
    expect(TRANSFER_TRANSITIONS.CLOSED).toEqual([]);
    expect(TRANSFER_TRANSITIONS.CANCELLED).toEqual([]);
    expect(isTransferTerminal("CLOSED")).toBe(true);
    expect(isTransferTerminal("IN_TRANSIT")).toBe(false);
  });

  it("chỉ DRAFT sửa được", () => {
    expect(TRANSFER_STATUSES.filter(isTransferEditable)).toEqual(["DRAFT"]);
  });
});

describe("allowedTransferActions — gating theo seed BE", () => {
  it("DRAFT + Inventory Planner → gửi duyệt, sửa nháp, huỷ", () => {
    expect(codes("DRAFT", "inventoryPlanner")).toEqual(["submit", "edit", "cancel"]);
  });

  it("DRAFT + NV kho (chỉ UPDATE) → không có nút nào", () => {
    expect(codes("DRAFT", "warehouseStaff")).toEqual([]);
  });

  it("PENDING_APPROVAL + Inventory Planner → không thấy Duyệt / Từ chối (chỉ quản lý kho)", () => {
    expect(codes("PENDING_APPROVAL", "inventoryPlanner")).toEqual([]);
  });

  it("PENDING_APPROVAL + quản lý kho (người khác gửi) → duyệt, từ chối", () => {
    const actions = allowedTransferActions(
      { status: "PENDING_APPROVAL", submittedBy: "someone-else" },
      canAs("warehouseManager"),
      "me",
    );
    expect(actions.map((a) => a.action.code)).toEqual(["approve", "reject"]);
    expect(actions.every((a) => !a.disabledReason)).toBe(true);
  });

  it("four-eyes: người gửi duyệt thấy Duyệt / Từ chối nhưng bị khoá kèm lý do", () => {
    const actions = allowedTransferActions(
      { status: "PENDING_APPROVAL", submittedBy: "me" },
      canAs("warehouseManager"),
      "me",
    );
    expect(actions.map((a) => a.disabledReason)).toEqual([
      UI_LABELS.transfer.disabledReason.selfApproval,
      UI_LABELS.transfer.disabledReason.selfApproval,
    ]);
  });

  it("APPROVED + NV kho → bắt đầu lấy hàng, không huỷ được (huỷ cần CREATE)", () => {
    expect(codes("APPROVED", "warehouseStaff")).toEqual(["startPicking"]);
    expect(codes("APPROVED", "warehouseManager")).toEqual(["startPicking", "cancel"]);
  });

  it("PICKING + NV kho → xuất kho, dừng lấy hàng", () => {
    expect(codes("PICKING", "warehouseStaff")).toEqual(["dispatch", "cancelPicking"]);
  });

  it("chỉ có quyền xem → không render nút mutating nào ở mọi trạng thái", () => {
    for (const status of TRANSFER_STATUSES) expect(codes(status, "viewOnly")).toEqual([]);
  });

  it("IN_TRANSIT trở đi (nhận hàng là SCRUM-328) và terminal → không có nút", () => {
    for (const status of [
      "IN_TRANSIT",
      "PARTIALLY_RECEIVED",
      "RECEIVED",
      "COMPLETED",
      "CLOSED",
      "CANCELLED",
    ] as const) {
      expect(codes(status, "warehouseManager")).toEqual([]);
    }
  });
});
