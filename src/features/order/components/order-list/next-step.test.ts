import { describe, expect, it } from "vitest";

import { NEXT_STEP_LABELS } from "./constants";
import { orderListNextStep } from "./next-step";

import type { Order } from "../../types";

type Row = Pick<Order, "status" | "holdReason" | "warehouseId">;
const row = (status: Row["status"], extra: Partial<Row> = {}): Row => ({
  status,
  holdReason: null,
  warehouseId: null,
  ...extra,
});

describe("orderListNextStep (bo-17)", () => {
  it("contract and signing payment steps come from the status", () => {
    expect(orderListNextStep(row("Draft"))).toBe(NEXT_STEP_LABELS.draft);
    expect(orderListNextStep(row("Pending Contract"))).toBe(NEXT_STEP_LABELS.pendingContract);
    expect(orderListNextStep(row("Pending Payment"))).toBe(NEXT_STEP_LABELS.pendingPayment);
  });

  it("a confirmed order without a shipping warehouse asks for one; with one, nothing", () => {
    expect(orderListNextStep(row("Confirmed"))).toBe(NEXT_STEP_LABELS.chooseWarehouse);
    expect(orderListNextStep(row("Confirmed", { warehouseId: "w-1" }))).toBeNull();
  });

  it("a held order names who lifts the hold", () => {
    expect(orderListNextStep(row("On Hold", { holdReason: "CREDIT" }))).toBe(
      NEXT_STEP_LABELS.creditHold,
    );
    expect(orderListNextStep(row("On Hold", { holdReason: "DELIVERY_FAILED" }))).toBe(
      NEXT_STEP_LABELS.deliveryFailedHold,
    );
    expect(orderListNextStep(row("On Hold", { holdReason: "ADDRESS" }))).toBe(
      NEXT_STEP_LABELS.otherHold,
    );
  });

  it("warehouse and delivery stages show no hint (the status says it)", () => {
    for (const status of ["Picking", "Shipped", "Delivered", "Completed", "Cancelled"] as const)
      expect(orderListNextStep(row(status))).toBeNull();
  });
});
