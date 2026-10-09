import { describe, expect, it } from "vitest";

import { PO_STATUSES } from "@/constants";

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
  "submit",
  "approve",
  "reject",
  "send",
  "cancel",
  "closeShort",
  "close",
  "recoverDelivery",
  "recordConfirmation",
];

describe("PO_TRANSITIONS (docs 02 §5, BE PurchaseOrderStatus D4 — 8 trạng thái)", () => {
  it("có đủ 8 mã trạng thái BE", () => {
    expect(Object.keys(PO_TRANSITIONS).sort()).toEqual([...PO_STATUSES].sort());
    expect(PO_STATUSES).toHaveLength(8);
  });

  it("DRAFT → PENDING_APPROVAL → APPROVED | DRAFT (từ chối); APPROVED → CONFIRMED", () => {
    expect(nextPoStatuses("DRAFT")).toEqual(["PENDING_APPROVAL", "CANCELLED"]);
    expect(nextPoStatuses("PENDING_APPROVAL")).toEqual(["APPROVED", "DRAFT", "CANCELLED"]);
    expect(nextPoStatuses("APPROVED")).toEqual(["CONFIRMED", "CANCELLED"]);
    expect(nextPoStatuses("CONFIRMED")).toEqual(["CANCELLED"]);
  });

  it("BR-05 (docs 02 §6): đã nhận hàng thì không huỷ được — chỉ đóng", () => {
    expect(nextPoStatuses("PARTIALLY_RECEIVED")).toEqual(["CLOSED"]);
    expect(nextPoStatuses("RECEIVED")).toEqual(["CLOSED"]);
  });

  it.each(["CLOSED", "CANCELLED"] as const)("%s là terminal (=== [])", (s) => {
    expect(PO_TRANSITIONS[s]).toEqual([]);
    expect(isPoTerminal(s)).toBe(true);
  });

  it("regression: trạng thái lạ không làm sập trang — coi như terminal, không có bước kế", () => {
    expect(isPoTerminal("Draft")).toBe(true);
    expect(nextPoStatuses("SENT")).toEqual([]);
  });
});

describe("allowedPoActions — gate theo MÃ QUYỀN (/identity/me/permissions), không theo vai trò", () => {
  it("chỉ xem (VIEW_PAGE + READ): không có thao tác nào", () => {
    expect(codes(gate("DRAFT"), "readOnly")).toEqual([]);
    expect(codes(gate("CONFIRMED", { supplierConfirmationStatus: "PENDING" }), "readOnly")).toEqual(
      [],
    );
  });

  it("DRAFT + UPDATE (procurement): Gửi duyệt, Huỷ — không có Phê duyệt", () => {
    expect(codes(gate("DRAFT"), "procurement")).toEqual(["submit", "cancel"]);
    expect(codes(gate("DRAFT"), "approver")).toEqual([]);
  });

  it("PENDING_APPROVAL: người có APPROVE được Duyệt / Từ chối; procurement chỉ Huỷ", () => {
    expect(codes(gate("PENDING_APPROVAL"), "approver")).toEqual(["approve", "reject"]);
    expect(codes(gate("PENDING_APPROVAL"), "procurement")).toEqual(["cancel"]);
  });

  it("APPROVED + UPDATE → Xác nhận & gửi NCC; approver không gửi được", () => {
    expect(codes(gate("APPROVED"), "procurement")).toEqual(["send", "cancel"]);
    expect(codes(gate("APPROVED"), "approver")).toEqual([]);
  });

  it("CONFIRMED chờ NCC phản hồi → ghi nhận phản hồi, huỷ (nhận hàng qua phiếu nhập)", () => {
    const po = gate("CONFIRMED", {
      supplierConfirmationStatus: "PENDING",
      deliveryStatus: "DELIVERED",
    });
    expect(codes(po, "procurement")).toEqual(["recordConfirmation", "cancel"]);
  });

  it("NCC đã từ chối → chỉ còn huỷ (rồi tạo PO thay thế)", () => {
    const po = gate("CONFIRMED", { supplierConfirmationStatus: "REJECTED" });
    expect(codes(po, "full")).toEqual(["cancel"]);
  });

  it("khôi phục gửi: chỉ khi CONFIRMED + chờ NCC + lần gửi FAILED, và cần APPROVE", () => {
    const failed = gate("CONFIRMED", {
      supplierConfirmationStatus: "PENDING",
      deliveryStatus: "FAILED",
    });
    expect(codes(failed, "approver")).toEqual(["recoverDelivery"]);
    expect(codes(failed, "procurement")).not.toContain("recoverDelivery");
    const delivered = { ...failed, deliveryStatus: "DELIVERED" as const };
    expect(codes(delivered, "full")).not.toContain("recoverDelivery");
  });

  it("BR-05: PARTIALLY_RECEIVED → chỉ đóng thiếu; RECEIVED → đóng đơn; không có huỷ", () => {
    const partial = gate("PARTIALLY_RECEIVED", { supplierConfirmationStatus: "CONFIRMED" });
    expect(codes(partial, "procurement")).toEqual(["closeShort"]);
    const received = gate("RECEIVED", { supplierConfirmationStatus: "CONFIRMED" });
    expect(codes(received, "procurement")).toEqual(["close"]);
  });

  it("không có quyền nào → không có thao tác", () => {
    expect(codes(gate("DRAFT"), "none")).toEqual([]);
  });

  it.each(["CLOSED", "CANCELLED"] as const)(
    "%s (terminal, NCC đã phản hồi): không có nút mutating kể cả đủ quyền",
    (s) => {
      const po = gate(s, { supplierConfirmationStatus: "CONFIRMED" });
      expect(codes(po, "full").filter((c) => MUTATING.includes(c))).toEqual([]);
    },
  );
});
