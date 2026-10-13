/**
 * Contract test: mock adapter phải nói đúng hợp đồng BE `PurchaseOrderController` (nhánh `test`)
 * để `api.ts` (zod parse + mapper) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetPoMockStore } from "@/lib/api/mock-routes-purchase-orders-store";
import { resetSupplierMockStore } from "@/lib/api/mock-routes-suppliers";

import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  closeShortPurchaseOrder,
  createPurchaseOrder,
  fetchPoStatusDashboard,
  getPurchaseOrder,
  listPoDeliveries,
  listPoDeliveryDecisions,
  listPurchaseOrders,
  listSupplierSpend,
  recordSupplierConfirmation,
  recoverPoDelivery,
  rejectPurchaseOrder,
  sendPurchaseOrder,
  submitPurchaseOrder,
} from "./api";

import type { CreatePoInput } from "./input-schemas";

const FUTURE = "2099-01-01";
const HISTORY_PAGE = { page: 0, size: 10 };
/** Kho HCM của seed BE demo — mock chỉ có kho này. */
const WAREHOUSE_ID = "d99123fd-2997-4751-6bb9-e10a2e6d9949";

type LineInput = CreatePoInput["lines"][number];
const draft = (line: LineInput, extra: Partial<CreatePoInput> = {}) =>
  createPurchaseOrder({
    supplierId: "SUP-001",
    warehouseId: WAREHOUSE_ID,
    currency: "VND",
    expectedAt: FUTURE,
    lines: [line],
    ...extra,
  });

/** DRAFT → PENDING_APPROVAL → APPROVED (người duyệt mock khác người gửi). */
async function approved(line: LineInput, extra: Partial<CreatePoInput> = {}) {
  const created = await draft(line, extra);
  await submitPurchaseOrder(created.poId);
  await approvePurchaseOrder(created.poId);
  return created;
}

beforeAll(() => {
  // Ghim độ trễ ngẫu nhiên + lỗi 500 ngẫu nhiên 5% của adapter để test ổn định.
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetPoMockStore();
  resetSupplierMockStore();
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

describe("PO mock ↔ hợp đồng BE", () => {
  it("seed 'Pending Approval' → PENDING_APPROVAL (BE D4 có bước chờ duyệt riêng)", async () => {
    const po = await getPurchaseOrder("PO-2026-0010");
    expect(po.status).toBe("PENDING_APPROVAL");
    expect(po.warehouseId).toBe(WAREHOUSE_ID);
  });

  it("list: trang từ 0, lọc status + supplierId, list row không có lines (như BE)", async () => {
    const page = await listPurchaseOrders({ page: 0, size: 50, status: ["CONFIRMED"] });
    expect(page.page).toBe(0);
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((po) => po.status === "CONFIRMED" && po.lines.length === 0)).toBe(true);
    const bySupplier = await listPurchaseOrders({ page: 0, size: 50, supplierId: "SUP-001" });
    expect(bySupplier.items.every((po) => po.supplierId === "SUP-001")).toBe(true);
  });

  it("dashboard trả đủ 8 mã trạng thái D4", async () => {
    expect((await fetchPoStatusDashboard()).map((r) => r.status)).toEqual([
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "CONFIRMED",
      "PARTIALLY_RECEIVED",
      "RECEIVED",
      "CLOSED",
      "CANCELLED",
    ]);
  });

  it("tạo PO: giữ tiền tệ + kho, tính thuế theo dòng, chụp điều khoản NCC; 400 khi thiếu kho", async () => {
    const created = await draft(
      {
        sku: "SKU-NEW-1",
        description: "Sofa 3 chỗ xám",
        quantityOrdered: 3,
        unitPrice: 250,
        taxRate: 10,
      },
      { currency: "USD" },
    );
    expect(created).toMatchObject({
      status: "DRAFT",
      currency: "USD",
      warehouseId: WAREHOUSE_ID,
      subtotal: 750,
      taxTotal: 75,
      grandTotal: 825,
    });
    expect(created.lines[0]).toMatchObject({ taxRate: 10, status: "OPEN" });
    expect(created.paymentTermDays).toBeGreaterThan(0);
    await expectApiError(
      createPurchaseOrder({
        supplierId: "SUP-001",
        warehouseId: "",
        currency: "VND",
        expectedAt: null,
        lines: [],
      }),
      400,
      "VALIDATION_FAILED",
    );
  });

  it("gửi duyệt → từ chối (có lý do) về DRAFT; gửi lại là revision kế tiếp", async () => {
    const created = await draft({
      sku: "SKU-NEW-8",
      description: "",
      quantityOrdered: 1,
      unitPrice: 1,
    });
    const pending = await submitPurchaseOrder(created.poId);
    expect(pending).toMatchObject({ status: "PENDING_APPROVAL", revisionNo: 0 });
    expect(pending.submittedBy).toBeTruthy();
    await expectApiError(rejectPurchaseOrder(created.poId, ""), 400, "VALIDATION_FAILED");
    const rejected = await rejectPurchaseOrder(created.poId, "Sai đơn giá");
    expect(rejected).toMatchObject({ status: "DRAFT", submittedBy: undefined });
    expect((await submitPurchaseOrder(created.poId)).revisionNo).toBe(1);
  });

  it("chưa gửi duyệt thì không duyệt được (DRAFT → APPROVED là 409)", async () => {
    const created = await draft({
      sku: "SKU-NEW-9",
      description: "",
      quantityOrdered: 1,
      unitPrice: 1,
    });
    await expectApiError(
      approvePurchaseOrder(created.poId),
      409,
      "INVALID_PURCHASE_ORDER_TRANSITION",
    );
  });

  it("duyệt → xác nhận & gửi NCC: CONFIRMED, gửi QUEUED, NCC chờ phản hồi", async () => {
    const created = await approved({
      sku: "SKU-NEW-2",
      description: "Sofa 3 chỗ xám",
      quantityOrdered: 2,
      unitPrice: 1000,
    });
    const sent = await sendPurchaseOrder(created.poId, { expectedAt: FUTURE, reason: "" });
    expect(sent).toMatchObject({
      status: "CONFIRMED",
      deliveryStatus: "QUEUED",
      supplierConfirmationStatus: "PENDING",
    });
    // BE chỉ ghi dòng lần gửi sau khi worker gửi xong → lúc QUEUED lịch sử gửi còn trống.
    expect((await listPoDeliveries(created.poId, HISTORY_PAGE)).items).toHaveLength(0);
    const [first] = (await listPoDeliveryDecisions(created.poId, HISTORY_PAGE)).items;
    expect(first).toMatchObject({ generation: 0, reconciled: false, expectedAt: FUTURE });
  });

  it("NCC phản hồi khi thư gửi đơn còn chờ → chặn gửi (deliveryStatus SUPPRESSED)", async () => {
    const created = await approved({
      sku: "SKU-NEW-7",
      description: "Kệ sách",
      quantityOrdered: 1,
      unitPrice: 1,
    });
    await sendPurchaseOrder(created.poId, { expectedAt: FUTURE, reason: "" });
    const confirmed = await recordSupplierConfirmation(created.poId, {
      status: "CONFIRMED",
      supplierReference: "",
      note: "",
    });
    expect(confirmed.deliveryStatus).toBe("SUPPRESSED");
    const realNow = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(realNow + 60_000);
    try {
      expect((await listPoDeliveries(created.poId, HISTORY_PAGE)).items).toHaveLength(0);
    } finally {
      clock.mockRestore();
    }
  });

  it("sau thời gian vận chuyển giả lập: lần gửi SENT, PO deliveryStatus DELIVERED", async () => {
    const created = await approved({
      sku: "SKU-NEW-4",
      description: "Sofa 3 chỗ xám",
      quantityOrdered: 1,
      unitPrice: 1000,
    });
    await sendPurchaseOrder(created.poId, { expectedAt: FUTURE, reason: "" });
    const realNow = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(realNow + 60_000);
    try {
      expect((await getPurchaseOrder(created.poId)).deliveryStatus).toBe("DELIVERED");
      const [attempt] = (await listPoDeliveries(created.poId, HISTORY_PAGE)).items;
      expect(attempt).toMatchObject({ status: "SENT" });
      expect(attempt?.sentAt).toBeTruthy();
    } finally {
      clock.mockRestore();
    }
  });

  it("ngày giao trước ngày đặt → 400 khi xác nhận gửi NCC (BE PR #71 `confirm`)", async () => {
    const created = await approved(
      { sku: "SKU-NEW-3", description: "Ghế gỗ", quantityOrdered: 1, unitPrice: 1 },
      { expectedAt: "2020-01-01" },
    );
    await expectApiError(
      sendPurchaseOrder(created.poId, { expectedAt: "2020-01-01", reason: "" }),
      400,
      "VALIDATION_FAILED",
    );
  });

  it("dòng không có mô tả và SKU không có trong danh mục → 400 PO_LINE_DESCRIPTION_REQUIRED", async () => {
    const created = await approved({
      sku: "SKU-NOT-IN-CATALOG",
      description: "",
      quantityOrdered: 1,
      unitPrice: 1,
    });
    await expectApiError(
      sendPurchaseOrder(created.poId, { expectedAt: FUTURE, reason: "" }),
      400,
      "PO_LINE_DESCRIPTION_REQUIRED",
    );
  });

  it("huỷ PO đã gửi NCC → xếp hàng thông báo huỷ (cancellationDeliveryStatus QUEUED)", async () => {
    const created = await approved({
      sku: "SKU-NEW-5",
      description: "Bàn trà",
      quantityOrdered: 1,
      unitPrice: 1,
    });
    expect(created.cancellationDeliveryStatus).toBe("NOT_REQUIRED");
    await sendPurchaseOrder(created.poId, { expectedAt: FUTURE, reason: "" });
    const cancelled = await cancelPurchaseOrder(created.poId, "NCC hết hàng");
    // BE cancel → suppressSupplierDelivery: thư gửi đơn còn chờ không gửi nữa; thư báo huỷ xếp hàng.
    expect(cancelled).toMatchObject({
      deliveryStatus: "SUPPRESSED",
      cancellationDeliveryStatus: "QUEUED",
    });
    const realNow = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(realNow + 60_000);
    try {
      expect((await getPurchaseOrder(created.poId)).cancellationDeliveryStatus).toBe("DELIVERED");
      const { items } = await listPoDeliveries(created.poId, HISTORY_PAGE);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ status: "SENT", templateCode: "purchase-order.cancelled" });
    } finally {
      clock.mockRestore();
    }
  });

  it("huỷ PO chưa gửi NCC → không cần thư báo huỷ", async () => {
    const created = await draft({
      sku: "SKU-NEW-6",
      description: "Bàn trà",
      quantityOrdered: 1,
      unitPrice: 1,
    });
    const cancelled = await cancelPurchaseOrder(created.poId, "Đặt nhầm");
    expect(cancelled.cancellationDeliveryStatus).toBe("NOT_REQUIRED");
    expect((await listPoDeliveries(created.poId, HISTORY_PAGE)).items).toHaveLength(0);
  });

  it("khôi phục gửi sau lần gửi FAILED (seed CONFIRMED): trạng thái gửi về QUEUED", async () => {
    const po = await getPurchaseOrder("PO-2026-0012");
    expect(po.deliveryStatus).toBe("FAILED");
    const recovered = await recoverPoDelivery(po.poId, {
      reason: "NCC báo chưa nhận",
      reconciled: true,
      acknowledgePastDue: true,
    });
    expect(recovered.deliveryStatus).toBe("QUEUED");
    const [latest] = (await listPoDeliveryDecisions(po.poId, HISTORY_PAGE)).items;
    expect(latest).toMatchObject({
      generation: 1,
      reason: "NCC báo chưa nhận",
      reconciled: true,
      acknowledgePastDue: true,
    });
  });

  it("không còn nhận hàng trên PO (/receipts đã bỏ — nhận qua phiếu nhập /goods-receipts)", async () => {
    const po = await getPurchaseOrder("PO-2026-0007");
    await expectApiError(closePurchaseOrder(po.poId), 409, "INVALID_PURCHASE_ORDER_TRANSITION");
  });

  it("đóng thiếu PARTIALLY_RECEIVED → CLOSED (SHORT_CLOSE); đóng đơn RECEIVED → CLOSED (NORMAL)", async () => {
    await expectApiError(closeShortPurchaseOrder("PO-2026-0007", ""), 400, "VALIDATION_FAILED");
    const short = await closeShortPurchaseOrder("PO-2026-0007", "NCC hết hàng");
    expect(short).toMatchObject({ status: "CLOSED", closeKind: "SHORT_CLOSE" });
    expect(short.rejectionReason).toBe("NCC hết hàng");
    const closed = await closePurchaseOrder("PO-2026-0005");
    expect(closed).toMatchObject({ status: "CLOSED", closeKind: "NORMAL" });
  });

  it("NCC xác nhận ghi một lần; ghi đè phản hồi khác → 409", async () => {
    const po = await getPurchaseOrder("PO-2026-0012");
    const confirmed = await recordSupplierConfirmation(po.poId, {
      status: "CONFIRMED",
      supplierReference: "SO-123",
      note: "",
    });
    expect(confirmed.supplierConfirmationStatus).toBe("CONFIRMED");
    await expectApiError(
      recordSupplierConfirmation(po.poId, { status: "REJECTED", supplierReference: "", note: "x" }),
      409,
      "INVALID_PURCHASE_ORDER_TRANSITION",
    );
  });

  it("chuyển trạng thái sai → 409 INVALID_PURCHASE_ORDER_TRANSITION", async () => {
    await expectApiError(
      approvePurchaseOrder("PO-2026-0012"),
      409,
      "INVALID_PURCHASE_ORDER_TRANSITION",
    );
  });

  it("báo cáo chi tiêu (BE #40): mỗi dòng một tiền tệ, lọc theo currency", async () => {
    const vnd = await listSupplierSpend({ page: 0, size: 50, currency: "VND" });
    expect(vnd.items.length).toBeGreaterThan(0);
    expect(vnd.items.every((r) => r.currency === "VND")).toBe(true);
  });
});
