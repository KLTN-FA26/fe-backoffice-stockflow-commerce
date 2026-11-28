/**
 * Mock phiếu nhập hàng hoàn theo yêu cầu trả hàng phải từ chối đúng những gì BE từ chối (WF-05 BE-22, Q-11, Q-18;
 * BE `ReturnReceivingProgressIntegrationTest`): nhận theo số lượng SKU đã duyệt, thùng chỉ là ứng viên. Chạy qua axios
 * thật + lớp api nên kiểm luôn hình dạng `returnProgress` / `candidateCartons` parse được.
 *
 * RMA-0009 (mock): duyệt 3 SKU-002-WHT; lô giao có 3 thùng nhãn 2; thùng 1 đã về mở, đếm 1 (phiếu SEED-9).
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  cancelReturnReceipt,
  createReturnReceipt,
  recordLooseLine,
  removeReturnCarton,
  scanReturnCarton,
} from "@/features/return/receipt-api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { activateMockAdapter } from "./mock-adapter";
import { resetReturnMockStore } from "./mock-returns-store";
import { mockLoosePhotoReceived } from "./mock-routes-return-receipts";

import type { ReturnReceipt } from "@/features/return/types";

const originalAdapter = api.defaults.adapter;
const SKU = "SKU-002-WHT";
const AREA = "WH-HCM-01-QUARANTINE";

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected request to fail");
}

const progress = (receipt: ReturnReceipt) => receipt.returnProgress?.find((p) => p.sku === SKU);
const eligibility = (receipt: ReturnReceipt, lpn: string) =>
  receipt.candidateCartons?.find((c) => c.lpn === lpn);
const draft = () =>
  createReturnReceipt({ returnRequestId: "RMA-0009", quarantineLocationCode: AREA });

beforeAll(() => {
  // The adapter fails 5% of requests at random: pin it, as mock-routes-returns.test.ts does
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
afterEach(() => resetReturnMockStore());
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("mock return receipt ↔ BE receiving rules", () => {
  it("progress counts units of the approved SKU across receipts; candidates are classified as BE does", async () => {
    const open = await draft();
    expect(progress(open)).toEqual({
      sku: SKU,
      approvedQuantity: 3,
      confirmedReceivedQuantity: 1,
      currentReceiptQuantity: 0,
      remainingQuantity: 2,
    });
    expect(eligibility(open, "LPN-0016-1")?.eligibility).toBe("RETURNED_OPENED");
    expect(eligibility(open, "LPN-0016-2")).toMatchObject({
      eligibility: "RECEIVABLE",
      maxReceivableQuantity: 2,
    });
    expect(eligibility(open, "LPN-0016-3")?.eligibility).toBe("RECEIVABLE");
    expect(open.expectedCartons.find((c) => c.lpn === "LPN-0016-1")?.receivedEarlier).toBe(true);
  });

  it("an opened carton is never taken again; the target is met by one carton, not all of them", async () => {
    const open = await draft();
    const opened = await errorOf(scanReturnCarton({ id: open.id, lpn: "LPN-0016-1" }));
    expect([opened.code, opened.details?.reason]).toEqual([
      "RETURN_CARTON_IN_WAREHOUSE",
      "RETURNED_OPENED",
    ]);

    const one = await scanReturnCarton({ id: open.id, lpn: "LPN-0016-3" });
    expect(progress(one)).toMatchObject({ currentReceiptQuantity: 2, remainingQuantity: 0 });
    expect(eligibility(one, "LPN-0016-2")?.eligibility).toBe("APPROVED_QUANTITY_REACHED");
    const over = await errorOf(scanReturnCarton({ id: open.id, lpn: "LPN-0016-2" }));
    expect(over.code).toBe("RETURN_CARTON_NOT_CLAIMED");
    expect(over.details).toMatchObject({ approved: 3, alreadyBack: 3, units: 2 });

    // The same LPN again is the same carton: counted once
    const again = await scanReturnCarton({ id: open.id, lpn: "lpn-0016-3" });
    expect(again.cartons).toHaveLength(1);
    expect(progress(again)?.currentReceiptQuantity).toBe(2);
  });

  it("a recount gives the rest back and is itself capped; removal and cancellation restore the allowance", async () => {
    const open = await draft();
    await scanReturnCarton({ id: open.id, lpn: "LPN-0016-2" });
    const recounted = await scanReturnCarton({
      id: open.id,
      lpn: "LPN-0016-2",
      countedQuantity: 1,
    });
    expect(progress(recounted)).toMatchObject({ currentReceiptQuantity: 1, remainingQuantity: 1 });
    expect(eligibility(recounted, "LPN-0016-3")).toMatchObject({
      eligibility: "COUNT_REQUIRED",
      maxReceivableQuantity: 1,
    });
    // Sealed, a carton of 2 does not fit what remains (1)
    expect((await errorOf(scanReturnCarton({ id: open.id, lpn: "LPN-0016-3" }))).code).toBe(
      "RETURN_CARTON_NOT_CLAIMED",
    );
    const removed = await removeReturnCarton({ id: open.id, lpn: "LPN-0016-2" });
    expect(progress(removed)).toMatchObject({ currentReceiptQuantity: 0, remainingQuantity: 2 });

    await scanReturnCarton({ id: open.id, lpn: "LPN-0016-2" });
    const cancelled = await cancelReturnReceipt({ id: open.id });
    expect(progress(cancelled)).toMatchObject({ currentReceiptQuantity: 0, remainingQuantity: 2 });
    const next = await draft();
    expect(eligibility(next, "LPN-0016-2")?.eligibility).toBe("RECEIVABLE");
  });

  it("loose units count toward the SKU and are capped by what remains", async () => {
    const open = await draft();
    const loose = await recordLooseLine({
      id: open.id,
      sku: SKU,
      quantity: 2,
      photoId: mockLoosePhotoReceived(open.id),
    });
    expect(progress(loose)).toMatchObject({ currentReceiptQuantity: 2, remainingQuantity: 0 });
    const over = await errorOf(
      recordLooseLine({
        id: open.id,
        sku: SKU,
        lotNumber: "L2",
        quantity: 1,
        photoId: mockLoosePhotoReceived(open.id),
      }),
    );
    expect(over.code).toBe("RETURN_LOOSE_EXCEEDS_APPROVED");
  });
});
