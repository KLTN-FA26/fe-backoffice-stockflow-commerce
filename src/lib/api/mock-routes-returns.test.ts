/**
 * Mock trả hàng (docs 17 §4.10, 03 §4.2) — chạy qua axios thật + lớp api của `features/return`, nên kiểm luôn mock
 * đúng hình BE và lớp api parse được. Kịch bản: Sale duyệt → kho lập phiếu, quét, xác nhận → RECEIVED → Sale đề xuất
 * → người khác duyệt hoàn tiền → RESOLVED, kèm cờ cần hoá đơn điều chỉnh.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  approveReturn,
  approveSettlement,
  attachReturnEvidence,
  beginReturnEvidenceUpload,
  cancelReturn,
  closeWithoutRefund,
  getReturn,
  listReturns,
  markGoodsComplete,
  openReturnForCustomer,
  proposeRefund,
  rejectReturn,
} from "@/features/return/api";
import {
  confirmReturnReceipt,
  createReturnReceipt,
  getReturnReceipt,
  listReturnReceipts,
  recordLooseLine,
  removeLooseLine,
  scanReturnCarton,
} from "@/features/return/receipt-api";
import { api } from "@/lib/api/client";
import { uploadFileDirect } from "@/lib/api/direct-upload";
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
    expect(open.items.map((r) => r.rmaNumber).sort()).toEqual([
      "RMA-20261110-0001",
      "RMA-20261110-0003",
      "RMA-20261110-0010",
    ]);
    const vat = await listReturns({ vatAdjustment: true });
    expect(vat.items.map((r) => r.rmaNumber)).toEqual(["RMA-20261110-0005"]);
  });

  it("GET /goods-receipts/returns is not swallowed by /goods-receipts/:id", async () => {
    const page = await listReturnReceipts({});
    expect(page.items.map((r) => [r.number, r.receiptType])).toEqual([["GR-RET-SEED-9", "RETURN"]]);
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

describe("WF-05 — goods back in several parcels (TH-3) and opened cartons / loose units (TH-4)", () => {
  it("a short parcel keeps the return awaiting; it is no longer withdrawn; the next parcel completes it", async () => {
    const before = await getReturn("RMA-0001");
    const approved = await approveReturn({ id: before.id, version: before.version, lines: [] });
    const first = await createReturnReceipt({
      returnRequestId: approved.id,
      quarantineLocationCode: "WH-HCM-01-QUARANTINE",
    });
    const lpn = first.expectedCartons[0]?.lpn ?? "";
    // Thùng 2 cái, mở ra chỉ còn 1
    expect((await errorOf(scanReturnCarton({ id: first.id, lpn, countedQuantity: 3 }))).code).toBe(
      "VALIDATION_FAILED",
    );
    const scanned = await scanReturnCarton({ id: first.id, lpn, countedQuantity: 1 });
    expect(scanned.cartons[0]).toMatchObject({ quantity: 2, countedQuantity: 1, opened: true });
    await confirmReturnReceipt({ id: first.id });

    const partly = await getReturn(approved.id);
    expect(partly.status).toBe("AWAITING_RETURN");
    expect(partly.lines[0]?.receivedQuantity).toBe(1);
    expect(partly.receipt?.goodsReceiptId).toBe(first.id);
    expect(partly.receipt?.parcels).toEqual([
      expect.objectContaining({ parcel: 1, goodsReceiptId: first.id, receiptNumber: first.number }),
    ]);
    expect((await errorOf(cancelReturn({ id: partly.id }))).code).toBe(
      "RETURN_GOODS_PARTLY_RECEIVED",
    );

    // Kiện thứ hai: phiếu mới; thùng cũ đã ở kho; hàng lẻ không nhãn thay số theo SKU + lô
    const second = await createReturnReceipt({
      returnRequestId: approved.id,
      quarantineLocationCode: "WH-HCM-01-QUARANTINE",
    });
    expect((await errorOf(scanReturnCarton({ id: second.id, lpn }))).code).toBe(
      "RETURN_CARTON_IN_WAREHOUSE",
    );
    expect(
      (await errorOf(recordLooseLine({ id: second.id, sku: "SKU-NOT-OURS", quantity: 1 }))).code,
    ).toBe("VALIDATION_FAILED");
    const sku = partly.lines[0]?.sku ?? "";
    await recordLooseLine({ id: second.id, sku, lotNumber: "L1", quantity: 5 });
    const replaced = await recordLooseLine({ id: second.id, sku, lotNumber: "L1", quantity: 1 });
    expect(replaced.looseLines).toEqual([
      expect.objectContaining({ sku, lotNumber: "L1", quantity: 1 }),
    ]);
    const removed = await removeLooseLine({
      id: second.id,
      lineId: replaced.looseLines?.[0]?.id ?? "",
    });
    expect(removed.looseLines).toEqual([]);
    await recordLooseLine({ id: second.id, sku, quantity: 1 });
    expect((await confirmReturnReceipt({ id: second.id })).status).toBe("CLOSED");

    const complete = await getReturn(approved.id);
    expect(complete.status).toBe("RECEIVED");
    expect(complete.lines[0]?.receivedQuantity).toBe(2);
    expect(complete.receipt?.goodsReceiptId).toBe(first.id);
    expect(complete.receipt?.parcels?.map((p) => [p.parcel, p.goodsReceiptId])).toEqual([
      [1, first.id],
      [2, second.id],
    ]);
  });

  it("loose units are refused on a receipt that is not a draft", async () => {
    const seeded = await getReturnReceipt("RRC-SEED-9");
    expect(seeded.status).toBe("CLOSED");
    expect(
      (await errorOf(recordLooseLine({ id: seeded.id, sku: "SKU-002-WHT", quantity: 1 }))).code,
    ).toBe("INVALID_RECEIPT_TRANSITION");
  });

  it("goods complete: only AWAITING_RETURN with a parcel back → RECEIVED at the units back", async () => {
    const waiting = await getReturn("RMA-0002");
    expect(
      (await errorOf(markGoodsComplete({ id: waiting.id, version: waiting.version }))).code,
    ).toBe("RETURN_INVALID_TRANSITION");
    const partly = await getReturn("RMA-0009");
    expect(
      (await errorOf(markGoodsComplete({ id: partly.id, version: partly.version + 1 }))).code,
    ).toBe("OPTIMISTIC_LOCK");
    const received = await markGoodsComplete({
      id: partly.id,
      version: partly.version,
      note: "Khách chỉ còn 1 cái",
    });
    expect(received.status).toBe("RECEIVED");
    expect(received.lines[0]).toMatchObject({ approvedQuantity: 3, receivedQuantity: 1 });
    expect(received.history?.at(-1)).toMatchObject({
      to: "RECEIVED",
      reason: "GOODS_COMPLETE: Khách chỉ còn 1 cái",
    });
  });

  it("closure without refund: only when nothing is refundable → RESOLVED, no money", async () => {
    const refundable = await getReturn("RMA-0003");
    expect(
      (await errorOf(closeWithoutRefund({ id: refundable.id, version: refundable.version }))).code,
    ).toBe("RETURN_QUANTITIES_INVALID");
    const empty = await getReturn("RMA-0010");
    expect(
      (await errorOf(proposeRefund({ id: empty.id, version: empty.version, lines: [] }))).code,
    ).toBe("RETURN_QUANTITIES_INVALID");
    const closed = await closeWithoutRefund({ id: empty.id, version: empty.version });
    expect(closed.status).toBe("RESOLVED");
    expect(closed.resolution).toMatchObject({
      settlementAmount: 0,
      refundedAmount: 0,
      vatAdjustmentRequired: false,
    });
    expect((await listReturns({ vatAdjustment: true })).items.map((r) => r.id)).not.toContain(
      empty.id,
    );
  });
});

describe("claim photos uploaded straight to storage", () => {
  const photo = (type = "image/jpeg") => new File(["abc"], "loi-in.jpg", { type });

  it("slot → PUT → attach adds a CLAIM photo", async () => {
    const before = await getReturn("RMA-0001");
    const uploadId = await uploadFileDirect({
      file: photo(),
      declare: (declaration, signal) => beginReturnEvidenceUpload(before.id, declaration, signal),
    });
    const after = await attachReturnEvidence({ id: before.id, uploadId });
    expect(after.evidence).toHaveLength((before.evidence?.length ?? 0) + 1);
    expect(after.evidence?.at(-1)).toMatchObject({ stage: "CLAIM", originalName: "loi-in.jpg" });
    // Gắn lại cùng uploadId: như cũ
    expect((await attachReturnEvidence({ id: before.id, uploadId })).evidence).toHaveLength(
      after.evidence?.length ?? 0,
    );
  });

  it("refuses a non-image type and a return past AWAITING_RETURN", async () => {
    const declaration = { fileName: "a.gif", sizeBytes: 3, sha256: "a".repeat(64) };
    expect(
      (
        await errorOf(
          beginReturnEvidenceUpload("RMA-0001", { ...declaration, contentType: "image/gif" }),
        )
      ).code,
    ).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(
      (
        await errorOf(
          beginReturnEvidenceUpload("RMA-0003", { ...declaration, contentType: "image/png" }),
        )
      ).code,
    ).toBe("RETURN_INVALID_TRANSITION");
  });
});
