import type { PutawayTask } from "../types";

/** Nhiệm vụ cất hàng dạng BE `PutawayTaskResponse` (docs 05) — dữ liệu test, không lấy từ mock-data. */
export function task(overrides: Partial<PutawayTask> = {}): PutawayTask {
  return {
    id: "t-1",
    goodsReceiptId: "gr-1",
    goodsReceiptLineId: "grl-1",
    sku: "SKU-002-WHT",
    lotNumber: "LOT-A",
    quantity: 10,
    left: 10,
    sourceLocationCode: "HCM-RCV01",
    lpn: "LPN-20260923-000001",
    status: "PENDING",
    targetLocationCode: null,
    suggestions: [],
    overflowLocationCodes: [],
    source: "RECEIPT",
    ...overrides,
  };
}
