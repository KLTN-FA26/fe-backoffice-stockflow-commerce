import { describe, expect, it } from "vitest";

import { PRODUCTION_ORDER_STATUSES } from "@/constants";

import {
  canTransition,
  hasMutatingAction,
  isTerminal,
  PRODUCTION_ORDER_TRANSITIONS,
  productionOrderActions,
} from "../lifecycle";
import { actorOf, PRODUCTION_ACTORS, productionOrder } from "../__fixtures__/production-order";

import type { ProductionOrderStatus } from "@/constants";

const coordinator = { can: actorOf(PRODUCTION_ACTORS.coordinator) };
const manager = { can: actorOf(PRODUCTION_ACTORS.salesManager) };
const sales = { can: actorOf(PRODUCTION_ACTORS.sales) };
const warehouse = { can: actorOf(PRODUCTION_ACTORS.warehouseManager) };
const at = (status: ProductionOrderStatus, extra = {}) => productionOrder({ status, ...extra });

describe("PRODUCTION_ORDER_TRANSITIONS (docs 17 §5.3)", () => {
  it("mọi trạng thái của docs có mặt", () => {
    expect(Object.keys(PRODUCTION_ORDER_TRANSITIONS).sort()).toEqual(
      [...PRODUCTION_ORDER_STATUSES].sort(),
    );
  });

  it("BR-23 (chốt lại 2026-11-20): Draft → Sent / Cancelled, không qua Pending Approval", () => {
    expect(PRODUCTION_ORDER_TRANSITIONS.DRAFT).toEqual(["SENT", "CANCELLED"]);
    expect(canTransition("DRAFT", "PENDING_APPROVAL")).toBe(false);
  });

  it("Pending Approval chỉ còn trong lịch sử — không chuyển vào, không chuyển ra", () => {
    expect(PRODUCTION_ORDER_TRANSITIONS.PENDING_APPROVAL).toEqual([]);
    const into = PRODUCTION_ORDER_STATUSES.filter((s) => canTransition(s, "PENDING_APPROVAL"));
    expect(into).toEqual([]);
  });

  it("Sent → In Production khi hàng về mà không cần duyệt mẫu; Accepted → Sample Pending / In Production", () => {
    expect(canTransition("SENT", "IN_PRODUCTION")).toBe(true);
    expect(PRODUCTION_ORDER_TRANSITIONS.ACCEPTED).toEqual([
      "SAMPLE_PENDING",
      "IN_PRODUCTION",
      "CANCELLED",
    ]);
  });

  it("BR-06: chỉ huỷ trước khi in hàng loạt, chỉ đóng từ In Production / Partially Received", () => {
    const cancellable = PRODUCTION_ORDER_STATUSES.filter((s) => canTransition(s, "CANCELLED"));
    expect(cancellable).toEqual(["DRAFT", "SENT", "ACCEPTED", "SAMPLE_PENDING"]);
    const closable = PRODUCTION_ORDER_STATUSES.filter((s) => canTransition(s, "CLOSED"));
    expect(closable).toEqual(["IN_PRODUCTION", "PARTIALLY_RECEIVED"]);
  });

  it.each(["RECEIVED", "CANCELLED", "CLOSED"] as const)(
    "%s là terminal — không transition nào",
    (status) => {
      expect(PRODUCTION_ORDER_TRANSITIONS[status]).toEqual([]);
      expect(isTerminal(status)).toBe(true);
    },
  );
});

describe("productionOrderActions — action-gating theo vai trò", () => {
  it("BR-23: Draft + Điều phối sản xuất (chính người lập) → sửa, gửi, huỷ", () => {
    const a = productionOrderActions(at("DRAFT"), coordinator);
    expect([a.edit, a.send, a.cancel]).toEqual([true, true, true]);
  });

  it("Draft + Sales Manager → chỉ xem, không gửi / sửa / huỷ (không còn duyệt)", () => {
    expect(hasMutatingAction(productionOrderActions(at("DRAFT"), manager, "EMAIL"))).toBe(false);
  });

  it("Pending Approval (đơn cũ) → không còn nút gửi / huỷ nào, kể cả Điều phối sản xuất", () => {
    const a = productionOrderActions(at("PENDING_APPROVAL"), coordinator, "EMAIL");
    expect(hasMutatingAction(a)).toBe(false);
  });

  it("Gửi chỉ từ Draft", () => {
    const sendable = PRODUCTION_ORDER_STATUSES.filter(
      (s) => productionOrderActions(at(s), coordinator).send,
    );
    expect(sendable).toEqual(["DRAFT"]);
  });

  it("Sent → ghi nhận nhận đơn + huỷ; gửi lại mail chỉ khi kênh Email", () => {
    expect(productionOrderActions(at("SENT"), coordinator, "EMAIL")).toMatchObject({
      accept: true,
      cancel: true,
      resend: true,
    });
    expect(productionOrderActions(at("SENT"), coordinator, "PDF").resend).toBe(false);
  });

  it("BR-24: Accepted cần duyệt mẫu → không có Bắt đầu sản xuất, có lời giải thích", () => {
    const a = productionOrderActions(at("ACCEPTED", { sampleApprovalRequired: true }), coordinator);
    expect([a.startProduction, a.startBlockedBySample, a.changeExpected]).toEqual([
      false,
      true,
      true,
    ]);
  });

  it("Accepted không cần duyệt mẫu → Bắt đầu sản xuất", () => {
    const a = productionOrderActions(
      at("ACCEPTED", { sampleApprovalRequired: false }),
      coordinator,
    );
    expect([a.startProduction, a.startBlockedBySample]).toEqual([true, false]);
  });

  it("In Production / Partially Received → đổi ngày dự kiến, đóng; không huỷ", () => {
    for (const status of ["IN_PRODUCTION", "PARTIALLY_RECEIVED"] as const) {
      const a = productionOrderActions(at(status), coordinator);
      expect([a.changeExpected, a.close, a.cancel]).toEqual([true, true, false]);
    }
  });

  it.each(["DRAFT", "SENT", "ACCEPTED", "IN_PRODUCTION"] as const)(
    "%s + Sales Manager / Sale / Quản lý kho (chỉ đọc) → không nút ghi nào",
    (status) => {
      for (const reader of [manager, sales, warehouse]) {
        expect(hasMutatingAction(productionOrderActions(at(status), reader, "EMAIL"))).toBe(false);
      }
    },
  );

  it.each(["RECEIVED", "CANCELLED", "CLOSED"] as const)(
    "%s → không render nút mutating nào kể cả admin",
    (status) => {
      const admin = { can: () => true };
      expect(hasMutatingAction(productionOrderActions(at(status), admin, "EMAIL"))).toBe(false);
    },
  );
});
