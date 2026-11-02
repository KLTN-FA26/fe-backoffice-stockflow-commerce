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
  approveGoodsReceipt,
  cancelGoodsReceipt,
  confirmGoodsReceipt,
  createGoodsReceipt,
  createGoodsReceiptWithoutPo,
  getGoodsReceipt,
  inspectLine,
  listGoodsReceipts,
  moveLineToQc,
  referencePurchaseOrder,
  rejectBlindReceipt,
  rejectReceiptExcess,
  replaceBlindReceiptLines,
  replaceReceiptLines,
} from "./api";
import { listSupplierOptions, listWarehouseOptions } from "./lookup-api";
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
      // BR-02 / BR-RCP-001: vượt SL đặt + 5% KHÔNG bị từ chối nữa — dòng chỉ bị gắn cảnh báo OVER_TOLERANCE
      const poLine = po.lines[0];
      if (!poLine) throw new Error("no line");
      const over = await replaceReceiptLines({
        receiptId: created.id,
        lines: [{ ...line, quantity: poLine.quantityOrdered * 2 }],
      });
      expect(over.status).toBe("Draft");
      expect(over.lines[0]?.warnings).toContain("OVER_TOLERANCE");
      expect(over.warnings).toContain("OVER_TOLERANCE");
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

  it(
    "BE PR #71 D4: nhận một phần → PARTIALLY_RECEIVED; nhận nốt → RECEIVED (đóng đơn là bước riêng)",
    async () => {
      const page = await listReceivablePurchaseOrders({});
      // Đơn luồng trên đã nhận một phần (CONFIRMED → PARTIALLY_RECEIVED); nhận nốt phần còn mở.
      const target = page.items.find((po) => po.status === "PARTIALLY_RECEIVED");
      if (!target) throw new Error("mock has no partially received PO");
      const po = await getReceivablePurchaseOrder(target.purchaseOrderId);
      const created = await createGoodsReceipt({
        purchaseOrderId: po.purchaseOrderId,
        deliveryNote: "",
        note: "",
      });
      const lines = await Promise.all(
        po.lines
          .map((line, i) => [line, i] as const)
          .filter(([line]) => line.openQuantity > 0)
          .map(([line, i]) => validLine(po, i, line.openQuantity)),
      );
      await replaceReceiptLines({ receiptId: created.id, lines });
      await confirmGoodsReceipt(created.id);
      const after = await getReceivablePurchaseOrder(po.purchaseOrderId);
      expect(after.status).toBe("RECEIVED");
      expect(after.lines.every((line) => line.openQuantity === 0)).toBe(true);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "BR-RCP-001: đếm vượt dung sai → xác nhận thì chờ duyệt (chưa ghi nhận); Quản lý kho duyệt hoặc từ chối phần vượt",
    async () => {
      // Kho mock mới: các luồng trên đã nhận hết hai đơn còn nhận được. Mỗi đơn mock có một dòng PO và mỗi
      // kịch bản duyệt / từ chối phần vượt dùng hết một đơn → hai kịch bản = hai đơn.
      resetPoMockStore();
      resetReceiptMockStore();
      const page = await listReceivablePurchaseOrders({});
      const [approvePo, rejectPo] = await Promise.all(
        page.items.slice(0, 2).map((target) => getReceivablePurchaseOrder(target.purchaseOrderId)),
      );
      if (!approvePo || !rejectPo) throw new Error("mock needs two receivable POs");

      /** Phiếu đếm gấp đôi dòng PO đầu → vượt dung sai; trả về phiếu đã `Pending Approval`. */
      async function waiting(po: ReceivablePo) {
        const poLine = po.lines[0];
        if (!poLine) throw new Error("no line");
        const receipt = await createGoodsReceipt({
          purchaseOrderId: po.purchaseOrderId,
          deliveryNote: "",
          note: "",
        });
        const line = await validLine(po, 0, poLine.quantityOrdered * 2);
        await replaceReceiptLines({ receiptId: receipt.id, lines: [line] });
        const pending = await confirmGoodsReceipt(receipt.id);
        return { poLine, pending };
      }

      // Duyệt: ghi nhận ĐỦ số đã đếm
      const first = await waiting(approvePo);
      expect(first.pending.status).toBe("Pending Approval");
      expect(first.pending.confirmedAt).toBeNull();
      expect(first.pending.approval).toMatchObject({ decision: null, requestedBy: "mock-user" });
      const untouched = await getReceivablePurchaseOrder(approvePo.purchaseOrderId);
      expect(untouched.lines[0]?.quantityReceived).toBe(first.poLine.quantityReceived);
      // Chưa quyết định thì không sửa / xác nhận lại; lý do bắt buộc
      expect(await codeOf(confirmGoodsReceipt(first.pending.id))).toBe(
        "INVALID_RECEIPT_TRANSITION",
      );
      expect(await codeOf(approveGoodsReceipt({ receiptId: first.pending.id, reason: " " }))).toBe(
        "VALIDATION_FAILED",
      );
      const approved = await approveGoodsReceipt({
        receiptId: first.pending.id,
        reason: "NCC giao thêm hàng tặng",
      });
      expect(approved.status).toMatch(/^In (QC|Putaway)$/);
      expect(approved.lines[0]?.quantity).toBe(first.poLine.quantityOrdered * 2);
      expect(approved.approval).toMatchObject({
        decision: "APPROVED",
        decidedBy: "mock-manager",
        reason: "NCC giao thêm hàng tặng",
      });
      expect(approved.confirmedBy).toBe("mock-manager");
      expect(await codeOf(approveGoodsReceipt({ receiptId: approved.id, reason: "lần hai" }))).toBe(
        "INVALID_RECEIPT_TRANSITION",
      );

      // Huỷ phiếu đang chờ duyệt: chưa ghi nhận nên được phép
      const toCancel = await waiting(rejectPo);
      const cancelled = await cancelGoodsReceipt(toCancel.pending.id);
      expect(cancelled.status).toBe("Cancelled");

      // Từ chối phần vượt: chỉ ghi nhận tới dung sai CÒN LẠI — giới hạn đặt × 1.05 trừ phần các phiếu đã ghi nhận
      const second = await waiting(rejectPo);
      const limit =
        Math.floor((second.poLine.quantityOrdered * 105) / 100) - second.poLine.quantityReceived;
      const rejected = await rejectReceiptExcess({
        receiptId: second.pending.id,
        reason: "Trả lại phần vượt cho NCC",
      });
      expect(rejected.status).toMatch(/^In (QC|Putaway)$/);
      expect(rejected.lines[0]?.quantity).toBe(limit);
      expect(rejected.approval).toMatchObject({ decision: "EXCESS_REJECTED" });
      const after = await getReceivablePurchaseOrder(rejectPo.purchaseOrderId);
      expect(after.lines[0]?.quantityReceived).toBe(second.poLine.quantityReceived + limit);
    },
    FLOW_TIMEOUT_MS * 2,
  );

  it(
    "BR-RCP-002: phiếu không có PO — NCC + lý do bắt buộc, luôn chờ duyệt, duyệt ghi nhận tồn không đụng PO, từ chối huỷ cả phiếu, PO gắn sau chỉ là tham chiếu",
    async () => {
      resetPoMockStore();
      resetReceiptMockStore();
      const page = await listReceivablePurchaseOrders({});
      const [first, second] = await Promise.all(
        page.items.slice(0, 2).map((target) => getReceivablePurchaseOrder(target.purchaseOrderId)),
      );
      if (!first || !second) throw new Error("mock needs two receivable POs");
      const warehouses = await listWarehouseOptions();
      const warehouseId = warehouses[0]?.id ?? "";
      const suppliers = await listSupplierOptions();
      expect(suppliers.map((s) => s.supplierId)).toContain(first.supplierId);
      const base = { supplierId: first.supplierId, warehouseId, deliveryNote: "", note: "" };

      // Lý do + NCC bắt buộc (400), NCC lạ → 404
      expect(await codeOf(createGoodsReceiptWithoutPo({ ...base, reason: "  " }))).toBe(
        "VALIDATION_FAILED",
      );
      expect(
        await codeOf(
          createGoodsReceiptWithoutPo({ ...base, supplierId: "NOPE", reason: "quà kèm" }),
        ),
      ).toBe("SUPPLIER_NOT_FOUND");

      const draft = await createGoodsReceiptWithoutPo({
        ...base,
        reason: "quà kèm theo chuyến giao",
      });
      expect(draft).toMatchObject({
        status: "Draft",
        withoutPurchaseOrder: true,
        purchaseOrderId: null,
        blindReason: "quà kèm theo chuyến giao",
      });
      expect(draft.supplierId).toBe(first.supplierId);

      // Kiểm đếm bằng SKU: lỗi từng ô
      const sku = first.lines[0]?.sku ?? "";
      const line = {
        sku,
        quantity: 3,
        lotNumber: "",
        expiryDate: "",
        locationCode: "HCM-RCV01",
        note: "",
      };
      expect(
        await codeOf(
          replaceBlindReceiptLines({
            receiptId: draft.id,
            lines: [{ ...line, sku: "NO-SUCH-SKU" }],
          }),
        ),
      ).toBe("INVENTORY_ITEM_NOT_FOUND");
      expect(
        await codeOf(
          replaceBlindReceiptLines({
            receiptId: draft.id,
            lines: [{ ...line, locationCode: "HCM-QCA01" }],
          }),
        ),
      ).toBe("LOCATION_AREA_MISMATCH");
      // Chưa có dòng nào → không gửi duyệt được
      expect(await codeOf(confirmGoodsReceipt(draft.id))).toBe("INVALID_RECEIPT_TRANSITION");
      const policyLine = await validLine(first, 0, 3);
      const counted = await replaceBlindReceiptLines({
        receiptId: draft.id,
        lines: [{ ...line, lotNumber: policyLine.lotNumber, expiryDate: policyLine.expiryDate }],
      });
      expect(counted.lines[0]).toMatchObject({ purchaseOrderLineId: null, sku, quantity: 3 });

      // Xác nhận KHÔNG ghi nhận: luôn chờ duyệt; PO không đổi
      const pending = await confirmGoodsReceipt(draft.id);
      expect(pending.status).toBe("Pending Approval");
      expect(pending.confirmedAt).toBeNull();
      const before = await getReceivablePurchaseOrder(first.purchaseOrderId);
      expect(before.lines[0]?.quantityReceived).toBe(first.lines[0]?.quantityReceived);

      // Duyệt: ghi nhận, PO vẫn không đổi
      const approved = await approveGoodsReceipt({
        receiptId: draft.id,
        reason: "đã đối chiếu phiếu giao",
      });
      expect(approved.status).toMatch(/^In (QC|Putaway)$/);
      expect(approved.approval).toMatchObject({ decision: "APPROVED" });
      const afterApprove = await getReceivablePurchaseOrder(first.purchaseOrderId);
      expect(afterApprove.lines[0]?.quantityReceived).toBe(first.lines[0]?.quantityReceived);
      expect(afterApprove.status).toBe(first.status);

      // Gắn PO sau khi đã ghi nhận: chỉ tham chiếu; PO phải của cùng NCC
      const referenced = await referencePurchaseOrder({
        receiptId: draft.id,
        purchaseOrderId: first.purchaseOrderId,
      });
      expect(referenced.referencedPurchaseOrderId).toBe(first.purchaseOrderId);
      expect(referenced.referencedPurchaseOrderNumber).toBe(first.poNumber);
      expect(referenced.purchaseOrderId).toBeNull();
      expect(
        (await getReceivablePurchaseOrder(first.purchaseOrderId)).lines[0]?.quantityReceived,
      ).toBe(first.lines[0]?.quantityReceived);
      if (second.supplierId !== first.supplierId) {
        expect(
          await codeOf(
            referencePurchaseOrder({
              receiptId: draft.id,
              purchaseOrderId: second.purchaseOrderId,
            }),
          ),
        ).toBe("RECEIPT_REFERENCE_SUPPLIER_MISMATCH");
      }
      expect(
        await codeOf(referencePurchaseOrder({ receiptId: draft.id, purchaseOrderId: "missing" })),
      ).toBe("PURCHASE_ORDER_NOT_FOUND");

      // Từ chối: huỷ cả phiếu, quyết định REJECTED; chỉ phiếu không có PO
      const other = await createGoodsReceiptWithoutPo({ ...base, reason: "giao nhầm" });
      await replaceBlindReceiptLines({
        receiptId: other.id,
        lines: [{ ...line, lotNumber: policyLine.lotNumber, expiryDate: policyLine.expiryDate }],
      });
      await confirmGoodsReceipt(other.id);
      expect(await codeOf(rejectBlindReceipt({ receiptId: other.id, reason: " " }))).toBe(
        "VALIDATION_FAILED",
      );
      const rejected = await rejectBlindReceipt({
        receiptId: other.id,
        reason: "không phải hàng của ta",
      });
      expect(rejected.status).toBe("Cancelled");
      expect(rejected.approval).toMatchObject({
        decision: "REJECTED",
        reason: "không phải hàng của ta",
      });
      const withPo = await createGoodsReceipt({
        purchaseOrderId: second.purchaseOrderId,
        deliveryNote: "",
        note: "",
      });
      expect(await codeOf(rejectBlindReceipt({ receiptId: withPo.id, reason: "x" }))).toBe(
        "INVALID_RECEIPT_TRANSITION",
      );

      // Danh sách lọc theo loại phiếu
      const onlyBlind = await listGoodsReceipts({ withoutPo: true, size: 200 });
      expect(onlyBlind.items.length).toBeGreaterThanOrEqual(2);
      expect(onlyBlind.items.every((r) => r.withoutPurchaseOrder)).toBe(true);
      const onlyPo = await listGoodsReceipts({ withoutPo: false, size: 200 });
      expect(onlyPo.items.some((r) => r.withoutPurchaseOrder)).toBe(false);
    },
    FLOW_TIMEOUT_MS * 3,
  );

  it("phiếu không tồn tại → 404 GOODS_RECEIPT_NOT_FOUND", async () => {
    expect(await codeOf(getGoodsReceipt("missing"))).toBe("GOODS_RECEIPT_NOT_FOUND");
  });
});
