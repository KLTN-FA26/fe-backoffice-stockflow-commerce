/**
 * Contract test: mock adapter phải nói đúng hợp đồng BE `GoodsReceiptController` (PR #62) để
 * `api.ts` (zod parse + map status) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { itemPolicy, resetReceiptMockStore } from "@/lib/api/mock-routes-goods-receipts-store";
import { resetPoMockStore } from "@/lib/api/mock-routes-purchase-orders-store";
import { resetSupplierMockStore } from "@/lib/api/mock-routes-suppliers";

import {
  cancelGoodsReceipt,
  confirmGoodsReceipt,
  createGoodsReceipt,
  getGoodsReceipt,
  inspectLine,
  listGoodsReceipts,
  moveLineToQc,
  replaceReceiptLines,
} from "./api";
import { getReceivablePurchaseOrder, listReceivablePurchaseOrders } from "./receivable-po-api";

import type { ReceiptLineValues, ReceivablePo } from "./types";

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetPoMockStore();
  resetSupplierMockStore();
  resetReceiptMockStore();
  activateMockAdapter();
});

afterAll(() => vi.restoreAllMocks());

/** Adapter mock trễ ~350ms/lần gọi (Math.random ghim 0.5); luồng đủ bước gọi ~12 lần. */
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

/** Dòng kiểm đếm hợp lệ cho một dòng PO, theo chính sách lô/hạn dùng của SKU. */
async function validLine(
  po: ReceivablePo,
  index: number,
  quantity: number,
): Promise<ReceiptLineValues> {
  const poLine = po.lines[index];
  if (!poLine) throw new Error("no PO line");
  const policy = await itemPolicy(poLine.sku);
  return {
    purchaseOrderLineId: poLine.lineId,
    quantity,
    lotNumber: policy.lotTracked ? "LOT-CT-1" : "",
    expiryDate: policy.expiryTracked ? "2099-01-01" : "",
    locationCode: "HCM-RCV01",
    note: "",
  };
}

async function receivablePo(): Promise<ReceivablePo> {
  const page = await listReceivablePurchaseOrders({});
  const first = page.items[0];
  if (!first) throw new Error("mock has no receivable PO");
  return getReceivablePurchaseOrder(first.purchaseOrderId);
}

describe("goods receipt mock ↔ hợp đồng BE PR #62", () => {
  it("danh sách parse được, có đủ trạng thái để demo (không có CONFIRMED như BE)", async () => {
    const page = await listGoodsReceipts({ size: 200 });
    const statuses = new Set(page.items.map((r) => r.status));
    for (const status of ["Draft", "In QC", "In Putaway", "Closed", "Cancelled"] as const) {
      expect(statuses).toContain(status);
    }
    expect(statuses).not.toContain("Confirmed");
    expect(page.page).toBe(0);
  });

  it("lọc theo status (mã BE) và search số phiếu", async () => {
    const drafts = await listGoodsReceipts({ status: ["Draft"], size: 200 });
    expect(drafts.items.every((r) => r.status === "Draft")).toBe(true);
    const first = drafts.items[0];
    if (!first) throw new Error("no draft");
    const found = await listGoodsReceipts({ search: first.number.slice(-4).toLowerCase() });
    expect(found.items.map((r) => r.id)).toContain(first.id);
  });

  it(
    "luồng 2/3 bước: tạo → kiểm đếm → xác nhận → (QC) theo đúng luật BE",
    async () => {
      const po = await receivablePo();
      const created = await createGoodsReceipt({
        purchaseOrderId: po.purchaseOrderId,
        deliveryNote: "",
        note: "",
      });
      expect(created.status).toBe("Draft");
      expect(created.number).toMatch(/^GR-\d{8}-\d{4}$/);

      // Xác nhận phiếu chưa có dòng → INVALID_RECEIPT_TRANSITION
      expect(await codeOf(confirmGoodsReceipt(created.id))).toBe("INVALID_RECEIPT_TRANSITION");

      const line = await validLine(po, 0, 1);
      // Sai loại khu / không tồn tại
      expect(
        await codeOf(
          replaceReceiptLines({
            receiptId: created.id,
            lines: [{ ...line, locationCode: "HCM-QCA01" }],
          }),
        ),
      ).toBe("LOCATION_AREA_MISMATCH");
      expect(
        await codeOf(
          replaceReceiptLines({
            receiptId: created.id,
            lines: [{ ...line, locationCode: "NOPE" }],
          }),
        ),
      ).toBe("LOCATION_NOT_FOUND");
      // BR-02: vượt SL đặt + 5%
      const poLine = po.lines[0];
      if (!poLine) throw new Error("no line");
      expect(
        await codeOf(
          replaceReceiptLines({
            receiptId: created.id,
            lines: [{ ...line, quantity: poLine.quantityOrdered * 2 }],
          }),
        ),
      ).toBe("OVER_RECEIPT_TOLERANCE");
      // Trùng dòng PO + lô
      expect(
        await codeOf(replaceReceiptLines({ receiptId: created.id, lines: [line, line] })),
      ).toBe("VALIDATION_FAILED");

      const counted = await replaceReceiptLines({ receiptId: created.id, lines: [line] });
      expect(counted.lines).toHaveLength(1);

      const confirmed = await confirmGoodsReceipt(created.id);
      const qcLine = confirmed.lines[0];
      if (!qcLine) throw new Error("no line");
      expect(confirmed.status).toBe(qcLine.qcRequired ? "In QC" : "In Putaway");
      // Đã xác nhận → không sửa / huỷ được (BR-05)
      expect(await codeOf(cancelGoodsReceipt(created.id))).toBe("INVALID_RECEIPT_TRANSITION");

      if (qcLine.qcRequired) {
        const moved = await moveLineToQc({
          receiptId: created.id,
          lineId: qcLine.id,
          qcLocationCode: "hcm-qca01",
        });
        expect(moved.lines[0]?.qcProgress).toBe("IN_QC_AREA");
        const empty = { quantity: 0, locationCode: "", reason: "" };
        // BR-08: tổng phải bằng SL đã chuyển
        expect(
          await codeOf(
            inspectLine({
              receiptId: created.id,
              lineId: qcLine.id,
              decision: { accepted: 0, quarantined: empty, rejected: empty },
            }),
          ),
        ).toBe("QC_QUANTITY_MISMATCH");
        const done = await inspectLine({
          receiptId: created.id,
          lineId: qcLine.id,
          decision: { accepted: qcLine.quantity, quarantined: empty, rejected: empty },
        });
        expect(done.status).toBe("In Putaway");
        expect(done.lines[0]?.quantityForPutaway).toBe(qcLine.quantity);
      }
    },
    FLOW_TIMEOUT_MS,
  );

  it("phiếu In QC seed: chuyển QC chỉ cho dòng chờ, kết luận chỉ cho dòng đã ở khu QC", async () => {
    const inQc = await listGoodsReceipts({ status: ["In QC"], size: 200 });
    const details = await Promise.all(inQc.items.map((r) => getGoodsReceipt(r.id)));
    const awaiting = details.find((r) =>
      r.lines.some((l) => l.qcProgress === "AWAITING_MOVE_TO_QC"),
    );
    const inArea = details.find((r) => r.lines.some((l) => l.qcProgress === "IN_QC_AREA"));
    if (!awaiting || !inArea) throw new Error("seed thiếu phiếu In QC");
    const awaitingLine = awaiting.lines[0];
    const inAreaLine = inArea.lines[0];
    if (!awaitingLine || !inAreaLine) throw new Error("no line");
    const empty = { quantity: 0, locationCode: "", reason: "" };
    expect(
      await codeOf(
        inspectLine({
          receiptId: awaiting.id,
          lineId: awaitingLine.id,
          decision: { accepted: awaitingLine.quantity, quarantined: empty, rejected: empty },
        }),
      ),
    ).toBe("INVALID_RECEIPT_TRANSITION");
    expect(
      await codeOf(
        moveLineToQc({ receiptId: inArea.id, lineId: inAreaLine.id, qcLocationCode: "HCM-QCA01" }),
      ),
    ).toBe("INVALID_RECEIPT_TRANSITION");
  });

  it("phiếu không tồn tại → 404 GOODS_RECEIPT_NOT_FOUND", async () => {
    expect(await codeOf(getGoodsReceipt("missing"))).toBe("GOODS_RECEIPT_NOT_FOUND");
  });
});
