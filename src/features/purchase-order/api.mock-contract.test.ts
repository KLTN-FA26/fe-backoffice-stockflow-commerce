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
  createPurchaseOrder,
  fetchPoStatusDashboard,
  getPurchaseOrder,
  listPoDeliveries,
  listPoDeliveryDecisions,
  listPurchaseOrders,
  listSupplierSpend,
  recordSupplierConfirmation,
  recoverPoDelivery,
  sendPurchaseOrder,
} from "./api";

const FUTURE = "2099-01-01";
const HISTORY_PAGE = { page: 0, size: 10 };

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
  it("seed 'Pending Approval' → DRAFT (BE gộp submit+approve), không phải APPROVED", async () => {
    expect((await getPurchaseOrder("PO-2026-0010")).status).toBe("DRAFT");
  });

  it("list: trang từ 0, lọc status + supplierId, list row không có lines (như BE)", async () => {
    const page = await listPurchaseOrders({ page: 0, size: 50, status: ["SENT"] });
    expect(page.page).toBe(0);
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((po) => po.status === "SENT" && po.lines.length === 0)).toBe(true);
    const bySupplier = await listPurchaseOrders({ page: 0, size: 50, supplierId: "SUP-001" });
    expect(bySupplier.items.every((po) => po.supplierId === "SUP-001")).toBe(true);
  });

  it("dashboard trả đủ 7 mã trạng thái", async () => {
    expect((await fetchPoStatusDashboard()).map((r) => r.status)).toEqual([
      "DRAFT",
      "APPROVED",
      "SENT",
      "PARTIALLY_RECEIVED",
      "CLOSED",
      "CLOSED_SHORT",
      "CANCELLED",
    ]);
  });

  it("tạo PO giữ tiền tệ đã chọn, chụp điều khoản NCC; 409 khi NCC lạ", async () => {
    const created = await createPurchaseOrder({
      supplierId: "SUP-001",
      currency: "USD",
      expectedAt: FUTURE,
      lines: [
        { sku: "SKU-NEW-1", description: "Sofa 3 chỗ xám", quantityOrdered: 3, unitPrice: 250 },
      ],
    });
    expect(created).toMatchObject({ status: "DRAFT", currency: "USD", grandTotal: 750 });
    expect(created.paymentTermDays).toBeGreaterThan(0);
    await expectApiError(
      createPurchaseOrder({
        ...{ supplierId: "NOPE", currency: "VND", expectedAt: null },
        lines: [],
      }),
      400,
      "VALIDATION_FAILED",
    );
  });

  it("duyệt → gửi NCC: trạng thái gửi QUEUED, NCC chờ phản hồi, có lần gửi mới", async () => {
    const created = await createPurchaseOrder({
      supplierId: "SUP-001",
      currency: "VND",
      expectedAt: FUTURE,
      lines: [
        { sku: "SKU-NEW-2", description: "Sofa 3 chỗ xám", quantityOrdered: 2, unitPrice: 1000 },
      ],
    });
    await approvePurchaseOrder(created.poId);
    const sent = await sendPurchaseOrder(created.poId, { expectedAt: FUTURE, reason: "" });
    expect(sent).toMatchObject({
      status: "SENT",
      deliveryStatus: "QUEUED",
      supplierConfirmationStatus: "PENDING",
    });
    // BE chỉ ghi dòng lần gửi sau khi worker gửi xong → lúc QUEUED lịch sử gửi còn trống.
    expect((await listPoDeliveries(created.poId, HISTORY_PAGE)).items).toHaveLength(0);
    const [first] = (await listPoDeliveryDecisions(created.poId, HISTORY_PAGE)).items;
    expect(first).toMatchObject({ generation: 0, reconciled: false, expectedAt: FUTURE });
  });

  it("NCC phản hồi khi thư gửi đơn còn chờ → chặn gửi (deliveryStatus SUPPRESSED)", async () => {
    const created = await createPurchaseOrder({
      supplierId: "SUP-001",
      currency: "VND",
      expectedAt: FUTURE,
      lines: [{ sku: "SKU-NEW-7", description: "Kệ sách", quantityOrdered: 1, unitPrice: 1 }],
    });
    await approvePurchaseOrder(created.poId);
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
    const created = await createPurchaseOrder({
      supplierId: "SUP-001",
      currency: "VND",
      expectedAt: FUTURE,
      lines: [
        { sku: "SKU-NEW-4", description: "Sofa 3 chỗ xám", quantityOrdered: 1, unitPrice: 1000 },
      ],
    });
    await approvePurchaseOrder(created.poId);
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

  it("BR-06: gửi NCC với ngày giao đã qua vẫn được (BE #36 9fbb90f chỉ cảnh báo)", async () => {
    const created = await createPurchaseOrder({
      supplierId: "SUP-001",
      currency: "VND",
      expectedAt: "2020-01-01",
      lines: [{ sku: "SKU-NEW-3", description: "Ghế gỗ", quantityOrdered: 1, unitPrice: 1 }],
    });
    await approvePurchaseOrder(created.poId);
    const sent = await sendPurchaseOrder(created.poId, { expectedAt: "2020-01-01", reason: "" });
    expect(sent.status).toBe("SENT");
  });

  it("dòng không có mô tả và SKU không có trong danh mục → 400 PO_LINE_DESCRIPTION_REQUIRED", async () => {
    const created = await createPurchaseOrder({
      supplierId: "SUP-001",
      currency: "VND",
      expectedAt: FUTURE,
      lines: [{ sku: "SKU-NOT-IN-CATALOG", description: "", quantityOrdered: 1, unitPrice: 1 }],
    });
    await approvePurchaseOrder(created.poId);
    await expectApiError(
      sendPurchaseOrder(created.poId, { expectedAt: FUTURE, reason: "" }),
      400,
      "PO_LINE_DESCRIPTION_REQUIRED",
    );
  });

  it("huỷ PO đã gửi NCC → xếp hàng thông báo huỷ (cancellationDeliveryStatus QUEUED)", async () => {
    const created = await createPurchaseOrder({
      supplierId: "SUP-001",
      currency: "VND",
      expectedAt: FUTURE,
      lines: [{ sku: "SKU-NEW-5", description: "Bàn trà", quantityOrdered: 1, unitPrice: 1 }],
    });
    expect(created.cancellationDeliveryStatus).toBe("NOT_REQUIRED");
    await approvePurchaseOrder(created.poId);
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
    const created = await createPurchaseOrder({
      supplierId: "SUP-001",
      currency: "VND",
      expectedAt: FUTURE,
      lines: [{ sku: "SKU-NEW-6", description: "Bàn trà", quantityOrdered: 1, unitPrice: 1 }],
    });
    const cancelled = await cancelPurchaseOrder(created.poId, "Đặt nhầm");
    expect(cancelled.cancellationDeliveryStatus).toBe("NOT_REQUIRED");
    expect((await listPoDeliveries(created.poId, HISTORY_PAGE)).items).toHaveLength(0);
  });

  it("khôi phục gửi sau lần gửi FAILED (seed SENT): trạng thái gửi về QUEUED", async () => {
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
