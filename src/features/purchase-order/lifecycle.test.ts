import { describe, expect, it } from "vitest";

import { GOODS_RECEIPT_PERMISSIONS, PO_STATUSES } from "@/constants";

import { PO_PERMISSION_SETS } from "./__fixtures__/render";
import { PO_TRANSITIONS, allowedPoActions, isPoTerminal, nextPoStatuses } from "./lifecycle";

import type { PermissionCode } from "@/lib/auth";
import type { PoGateState } from "./lifecycle";
import type { PoStatus } from "./types";

type SetName = keyof typeof PO_PERMISSION_SETS;

const gate = (status: PoStatus, extra: Partial<PoGateState> = {}): PoGateState => ({
  status,
  supplierConfirmationStatus: "NOT_SENT",
  deliveryStatus: "NOT_SENT",
  ...extra,
});
const codes = (po: PoGateState, set: SetName) => {
  const perms: readonly PermissionCode[] = PO_PERMISSION_SETS[set];
  return allowedPoActions(po, (code) => perms.includes(code)).map((a) => a.code);
};
const MUTATING = [
  "approve",
  "send",
  "cancel",
  "closeShort",
  "receive",
  "recoverDelivery",
  "recordConfirmation",
];

describe("PO_TRANSITIONS (docs 02 §5 thu hẹp theo BE PurchaseOrderStatus, 7 trạng thái)", () => {
  it("có đủ 7 mã trạng thái BE", () => {
    expect(Object.keys(PO_TRANSITIONS).sort()).toEqual([...PO_STATUSES].sort());
  });

  it("DRAFT → APPROVED | CANCELLED; APPROVED → SENT | CANCELLED", () => {
    expect(nextPoStatuses("DRAFT")).toEqual(["APPROVED", "CANCELLED"]);
    expect(nextPoStatuses("APPROVED")).toEqual(["SENT", "CANCELLED"]);
  });

  it("BR-05 (docs 02 §6): PARTIALLY_RECEIVED không thể CANCELLED — chỉ short-close", () => {
    expect(nextPoStatuses("PARTIALLY_RECEIVED")).toEqual(["CLOSED_SHORT"]);
  });

  it.each(["CLOSED", "CLOSED_SHORT", "CANCELLED"] as const)("%s là terminal (=== [])", (s) => {
    expect(PO_TRANSITIONS[s]).toEqual([]);
    expect(isPoTerminal(s)).toBe(true);
  });

  it("regression: trạng thái lạ không làm sập trang — coi như terminal, không có bước kế", () => {
    expect(isPoTerminal("Draft")).toBe(true);
    expect(nextPoStatuses("Draft")).toEqual([]);
  });
});

describe("allowedPoActions — gate theo MÃ QUYỀN (/identity/me/permissions), không theo vai trò", () => {
  it("chỉ xem (VIEW_PAGE + READ): không có thao tác nào", () => {
    expect(codes(gate("DRAFT"), "readOnly")).toEqual([]);
    expect(codes(gate("SENT", { supplierConfirmationStatus: "PENDING" }), "readOnly")).toEqual([]);
  });

  it("thiếu APPROVE (procurement): DRAFT không có Phê duyệt, vẫn được Huỷ", () => {
    expect(codes(gate("DRAFT"), "procurement")).toEqual(["cancel"]);
  });

  it("có APPROVE (approver, BE #40): DRAFT chỉ có Phê duyệt (không có UPDATE để huỷ)", () => {
    expect(codes(gate("DRAFT"), "approver")).toEqual(["approve"]);
  });

  it("APPROVED + UPDATE → Gửi NCC; approver không gửi được", () => {
    expect(codes(gate("APPROVED"), "procurement")).toEqual(["send", "cancel"]);
    expect(codes(gate("APPROVED"), "approver")).toEqual([]);
  });

  it("BR-03: SENT chờ NCC phản hồi → nhận hàng, ghi nhận phản hồi, huỷ", () => {
    const po = gate("SENT", { supplierConfirmationStatus: "PENDING", deliveryStatus: "DELIVERED" });
    expect(codes(po, "procurement")).toEqual(["receive", "recordConfirmation", "cancel"]);
  });

  it("Nhận hàng mở màn tạo phiếu nhận → cần goods-receipts CREATE + VIEW_PAGE", () => {
    const po = gate("SENT", { supplierConfirmationStatus: "PENDING" });
    const withoutViewPage: readonly PermissionCode[] = PO_PERMISSION_SETS.procurement.filter(
      (code) => code !== GOODS_RECEIPT_PERMISSIONS.viewPage,
    );
    const actions = allowedPoActions(po, (code) => withoutViewPage.includes(code));
    expect(actions.map((a) => a.code)).not.toContain("receive");
  });

  it.each(["DRAFT", "APPROVED"] as const)("BR-03: %s chưa chốt → không có Nhận hàng", (s) => {
    expect(codes(gate(s), "full")).not.toContain("receive");
  });

  it("NCC đã từ chối → không cho nhận hàng (PO không bao giờ CONFIRMED, BE receipt từ chối)", () => {
    const po = gate("SENT", { supplierConfirmationStatus: "REJECTED" });
    expect(codes(po, "full")).toEqual(["cancel"]);
  });

  it("khôi phục gửi: chỉ khi SENT + chờ NCC + lần gửi FAILED, và cần APPROVE", () => {
    const failed = gate("SENT", {
      supplierConfirmationStatus: "PENDING",
      deliveryStatus: "FAILED",
    });
    expect(codes(failed, "approver")).toEqual(["recoverDelivery"]);
    expect(codes(failed, "procurement")).not.toContain("recoverDelivery");
    const delivered = { ...failed, deliveryStatus: "DELIVERED" as const };
    expect(codes(delivered, "full")).not.toContain("recoverDelivery");
  });

  it("BR-03 + BR-05: PARTIALLY_RECEIVED → nhận tiếp, đóng thiếu; không có huỷ", () => {
    const po = gate("PARTIALLY_RECEIVED", { supplierConfirmationStatus: "CONFIRMED" });
    expect(codes(po, "procurement")).toEqual(["receive", "closeShort"]);
  });

  it("không có quyền nào → không có thao tác", () => {
    expect(codes(gate("DRAFT"), "none")).toEqual([]);
  });

  it.each(["CLOSED", "CLOSED_SHORT", "CANCELLED"] as const)(
    "%s (terminal, NCC đã phản hồi): không có nút mutating kể cả đủ quyền",
    (s) => {
      const po = gate(s, { supplierConfirmationStatus: "CONFIRMED" });
      expect(codes(po, "full").filter((c) => MUTATING.includes(c))).toEqual([]);
    },
  );
});
