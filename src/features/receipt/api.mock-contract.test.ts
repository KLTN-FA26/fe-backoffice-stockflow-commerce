/**
 * Contract test: mock adapter phải nói đúng hợp đồng BE `GoodsReceiptController` sau 4A-8 / 4A-9 để `api.ts`
 * (zod parse + map status) chạy y hệt trên mock và BE thật. Phiếu seed của mock đều là phiếu mua hàng cũ
 * (`PURCHASE`): BE chỉ cho đọc và huỷ phiếu nháp — xác nhận trả `INVALID_RECEIPT_TRANSITION`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetReceiptMockStore } from "@/lib/api/mock-routes-goods-receipts-store";

import { cancelGoodsReceipt, confirmGoodsReceipt, getGoodsReceipt, listGoodsReceipts } from "./api";

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetReceiptMockStore();
  activateMockAdapter();
});

afterAll(() => vi.restoreAllMocks());

/** Adapter mock trễ ~350ms/lần gọi (Math.random ghim 0.5). */
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

async function firstWithStatus(status: "Draft" | "In Putaway" | "Closed") {
  const page = await listGoodsReceipts({ status: [status], size: 200 });
  const found = page.items[0];
  if (!found) throw new Error(`no ${status} receipt in the mock seed`);
  return found;
}

describe("goods receipt mock ↔ hợp đồng BE sau 4A-9", () => {
  it("danh sách parse được, đủ trạng thái docs 03 §5, không có CONFIRMED / IN_QC", async () => {
    const page = await listGoodsReceipts({ size: 200 });
    const statuses = new Set(page.items.map((r) => r.status));
    for (const status of ["Draft", "In Putaway", "Closed", "Cancelled"] as const) {
      expect(statuses).toContain(status);
    }
    expect(statuses).not.toContain("Confirmed");
    expect(page.page).toBe(0);
    // Seed sinh từ PO mock → đều là phiếu mua hàng cũ, không có Đơn sản xuất
    expect(page.items.every((r) => r.receiptType === "PURCHASE")).toBe(true);
    expect(page.items.every((r) => !r.productionOrderId)).toBe(true);
  });

  it("lọc theo status (mã BE) và search số phiếu", async () => {
    const drafts = await listGoodsReceipts({ status: ["Draft"], size: 200 });
    expect(drafts.items.every((r) => r.status === "Draft")).toBe(true);
    const first = drafts.items[0];
    if (!first) throw new Error("no draft");
    const found = await listGoodsReceipts({ search: first.number.slice(-4).toLowerCase() });
    expect(found.items.map((r) => r.id)).toContain(first.id);
  });

  it("lọc phiếu theo Đơn sản xuất / loại PRODUCTION → rỗng (seed chỉ có phiếu mua hàng cũ)", async () => {
    expect((await listGoodsReceipts({ receiptType: "PRODUCTION" })).items).toEqual([]);
    expect((await listGoodsReceipts({ productionOrderId: "any" })).items).toEqual([]);
    const purchase = await listGoodsReceipts({ receiptType: "PURCHASE", size: 200 });
    expect(purchase.items.length).toBeGreaterThan(0);
  });

  it("chi tiết parse được, kèm receiptType và dòng có thùng", async () => {
    const row = await firstWithStatus("Closed");
    const receipt = await getGoodsReceipt(row.id);
    expect(receipt).toMatchObject({ id: row.id, status: "Closed", receiptType: "PURCHASE" });
    expect(receipt.warnings).toEqual([]);
  });

  it(
    "phiếu mua hàng cũ không xác nhận được → 409 INVALID_RECEIPT_TRANSITION",
    async () => {
      const draft = await firstWithStatus("Draft");
      expect(await codeOf(confirmGoodsReceipt(draft.id))).toBe("INVALID_RECEIPT_TRANSITION");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "BR-05: chỉ huỷ được phiếu Draft; phiếu đã ghi nhận → 409",
    async () => {
      const putaway = await firstWithStatus("In Putaway");
      expect(await codeOf(cancelGoodsReceipt(putaway.id))).toBe("INVALID_RECEIPT_TRANSITION");

      const draft = await firstWithStatus("Draft");
      const cancelled = await cancelGoodsReceipt(draft.id);
      expect(cancelled.status).toBe("Cancelled");
      expect(cancelled.lines.every((line) => line.packages.length === 0)).toBe(true);
    },
    FLOW_TIMEOUT_MS,
  );

  it("phiếu không tồn tại → 404 GOODS_RECEIPT_NOT_FOUND", async () => {
    expect(await codeOf(getGoodsReceipt("missing"))).toBe("GOODS_RECEIPT_NOT_FOUND");
  });
});
