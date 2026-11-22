/**
 * Contract test: mock phiếu nhập theo Đơn sản xuất (SCRUM-566) nói đúng hợp đồng BE `GoodsReceiptController` —
 * lập phiếu, đếm theo thùng, xác nhận — để `count-api.ts` + `api.ts` (zod parse) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetReceiptMockStore } from "@/lib/api/mock-routes-goods-receipts-store";
import { mockUsableAreaCodes } from "@/lib/api/mock-routes-warehouse-layout";
import { api } from "@/lib/api/client";
import { fetchProductionOrderRef } from "@/lib/references/production-orders";

import { confirmGoodsReceipt } from "./api";
import { createProductionReceipt, replaceReceiptLines } from "./count-api";

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetReceiptMockStore();
  activateMockAdapter();
});

afterAll(() => vi.restoreAllMocks());

const FLOW_TIMEOUT_MS = 20_000;

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  throw new Error("expected the call to fail");
}

async function receivableOrderId(): Promise<string> {
  const { data } = await api.get<{ items: { id: string }[] }>("/production-orders", {
    params: { status: "IN_PRODUCTION" },
  });
  const found = data.items[0];
  if (!found) throw new Error("no IN_PRODUCTION production order in the mock");
  return found.id;
}

describe("phiếu theo Đơn sản xuất — mock ↔ hợp đồng BE (docs 03 §4.1)", () => {
  it(
    "lập → đếm theo thùng (LPN, lô = mã Đơn SX) → BR-02 chặn vượt → xác nhận sang In Putaway",
    async () => {
      const orderId = await receivableOrderId();
      const order = await fetchProductionOrderRef(orderId);
      const line = order.lines[0];
      if (!line) throw new Error("production order has no line");

      const draft = await createProductionReceipt({
        productionOrderId: orderId,
        deliveryNote: "PG-1",
        note: "",
      });
      expect(draft.status).toBe("Draft");
      expect(draft.receiptType).toBe("PRODUCTION");
      expect(draft.lines).toEqual([]);

      const [area] = await mockUsableAreaCodes(draft.warehouseId, "RECEIVING");
      if (!area) throw new Error("warehouse has no RECEIVING area");
      const open = line.cartons - line.receivedCartons;

      // BR-02: vượt số thùng còn mở → 409 theo trường
      const over = Array.from({ length: open + 1 }, () => ({}));
      expect(
        await codeOf(
          replaceReceiptLines({
            receiptId: draft.id,
            body: {
              lines: [{ productionOrderLineId: line.id, locationCode: area, packages: over }],
            },
          }),
        ),
      ).toBe("RECEIPT_EXCEEDS_PRODUCTION_ORDER");

      const counted = await replaceReceiptLines({
        receiptId: draft.id,
        body: { lines: [{ productionOrderLineId: line.id, locationCode: area, packages: [{}] }] },
      });
      const [countedLine] = counted.lines;
      expect(countedLine?.lotNumber).toBe(order.code);
      expect(countedLine?.packages.map((p) => p.status)).toEqual(["RECEIVING"]);
      expect(countedLine?.packages[0]?.lpn).toMatch(/^LPN-\d{8}-\d{6}$/);
      expect(countedLine?.production?.thisReceiptCartons).toBe(1);

      const confirmed = await confirmGoodsReceipt(draft.id);
      expect(confirmed.status).toBe("In Putaway");
      const after = await fetchProductionOrderRef(orderId);
      expect(after.lines[0]?.receivedCartons).toBe(line.receivedCartons + 1);
    },
    FLOW_TIMEOUT_MS,
  );
});
