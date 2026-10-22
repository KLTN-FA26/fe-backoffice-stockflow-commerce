import { describe, expect, it } from "vitest";

import { TRANSFER_STATUSES, UI_LABELS } from "@/constants";
import { TRANSFER_TRANSITIONS } from "@/lib/domain/lifecycle";

import { TRANSFER_ROLE_PERMISSIONS as ROLES } from "./__fixtures__/render";
import { apiTransfer } from "./__fixtures__/transfer";
import {
  allowedTransferActions,
  dispatchExplanation,
  isTransferEditable,
  nextStepHint,
} from "./lifecycle";

import type { DeliveryMode, TransferStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";

const canAs = (role: keyof typeof ROLES) => (code: PermissionCode) =>
  (ROLES[role] as readonly PermissionCode[]).includes(code);

/** Mặc định giao lẻ (PARCEL): các ca cũ kiểm bảng thao tác của SCRUM-326/327; nguyên chuyến (FTL) có nhóm ca riêng. */
const codes = (
  status: TransferStatus,
  role: keyof typeof ROLES,
  submittedBy?: string,
  deliveryMode: DeliveryMode = "PARCEL",
) =>
  allowedTransferActions({ status, submittedBy, deliveryMode }, canAs(role), "me").map(
    (a) => a.action.code,
  );

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
      { status: "PENDING_APPROVAL", submittedBy: "someone-else", deliveryMode: "PARCEL" },
      canAs("warehouseManager"),
      "me",
    );
    expect(actions.map((a) => a.action.code)).toEqual(["approve", "reject"]);
    expect(actions.every((a) => !a.disabledReason)).toBe(true);
  });

  it("four-eyes: người gửi duyệt thấy Duyệt / Từ chối nhưng bị khoá kèm lý do", () => {
    const actions = allowedTransferActions(
      { status: "PENDING_APPROVAL", submittedBy: "me", deliveryMode: "PARCEL" },
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

/** SCRUM-287 PR F9 (BE PR #164, LP2-8): lệnh nguyên chuyến đi qua đóng gói + kế hoạch xe, không xuất kho thủ công. */
describe("allowedTransferActions — lệnh nguyên chuyến (FTL)", () => {
  const ftl = (patch: Parameters<typeof apiTransfer>[0]) => ({ ...apiTransfer(patch) });
  const actions = (patch: Parameters<typeof apiTransfer>[0], role: keyof typeof ROLES) =>
    allowedTransferActions(ftl(patch), canAs(role), "me");
  const codesOf = (patch: Parameters<typeof apiTransfer>[0], role: keyof typeof ROLES) =>
    actions(patch, role).map((a) => a.action.code);

  it("APPROVED + FTL + nhân viên đóng gói: thấy 'Đóng gói chuyển kho' cạnh Bắt đầu lấy hàng", () => {
    expect(codesOf({ status: "APPROVED" }, "floorStaff")).toEqual(["packTransfer", "startPicking"]);
  });

  it("APPROVED + giao lẻ (PARCEL): không có nút đóng gói / kế hoạch xe", () => {
    expect(codesOf({ status: "APPROVED", deliveryMode: "PARCEL" }, "floorStaff")).toEqual([
      "startPicking",
    ]);
  });

  it("PICKING + FTL chưa đóng gói: Đóng gói chuyển kho + Dừng lấy hàng; KHÔNG có Xuất kho", () => {
    expect(codesOf({ status: "PICKING" }, "floorStaff")).toEqual(["packTransfer", "cancelPicking"]);
  });

  it("PICKING + FTL đã đóng gói: Lập kế hoạch xe + Dừng lấy hàng (hết nút đóng gói)", () => {
    const patch = { status: "PICKING" as const, packedAt: "2026-10-22T04:00:00Z" };
    expect(codesOf(patch, "floorStaff")).toEqual(["planVehicle", "cancelPicking"]);
  });

  it("PICKING + giao lẻ: vẫn Xuất kho thủ công như SCRUM-327", () => {
    expect(codesOf({ status: "PICKING", deliveryMode: "PARCEL" }, "floorStaff")).toEqual([
      "dispatch",
      "cancelPicking",
    ]);
  });

  it("xe đầu đã ký nhận (goodsLeftAt): hết Lập kế hoạch xe; Dừng lấy hàng hiện nhưng khoá kèm lý do (BE TRANSFER_GOODS_LEFT)", () => {
    const list = actions(
      { status: "PICKING", packedAt: "2026-10-22T04:00:00Z", goodsLeftAt: "2026-10-22T06:00:00Z" },
      "floorStaff",
    );
    expect(list.map((a) => a.action.code)).toEqual(["cancelPicking"]);
    expect(list[0]?.disabledReason).toBe(
      UI_LABELS.transfer.deliveryMode.goodsLeftCannotCancelPicking,
    );
  });

  it("quyền theo mã: chỉ đóng gói → không thấy Lập kế hoạch xe; chỉ kế hoạch xe → không thấy Đóng gói", () => {
    const packed = { status: "PICKING" as const, packedAt: "2026-10-22T04:00:00Z" };
    expect(codesOf(packed, "packerOnly")).toEqual(["cancelPicking"]);
    expect(codesOf({ status: "PICKING" }, "plannerOnly")).toEqual(["cancelPicking"]);
    expect(codesOf(packed, "plannerOnly")).toEqual(["planVehicle", "cancelPicking"]);
    // Nhân viên chỉ có transfer:UPDATE (không packing / load-plans) không thấy cả hai
    expect(codesOf({ status: "APPROVED" }, "warehouseStaff")).toEqual(["startPicking"]);
  });

  it("chỉ xem → không nút nào; trạng thái khác APPROVED / PICKING → không đóng gói / kế hoạch xe", () => {
    for (const status of TRANSFER_STATUSES) {
      expect(codesOf({ status, packedAt: "2026-10-22T04:00:00Z" }, "viewOnly")).toEqual([]);
    }
    for (const status of [
      "DRAFT",
      "PENDING_APPROVAL",
      "IN_TRANSIT",
      "CANCELLED",
      "COMPLETED",
    ] as const) {
      const list = codesOf({ status, packedAt: "2026-10-22T04:00:00Z" }, "floorStaff");
      expect(list).not.toContain("packTransfer");
      expect(list).not.toContain("planVehicle");
    }
  });

  it("dispatchExplanation: câu giải thích thay nút Xuất kho khi lệnh FTL đang PICKING và người dùng có quyền xuất kho", () => {
    const picking = ftl({ status: "PICKING" });
    expect(dispatchExplanation(picking, canAs("floorStaff"))).toBe(
      UI_LABELS.transfer.deliveryMode.dispatchByLoadPlan,
    );
    expect(dispatchExplanation(picking, canAs("viewOnly"))).toBeNull();
    expect(
      dispatchExplanation(ftl({ status: "PICKING", deliveryMode: "PARCEL" }), canAs("floorStaff")),
    ).toBeNull();
    expect(dispatchExplanation(ftl({ status: "APPROVED" }), canAs("floorStaff"))).toBeNull();
  });

  it("nextStepHint: gợi ý đóng gói trước / lập kế hoạch xe sau; không gợi ý khi hàng đã rời kho hoặc giao lẻ", () => {
    expect(nextStepHint(ftl({ status: "PICKING" }))).toBe(
      UI_LABELS.transfer.deliveryMode.packFirst,
    );
    expect(nextStepHint(ftl({ status: "PICKING", packedAt: "2026-10-22T04:00:00Z" }))).toBe(
      UI_LABELS.transfer.deliveryMode.planVehicleHint,
    );
    expect(nextStepHint(ftl({ status: "PICKING", packedAt: "x", goodsLeftAt: "y" }))).toBeNull();
    expect(nextStepHint(ftl({ status: "PICKING", deliveryMode: "PARCEL" }))).toBeNull();
    expect(nextStepHint(ftl({ status: "APPROVED" }))).toBeNull();
  });
});
