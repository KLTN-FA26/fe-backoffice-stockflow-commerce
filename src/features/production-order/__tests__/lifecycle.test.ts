import { describe, expect, it } from "vitest";

import { PRODUCTION_ORDER_STATUSES } from "@/constants";

import {
  canTransition,
  hasMutatingAction,
  isTerminal,
  PRODUCTION_ORDER_TRANSITIONS,
  productionOrderActions,
} from "../lifecycle";
import {
  actorOf,
  COORDINATOR_ID,
  MANAGER_ID,
  PRODUCTION_ACTORS,
  productionOrder,
} from "../__fixtures__/production-order";

import type { ProductionOrderStatus } from "@/constants";

const coordinator = { can: actorOf(PRODUCTION_ACTORS.coordinator), userId: COORDINATOR_ID };
const manager = { can: actorOf(PRODUCTION_ACTORS.salesManager), userId: MANAGER_ID };
const sales = { can: actorOf(PRODUCTION_ACTORS.sales), userId: "sale" };
const warehouse = { can: actorOf(PRODUCTION_ACTORS.warehouseManager), userId: "wh" };
const at = (status: ProductionOrderStatus, extra = {}) => productionOrder({ status, ...extra });

describe("PRODUCTION_ORDER_TRANSITIONS (docs 17 §5.3)", () => {
  it("mọi trạng thái của docs có mặt", () => {
    expect(Object.keys(PRODUCTION_ORDER_TRANSITIONS).sort()).toEqual(
      [...PRODUCTION_ORDER_STATUSES].sort(),
    );
  });

  it("Draft → Pending Approval / Cancelled; Pending Approval → Sent / Draft / Cancelled", () => {
    expect(PRODUCTION_ORDER_TRANSITIONS.DRAFT).toEqual(["PENDING_APPROVAL", "CANCELLED"]);
    expect(PRODUCTION_ORDER_TRANSITIONS.PENDING_APPROVAL).toEqual(["SENT", "DRAFT", "CANCELLED"]);
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
    expect(cancellable).toEqual([
      "DRAFT",
      "PENDING_APPROVAL",
      "SENT",
      "ACCEPTED",
      "SAMPLE_PENDING",
    ]);
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
  it("Draft + Điều phối sản xuất → sửa, gửi duyệt, huỷ; không duyệt", () => {
    const a = productionOrderActions(at("DRAFT"), coordinator);
    expect([a.edit, a.submit, a.cancel]).toEqual([true, true, true]);
    expect(a.approve).toBe(false);
  });

  it("Pending Approval + Sales Manager (không phải người lập) → duyệt, trả lại; không huỷ", () => {
    const a = productionOrderActions(at("PENDING_APPROVAL"), manager);
    expect([a.approve, a.return, a.cancel, a.selfApprovalBlocked]).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("BR-23: Sales Manager tự lập đơn → không thấy Duyệt / Trả lại, có lời giải thích", () => {
    const a = productionOrderActions(at("PENDING_APPROVAL", { drawnUpBy: MANAGER_ID }), manager);
    expect([a.approve, a.return, a.selfApprovalBlocked]).toEqual([false, false, true]);
  });

  it("Pending Approval + Điều phối sản xuất → chỉ huỷ, không duyệt", () => {
    const a = productionOrderActions(at("PENDING_APPROVAL"), coordinator);
    expect([a.cancel, a.approve, a.submit, a.edit]).toEqual([true, false, false, false]);
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

  it.each(["DRAFT", "PENDING_APPROVAL", "SENT", "IN_PRODUCTION"] as const)(
    "%s + Sale / Quản lý kho (chỉ đọc) → không nút ghi nào",
    (status) => {
      expect(hasMutatingAction(productionOrderActions(at(status), sales, "EMAIL"))).toBe(false);
      expect(hasMutatingAction(productionOrderActions(at(status), warehouse, "EMAIL"))).toBe(false);
    },
  );

  it.each(["RECEIVED", "CANCELLED", "CLOSED"] as const)(
    "%s → không render nút mutating nào kể cả admin",
    (status) => {
      const admin = { can: () => true, userId: "admin" };
      expect(hasMutatingAction(productionOrderActions(at(status), admin, "EMAIL"))).toBe(false);
    },
  );
});
