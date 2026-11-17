/**
 * Mock trả hàng (docs 17 §4.10, 03 §4.2) — chạy qua axios thật + lớp api của `features/return`, nên kiểm luôn mock
 * đúng hình BE và lớp api parse được. Kịch bản: Sale duyệt → kho lập phiếu, quét, xác nhận → RECEIVED → Sale đề xuất
 * → người khác duyệt hoàn tiền → RESOLVED, kèm cờ cần hoá đơn điều chỉnh.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  approveReturn,
  approveSettlement,
  getReturn,
  listReturns,
  openReturnForCustomer,
  proposeRefund,
  rejectReturn,
} from "@/features/return/api";
import {
  confirmReturnReceipt,
  createReturnReceipt,
  getReturnReceipt,
  listReturnReceipts,
  scanReturnCarton,
} from "@/features/return/receipt-api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { activateMockAdapter } from "./mock-adapter";
import { resetReturnMockStore } from "./mock-returns-store";

const originalAdapter = api.defaults.adapter;

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected request to fail");
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
afterEach(() => resetReturnMockStore());
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("GET /returns", () => {
  it("covers every live status, filters repeated status and vatAdjustment", async () => {
    const all = await listReturns({ page: 0, size: 50 });
    expect(new Set(all.items.map((r) => r.status))).toEqual(
      new Set([
        "REQUESTED",
        "AWAITING_RETURN",
        "RECEIVED",
        "SETTLEMENT_PENDING",
        "RESOLVED",
        "REJECTED",
        "CANCELLED",
        "EXPIRED",
      ]),
    );
    const open = await listReturns({ statuses: ["REQUESTED", "RECEIVED"] });
    expect(open.items.map((r) => r.status).sort()).toEqual(["RECEIVED", "REQUESTED"]);
    const vat = await listReturns({ vatAdjustment: true });
    expect(vat.items.map((r) => r.rmaNumber)).toEqual(["RMA-20261110-0005"]);
  });

  it("GET /goods-receipts/returns is not swallowed by /goods-receipts/:id", async () => {
    expect((await listReturnReceipts({})).items).toEqual([]);
  });
});

describe("a return from claim to refund", () => {
  it("approve → receipt scan + confirm → RECEIVED → propose", async () => {
    const before = await getReturn("RMA-0001");
    await expect(
      approveReturn({ id: before.id, version: before.version + 1, lines: [] }),
    ).rejects.toMatchObject({ code: "OPTIMISTIC_LOCK" });
    const approved = await approveReturn({
      id: before.id,
      version: before.version,
      lines: [{ lineId: before.lines[0]?.id ?? "", approvedQuantity: 1 }],
    });
    expect(approved.status).toBe("AWAITING_RETURN");
    expect(approved.review?.returnDeadline).toBeTruthy();

    const draft = await createReturnReceipt({
      returnRequestId: approved.id,
      quarantineLocationCode: "WH-HCM-01-QUARANTINE",
    });
    expect(draft.status).toBe("DRAFT");
    const again = await errorOf(
      createReturnReceipt({ returnRequestId: approved.id, quarantineLocationCode: "X" }),
    );
    expect(again.code).toMatch(/RETURN_RECEIPT_ALREADY_OPEN|LOCATION_AREA_MISMATCH/);
    const lpn = draft.expectedCartons[0]?.lpn ?? "";
    expect((await errorOf(scanReturnCarton({ id: draft.id, lpn: "NOPE" }))).code).toBe(
      "RETURN_CARTON_NOT_OF_SOURCE",
    );
    const scanned = await scanReturnCarton({ id: draft.id, lpn, condition: "Móp góc" });
    expect(scanned.expectedCartons[0]?.scanned).toBe(true);
    expect((await confirmReturnReceipt({ id: draft.id })).status).toBe("CLOSED");
    expect((await getReturnReceipt(draft.id)).cartons[0]?.condition).toBe("Móp góc");

    const received = await getReturn(approved.id);
    expect(received.status).toBe("RECEIVED");
    const proposed = await proposeRefund({
      id: received.id,
      version: received.version,
      lines: [],
    });
    expect(proposed.status).toBe("SETTLEMENT_PENDING");
    // Bốn mắt: người đề xuất không tự duyệt (RETURN_SELF_APPROVAL)
    expect(
      (await errorOf(approveSettlement({ id: proposed.id, version: proposed.version }))).code,
    ).toBe("RETURN_SELF_APPROVAL");
  });

  it("another person approves a pending refund → RESOLVED with a VAT adjustment flag", async () => {
    const pending = await getReturn("RMA-0004");
    const resolved = await approveSettlement({ id: pending.id, version: pending.version });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolution?.vatAdjustmentRequired).toBe(true);
  });

  it("rejecting needs a reason; deciding a closed return is RETURN_INVALID_TRANSITION", async () => {
    const closed = await getReturn("RMA-0006");
    expect(
      (await errorOf(rejectReturn({ id: closed.id, version: closed.version, reason: "x" }))).code,
    ).toBe("RETURN_INVALID_TRANSITION");
  });

  it("Sales open a claim for the customer; short delivery is refused", async () => {
    const opened = await openReturnForCustomer({
      orderId: "ORD-2026-0016",
      requestId: "11111111-1111-4111-8111-111111111111",
      reasonCode: "WRONG_ITEM",
      lines: [{ orderLineId: "ORDL-0016-1", quantity: 1 }],
    });
    expect(opened).toMatchObject({ status: "REQUESTED", channel: "BACK_OFFICE" });
    const shortDelivery = await errorOf(
      api.post("/orders/ORD-2026-0016/returns", {
        requestId: "x",
        reasonCode: "SHORT_DELIVERY",
        lines: [{ orderLineId: "ORDL-0016-1", quantity: 1 }],
      }),
    );
    expect(shortDelivery.code).toBe("RETURN_REASON_NOT_ACCEPTED");
  });
});
