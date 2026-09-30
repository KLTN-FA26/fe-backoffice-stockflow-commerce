/**
 * Contract test: the mock adapter must speak the exact BE PurchaseOrderController contract,
 * so `api.ts` (zod parse + mapper) works unchanged against mock and real BE.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";

import {
  approvePurchaseOrder,
  fetchPoStatusDashboard,
  getPurchaseOrder,
  listPurchaseOrders,
  receiveGoods,
} from "./api";

beforeAll(() => {
  // Pin the adapter's random latency / 5% random 500 so the test is deterministic.
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  activateMockAdapter();
});

afterAll(() => {
  vi.restoreAllMocks();
});

async function expectApiError(p: Promise<unknown>, status: number, code: string) {
  const err = await p.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status, code });
}

describe("PO mock ↔ BE contract", () => {
  it("maps seed 'Pending Approval' to DRAFT (BE merged submit+approve), not APPROVED", async () => {
    const po = await getPurchaseOrder("PO-2026-0010");
    expect(po.status).toBe("DRAFT");
  });

  it("filters by BE status and returns list rows without lines (like BE)", async () => {
    const page = await listPurchaseOrders({ page: 1, pageSize: 50, status: ["SENT"] });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((po) => po.status === "SENT")).toBe(true);
    expect(page.items.every((po) => po.lines.length === 0)).toBe(true);
  });

  it("status dashboard returns every BE status", async () => {
    const rows = await fetchPoStatusDashboard();
    expect(rows.map((r) => r.status)).toEqual([
      "DRAFT",
      "APPROVED",
      "SENT",
      "PARTIALLY_RECEIVED",
      "CLOSED",
      "CLOSED_SHORT",
      "CANCELLED",
    ]);
  });

  it("rejects receiving more than the open quantity with 400 VALIDATION_FAILED", async () => {
    const po = await getPurchaseOrder("PO-2026-0012"); // seed Confirmed → SENT
    const line = po.lines[0];
    expect(line).toBeDefined();
    if (!line) return;
    await expectApiError(
      receiveGoods(po.poId, [{ lineId: line.lineId, quantity: line.openQuantity + 1 }]),
      400,
      "VALIDATION_FAILED",
    );
  });

  it("partial receipt moves SENT → PARTIALLY_RECEIVED and lowers openQuantity", async () => {
    const po = await getPurchaseOrder("PO-2026-0012");
    const line = po.lines[0];
    if (!line) throw new Error("seed PO has no line");
    const updated = await receiveGoods(po.poId, [{ lineId: line.lineId, quantity: 1 }]);
    expect(updated.status).toBe("PARTIALLY_RECEIVED");
    expect(updated.lines[0]?.openQuantity).toBe(line.openQuantity - 1);
  });

  it("an illegal transition returns 409 INVALID_PURCHASE_ORDER_TRANSITION", async () => {
    await expectApiError(
      approvePurchaseOrder("PO-2026-0012"),
      409,
      "INVALID_PURCHASE_ORDER_TRANSITION",
    );
  });
});
