/**
 * Mock báo giá theo thùng (WF-02 pha A) — chạy qua axios thật + lớp api của `features/quote` / `features/order`, nên kiểm
 * luôn hình response parse được bằng zod của màn hình. Số liệu DS-02a của plan WF02-FE §3 (VAT 8% của NĐ 174/2025 tới hết
 * 2026 — ngày được ghim ở 19/11/2026): 60 thùng × 1.000 × 1.150 + phí khuôn 1.500.000 + VAT = 76.140.000 đ.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelQuote,
  convertQuote,
  createQuote,
  getCustomerPrice,
  getQuote,
  getQuotePdf,
  listCustomerSkus,
  listQuotes,
  reviseQuote,
  sendQuote,
  updateQuote,
} from "@/features/quote/api";
import { quoteFormSchema } from "@/features/quote/form-schemas";
import { getOrder } from "@/features/order/api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { resetWf02OrderMockStore } from "./mock-contract-orders";
import { resetContractMockStore } from "./mock-contract-store";
import { resetCustomerPriceMockStore } from "./mock-customer-price-store";
import { activateMockAdapter } from "./mock-adapter";
import { resetPaymentMockStore } from "./mock-payment-store";
import {
  WF02_DEMO_CUSTOMER_ID,
  WF02_TSM_CUSTOMER_ID,
  XANH_SKU,
  addDays,
  vnDay,
} from "./mock-quote-seed";
import { mockQuotes, resetQuoteMockStore } from "./mock-quote-store";

import type { Quote, QuoteFormValues } from "@/features/quote/types";

const originalAdapter = api.defaults.adapter;
const QT_9001 = "1600be93-80dd-a049-8727-200af2bff2b2";
const SO_900001 = "18a05a36-cbcf-93d9-afb5-7b69d242383d";

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected request to fail");
}

/** Giá trị form chưa qua zod — để mô phỏng thứ form FE đã chặn nhưng BE vẫn phải từ chối. */
function rawForm(over: Partial<QuoteFormValues> = {}): QuoteFormValues {
  return {
    customerId: WF02_DEMO_CUSTOMER_ID,
    validUntil: addDays(vnDay(), 10),
    requestedDeliveryDate: addDays(vnDay(), 21),
    terms: "",
    lines: [{ sku: XANH_SKU, cartons: "60", hasCustomerPrice: true, tiers: [] }],
    plateFees: [],
    shippingFee: "",
    hasShippingFee: false,
    ...over,
  };
}

function form(over: Partial<QuoteFormValues> = {}) {
  return quoteFormSchema.parse(rawForm(over));
}

/** Báo giá DS-02a đã gửi: lập (bậc giá từ giá riêng) → nhập phí khuôn 1.500.000 → gửi. */
async function sentQuote(): Promise<Quote> {
  const draft = await createQuote({ requestId: crypto.randomUUID(), values: form() });
  const priced = await updateQuote({
    id: draft.id,
    version: draft.version,
    values: form({ plateFees: [{ sku: XANH_SKU, amount: "1500000" }] }),
  });
  return sendQuote({ id: priced.id, version: priced.version });
}

/** Khách chấp nhận (route của storefront — cách đưa báo giá sang ACCEPTED khi chạy mock). */
async function accept(quote: Quote, lines?: { lineId: string; cartons: number }[]) {
  const { data } = await api.post<unknown>(`/quotes/${quote.id}/acceptance`, {
    version: quote.version,
    ...(lines ? { lines } : {}),
  });
  return data;
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T03:00:00Z"));
  activateMockAdapter();
});
beforeEach(() => {
  resetQuoteMockStore();
  resetWf02OrderMockStore();
  resetContractMockStore();
  resetCustomerPriceMockStore();
  resetPaymentMockStore();
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("seed BE (V20261124000600, V20261203000100)", () => {
  it("danh sách: hai báo giá đã chuyển đơn, lọc theo khách / trạng thái / số báo giá", async () => {
    const all = await listQuotes({ page: 0, size: 20 });
    expect(all.items.map((q) => q.quoteNumber).sort()).toEqual([
      "QT-20261120-9001",
      "QT-20261202-9002",
    ]);
    expect(all.items.every((q) => q.status === "CONVERTED" && q.convertedOrderId)).toBe(true);
    const tsm = await listQuotes({ page: 0, size: 20, customerId: WF02_TSM_CUSTOMER_ID });
    expect(tsm.items.map((q) => q.quoteNumber)).toEqual(["QT-20261202-9002"]);
    expect((await listQuotes({ page: 0, status: ["DRAFT"] })).items).toHaveLength(0);
    expect((await listQuotes({ page: 0, search: "9001" })).items).toHaveLength(1);
  });

  it("QT-20261120-9001: VAT 10% ghi cứng của seed → 77.550.000; đơn đã tạo đang chờ ký hợp đồng", async () => {
    const quote = await getQuote(QT_9001);
    expect(quote.proposed).toEqual({
      subtotal: 69_000_000,
      fees: 1_500_000,
      tax: 7_050_000,
      total: 77_550_000,
    });
    expect(quote.accepted?.total).toBe(77_550_000);
    expect(quote.lines[0]).toMatchObject({ moq: 20, proposedUnitPrice: 1150, units: 60_000 });
    expect(quote.convertedOrder).toMatchObject({
      orderId: SO_900001,
      orderNumber: "SO-20261120-900001",
      status: "PENDING_CONTRACT",
      total: 77_550_000,
    });
    expect(quote.history.map((h) => h.toStatus)).toEqual([
      "DRAFT",
      "SENT",
      "ACCEPTED",
      "CONVERTED",
    ]);
  });

  it("form: SKU riêng + giá gợi ý của khách demo; khách khác không thấy SKU của khách demo", async () => {
    const skus = await listCustomerSkus(WF02_DEMO_CUSTOMER_ID);
    expect(skus.map((s) => s.sku)).toEqual([XANH_SKU]);
    expect(await listCustomerSkus(WF02_TSM_CUSTOMER_ID)).toEqual([
      expect.objectContaining({ sku: "LY-GIAY-DEMO-12OZ-TSM", status: "ACTIVE" }),
    ]);
    const price = await getCustomerPrice(WF02_DEMO_CUSTOMER_ID, XANH_SKU);
    expect(price?.moq).toBe(20);
    expect(price?.tiers.map((t) => t.unitPrice)).toEqual([1250, 1150, 1050]);
  });
});

describe("POST /quotes", () => {
  it("bỏ trống bậc giá = giá riêng; SKU sản xuất lần đầu có dòng phí khuôn chưa có tiền → chưa có tổng", async () => {
    const quote = await createQuote({ requestId: crypto.randomUUID(), values: form() });
    expect(quote.status).toBe("DRAFT");
    expect(quote.quoteNumber).toBe("QT-20261119-0001");
    expect(quote.version).toBe(0);
    expect(quote.lines[0]?.tiers.map((t) => t.minQuantity)).toEqual([20, 50, 100]);
    expect(quote.lines[0]?.taxRate).toBe(8);
    expect(quote.fees).toEqual([
      expect.objectContaining({ kind: "PLATE_FEE", sku: XANH_SKU, amount: null, taxRate: 8 }),
    ]);
    // Như BE: chỉ còn phần đã có (`subtotal`), thiếu fees / tax / total.
    expect(quote.proposed?.subtotal).toBeGreaterThan(0);
    expect(quote.proposed?.total).toBeNull();
    expect(quote.proposedTotal).toBeNull();
  });

  it("idempotent theo requestId: bấm lại trả cùng báo giá; cùng requestId khác khách → 422", async () => {
    const requestId = crypto.randomUUID();
    const first = await createQuote({ requestId, values: form() });
    const again = await createQuote({ requestId, values: form() });
    expect(again.id).toBe(first.id);
    expect(mockQuotes()).toHaveLength(3);
    const reused = await errorOf(
      createQuote({ requestId, values: form({ customerId: WF02_TSM_CUSTOMER_ID }) }),
    );
    expect([reused.status, reused.code]).toEqual([422, "IDEMPOTENCY_KEY_REUSED"]);
  });

  it("dưới MOQ → QUOTE_BELOW_MOQ kèm details; SKU không phải của khách → CUSTOMER_SKU_REQUIRED", async () => {
    const below = await errorOf(
      createQuote({
        requestId: crypto.randomUUID(),
        values: rawForm({
          lines: [
            {
              sku: XANH_SKU,
              cartons: "10",
              hasCustomerPrice: false,
              tiers: [{ minQuantity: "20", unitPrice: "1250" }],
            },
          ],
        }),
      }),
    );
    expect([below.status, below.code]).toEqual([409, "QUOTE_BELOW_MOQ"]);
    expect(below.details).toEqual({ lineNo: 1, sku: XANH_SKU, cartons: 10, moq: 20 });
    expect(below.message).toBe(
      `Dòng 1 (${XANH_SKU}): 10 thùng thấp hơn số lượng đặt tối thiểu (MOQ) là 20 thùng.`,
    );
    const foreign = await errorOf(
      createQuote({
        requestId: crypto.randomUUID(),
        values: form({
          lines: [{ sku: "SKU-001-BLK-L", cartons: "5", hasCustomerPrice: true, tiers: [] }],
        }),
      }),
    );
    expect(foreign.code).toBe("CUSTOMER_SKU_REQUIRED");
    expect(foreign.fieldErrors).toHaveProperty(["lines[0].sku"]);
  });
});

describe("gửi, sửa, version", () => {
  it("phí khuôn chưa có tiền → QUOTE_NOT_PRICED; thiếu hẳn dòng phí khuôn → QUOTE_PLATE_FEE_MISSING", async () => {
    const draft = await createQuote({ requestId: crypto.randomUUID(), values: form() });
    const unpriced = await errorOf(sendQuote({ id: draft.id, version: draft.version }));
    expect([unpriced.status, unpriced.code]).toEqual([409, "QUOTE_NOT_PRICED"]);
    const stored = mockQuotes().find((q) => q.id === draft.id);
    if (stored) stored.fees = [];
    const missing = await errorOf(sendQuote({ id: draft.id, version: draft.version }));
    expect(missing.code).toBe("QUOTE_PLATE_FEE_MISSING");
  });

  it("DS-02a: phí khuôn 1.500.000 → 69.000.000 + 1.500.000 + VAT 5.640.000 = 76.140.000; gửi được", async () => {
    const sent = await sentQuote();
    expect(sent.status).toBe("SENT");
    expect(sent.version).toBe(2);
    expect(sent.proposed).toEqual({
      subtotal: 69_000_000,
      fees: 1_500_000,
      tax: 5_640_000,
      total: 76_140_000,
    });
  });

  it("sửa / gửi bằng version cũ → OPTIMISTIC_LOCK; báo giá đã gửi không sửa được", async () => {
    const sent = await sentQuote();
    const stale = await errorOf(sendQuote({ id: sent.id, version: 0 }));
    expect([stale.status, stale.code]).toEqual([409, "OPTIMISTIC_LOCK"]);
    const edit = await errorOf(updateQuote({ id: sent.id, version: sent.version, values: form() }));
    expect(edit.code).toBe("INVALID_QUOTE_TRANSITION");
  });
});

describe("khách trả lời → chuyển đơn", () => {
  it("chấp nhận dưới MOQ bị chặn; 60 thùng → ACCEPTED; huỷ báo giá đã chấp nhận (SKU còn bán) bị từ chối", async () => {
    const sent = await sentQuote();
    const lineId = sent.lines[0]?.id ?? "";
    const below = await errorOf(accept(sent, [{ lineId, cartons: 10 }]));
    expect(below.code).toBe("QUOTE_BELOW_MOQ");
    await accept(sent);
    const accepted = await getQuote(sent.id);
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.accepted?.total).toBe(76_140_000);
    const cancel = await errorOf(
      cancelQuote({ id: accepted.id, version: accepted.version, reason: "Khách đổi ý" }),
    );
    expect(cancel.code).toBe("INVALID_QUOTE_TRANSITION");
  });

  it("báo giá cũ đã chấp nhận (QD-16): không tạo đơn được, huỷ được dù khách còn hoạt động và SKU còn bán", async () => {
    const sent = await sentQuote();
    await accept(sent);
    const stored = mockQuotes().find((q) => q.id === sent.id);
    if (!stored) throw new Error("quote not stored");
    stored.legacy = true;
    const accepted = await getQuote(sent.id);
    expect([accepted.status, accepted.legacy]).toEqual(["ACCEPTED", true]);
    const convert = await errorOf(convertQuote({ id: accepted.id, version: accepted.version }));
    expect(convert.code).toBe("QUOTE_LINES_LEGACY");
    const cancelled = await cancelQuote({
      id: accepted.id,
      version: accepted.version,
      reason: "Báo giá cũ, lập lại theo SKU của khách",
    });
    expect([cancelled.status, cancelled.cancellationReason]).toEqual([
      "CANCELLED",
      "Báo giá cũ, lập lại theo SKU của khách",
    ]);
  });

  it("chuyển đơn: đơn NHÁP ở số thùng đã chấp nhận; gọi lại trả cùng đơn; đơn parse được ở màn đơn", async () => {
    const sent = await sentQuote();
    await accept(sent);
    const accepted = await getQuote(sent.id);
    const converted = await convertQuote({ id: accepted.id, version: accepted.version });
    expect(converted.status).toBe("CONVERTED");
    const orderId = converted.convertedOrder?.orderId ?? "";
    expect(converted.convertedOrder).toMatchObject({ status: "DRAFT", total: 76_140_000 });
    const again = await convertQuote({ id: accepted.id, version: accepted.version });
    expect(again.convertedOrder?.orderId).toBe(orderId);
    const order = await getOrder(orderId);
    expect(order.orderNumber).toBe("SO-20261119-000001");
    expect(order.lines[0]).toMatchObject({ sku: XANH_SKU, quantity: 60_000, cartons: 60 });
  });

  it("yêu cầu sửa → mở bản sửa: DRAFT, bản sửa 2, phản hồi của khách xoá khỏi báo giá", async () => {
    const sent = await sentQuote();
    await api.post(`/quotes/${sent.id}/change-request`, {
      version: sent.version,
      feedback: "Giảm giá bậc 50 thùng",
    });
    const asked = await getQuote(sent.id);
    expect([asked.status, asked.customerFeedback]).toEqual([
      "CHANGES_REQUESTED",
      "Giảm giá bậc 50 thùng",
    ]);
    const revised = await reviseQuote({ id: asked.id, version: asked.version });
    expect([revised.status, revised.revision, revised.customerFeedback]).toEqual([
      "DRAFT",
      2,
      null,
    ]);
  });

  it("huỷ nháp cần lý do; PDF là blob", async () => {
    const draft = await createQuote({ requestId: crypto.randomUUID(), values: form() });
    const cancelled = await cancelQuote({ id: draft.id, version: 0, reason: "Lập nhầm" });
    expect([cancelled.status, cancelled.cancellationReason]).toEqual(["CANCELLED", "Lập nhầm"]);
    const pdf = await getQuotePdf(QT_9001);
    expect(pdf).toBeInstanceOf(Blob);
    expect(pdf.type).toBe("application/pdf");
  });
});
