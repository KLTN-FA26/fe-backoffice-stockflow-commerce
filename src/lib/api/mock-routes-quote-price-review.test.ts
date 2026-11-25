/**
 * Mock duyệt giá báo giá (kltn-docs 14 BR-10, 13 BR-04 sửa ngày 2026-11-26) — chạy qua axios thật + lớp api của
 * `features/quote` / `features/standard-price`, nên kiểm luôn hình response parse được bằng zod của màn hình. Giá riêng
 * của khách demo cho `LY-GIAY-DEMO-12OZ-XANH`: 20/50/100 thùng = 1.250/1.150/1.050 đ; giá chuẩn của quy cách
 * `LY-GIAY-DEMO-12OZ`: 10/20/50/100 thùng = 1.300/1.250/1.150/1.050 đ; ngưỡng 10%.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  approveQuotePrice,
  cancelQuote,
  createQuote,
  getQuote,
  listQuotes,
  rejectQuotePrice,
  sendQuote,
  updateQuote,
  withdrawQuotePriceReview,
} from "@/features/quote/api";
import { quoteFormSchema } from "@/features/quote/form-schemas";
import {
  createStandardPrice,
  deleteStandardPrice,
  listStandardPrices,
  updateStandardPrice,
} from "@/features/standard-price/api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import { resetWf02OrderMockStore } from "./mock-contract-orders";
import { deleteCustomerPrice, resetCustomerPriceMockStore } from "./mock-customer-price-store";
import { activateMockAdapter } from "./mock-adapter";
import { WF02_DEMO_CUSTOMER_ID, WF02_USERS, XANH_SKU, addDays, vnDay } from "./mock-quote-seed";
import { resetQuoteMockStore } from "./mock-quote-store";
import { resetStandardPriceMockStore } from "./mock-standard-price-store";

import type { Quote, QuoteFormValues } from "@/features/quote/types";

const originalAdapter = api.defaults.adapter;
const MANAGER = "aaaa0000-0000-4000-8000-00000000000a";

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected request to fail");
}

function signInAs(userId: string, fullName: string) {
  useAuthStore.setState({
    user: {
      userId,
      fullName,
      email: "t@example.com",
      roles: [],
      username: fullName,
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
    impersonatedRole: null,
  });
}

function form(tiers: { minQuantity: string; unitPrice: string }[]) {
  const raw: QuoteFormValues = {
    customerId: WF02_DEMO_CUSTOMER_ID,
    validUntil: addDays(vnDay(), 10),
    requestedDeliveryDate: addDays(vnDay(), 21),
    terms: "",
    lines: [{ sku: XANH_SKU, cartons: "60", hasCustomerPrice: true, tiers }],
    plateFees: [{ sku: XANH_SKU, amount: "1500000" }],
    shippingFee: "",
    hasShippingFee: false,
  };
  return quoteFormSchema.parse(raw);
}

/** Nháp đã đủ giá + phí khuôn, sẵn sàng gửi. */
async function draft(tiers: { minQuantity: string; unitPrice: string }[]): Promise<Quote> {
  const created = await createQuote({ requestId: crypto.randomUUID(), values: form([]) });
  return updateQuote({ id: created.id, version: created.version, values: form(tiers) });
}

/** Bậc 20 thùng 1.000 đ — thấp hơn giá riêng 1.250 đ là 20% (> 10%). */
const LOW = [{ minQuantity: "20", unitPrice: "1000" }];

beforeAll(() => {
  // Mock server có lỗi ngẫu nhiên 5% — ghim như mock-routes-quotes.test.ts
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T03:00:00Z"));
  activateMockAdapter();
});
beforeEach(() => {
  resetQuoteMockStore();
  resetWf02OrderMockStore();
  resetCustomerPriceMockStore();
  resetStandardPriceMockStore();
  signInAs(WF02_USERS.sales, "Sale demo");
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("kiểm tra giá của nháp (14 BR-10)", () => {
  it("bậc thấp hơn giá riêng quá ngưỡng → cần duyệt; bậc cao hơn không cần", async () => {
    const quote = await draft([...LOW, { minQuantity: "50", unitPrice: "1200" }]);
    expect(quote.priceReviewPending).toBe(false);
    expect(quote.priceCheck).toMatchObject({ thresholdPercent: 10, needsApproval: true });
    expect(quote.priceCheck?.lines[0]?.tiers).toEqual([
      expect.objectContaining({
        minQuantity: 20,
        referencePrice: 1250,
        source: "CUSTOMER_PRICE",
        discountPercent: 20,
        needsApproval: true,
      }),
      expect.objectContaining({ minQuantity: 50, referencePrice: 1150, needsApproval: false }),
    ]);
  });

  it("khách không có giá riêng: bậc giá bỏ trống lấy giá chuẩn, đo với giá chuẩn → gửi thẳng khách", async () => {
    deleteCustomerPrice(WF02_DEMO_CUSTOMER_ID, XANH_SKU);
    const created = await createQuote({ requestId: crypto.randomUUID(), values: form([]) });
    expect(created.lines[0]?.tiers.map((t) => t.minQuantity)).toEqual([10, 20, 50, 100]);
    const priced = await updateQuote({
      id: created.id,
      version: created.version,
      values: form([]),
    });
    expect(priced.priceCheck?.needsApproval).toBe(false);
    expect(priced.priceCheck?.lines[0]?.tiers[0]).toMatchObject({ source: "STANDARD_PRICE" });
    const sent = await sendQuote({ id: priced.id, version: priced.version });
    expect([sent.status, sent.priceReviewPending]).toEqual(["SENT", false]);
  });

  it("không có giá tham chiếu nào → cần duyệt", async () => {
    deleteCustomerPrice(WF02_DEMO_CUSTOMER_ID, XANH_SKU);
    const standard = (await listStandardPrices())[0];
    await deleteStandardPrice({ sku: "LY-GIAY-DEMO-12OZ", version: standard?.version ?? 0 });
    // Bỏ trống bậc giá giờ bị từ chối (không có gì để lấy) — Sale nhập bậc giá
    const empty = await errorOf(createQuote({ requestId: crypto.randomUUID(), values: form([]) }));
    expect([empty.status, empty.code]).toEqual([400, "VALIDATION_FAILED"]);
    const quote = await createQuote({
      requestId: crypto.randomUUID(),
      values: form([{ minQuantity: "20", unitPrice: "1500" }]),
    });
    expect(quote.priceCheck?.lines[0]?.tiers[0]).toMatchObject({
      referencePrice: null,
      source: null,
      needsApproval: true,
    });
  });
});

describe("gửi duyệt → duyệt / từ chối / rút lại", () => {
  it("gửi ở lại nháp chờ duyệt, khoá sửa; hàng chờ lọc được; người gửi không tự duyệt; người khác duyệt → gửi khách", async () => {
    const quote = await draft(LOW);
    const waiting = await sendQuote({ id: quote.id, version: quote.version });
    expect([waiting.status, waiting.priceReviewPending]).toEqual(["DRAFT", true]);
    expect(waiting.priceReview).toMatchObject({
      outcome: "PENDING",
      submittedBy: WF02_USERS.sales,
      submittedByName: "Sale demo",
    });
    const queue = await listQuotes({ page: 0, priceReview: "PENDING" });
    expect(queue.items.map((row) => [row.id, row.priceReviewPending])).toEqual([[quote.id, true]]);

    const edit = await errorOf(
      updateQuote({ id: waiting.id, version: waiting.version, values: form(LOW) }),
    );
    expect([edit.status, edit.code]).toEqual([409, "QUOTE_PRICE_REVIEW_PENDING"]);
    const self = await errorOf(approveQuotePrice({ id: waiting.id, version: waiting.version }));
    expect([self.status, self.code]).toEqual([403, "QUOTE_PRICE_REVIEW_SELF"]);

    signInAs(MANAGER, "Quản lý KD");
    const approved = await approveQuotePrice({
      id: waiting.id,
      version: waiting.version,
      note: "Khách lấy số lượng lớn",
    });
    expect([approved.status, approved.priceReviewPending]).toEqual(["SENT", false]);
    expect(approved.priceReview).toMatchObject({
      outcome: "APPROVED",
      decidedBy: MANAGER,
      decidedByName: "Quản lý KD",
      reason: "Khách lấy số lượng lớn",
    });
    expect(approved.priceCheck).toBeNull();
    expect((await listQuotes({ page: 0, priceReview: "PENDING" })).items).toHaveLength(0);
  });

  it("từ chối cần lý do; bị từ chối thì về nháp sửa được", async () => {
    const quote = await draft(LOW);
    const waiting = await sendQuote({ id: quote.id, version: quote.version });
    signInAs(MANAGER, "Quản lý KD");
    const blank = await errorOf(
      rejectQuotePrice({ id: waiting.id, version: waiting.version, reason: " " }),
    );
    expect([blank.status, blank.code]).toEqual([400, "VALIDATION_FAILED"]);
    const rejected = await rejectQuotePrice({
      id: waiting.id,
      version: waiting.version,
      reason: "Giá thấp quá",
    });
    expect([rejected.status, rejected.priceReviewPending]).toEqual(["DRAFT", false]);
    expect(rejected.priceReview).toMatchObject({ outcome: "REJECTED", reason: "Giá thấp quá" });
    const edited = await updateQuote({
      id: rejected.id,
      version: rejected.version,
      values: form([{ minQuantity: "20", unitPrice: "1250" }]),
    });
    expect(edited.priceCheck?.needsApproval).toBe(false);
  });

  it("Sales rút lại; huỷ lúc đang chờ rút lần gửi duyệt với lý do huỷ; không chờ thì 409 NOT_PENDING", async () => {
    const quote = await draft(LOW);
    const waiting = await sendQuote({ id: quote.id, version: quote.version });
    const withdrawn = await withdrawQuotePriceReview({ id: waiting.id, version: waiting.version });
    expect([withdrawn.priceReviewPending, withdrawn.priceReview?.outcome]).toEqual([
      false,
      "WITHDRAWN",
    ]);
    const again = await errorOf(
      withdrawQuotePriceReview({ id: withdrawn.id, version: withdrawn.version }),
    );
    expect([again.status, again.code]).toEqual([409, "QUOTE_PRICE_REVIEW_NOT_PENDING"]);

    const resent = await sendQuote({ id: withdrawn.id, version: withdrawn.version });
    const cancelled = await cancelQuote({
      id: resent.id,
      version: resent.version,
      reason: "Khách thôi",
    });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.priceReview).toMatchObject({ outcome: "WITHDRAWN", reason: "Khách thôi" });
    expect((await getQuote(cancelled.id)).priceReviewPending).toBe(false);
  });
});

describe("giá chuẩn (13 BR-04)", () => {
  it("seed + tạo / sửa / xoá; SKU riêng của khách và SKU lạ bị từ chối", async () => {
    const [seed] = await listStandardPrices();
    expect(seed).toMatchObject({
      sku: "LY-GIAY-DEMO-12OZ",
      productName: "Ly giấy 2 lớp in logo (demo)",
      moq: 10,
    });
    expect(seed?.tiers.map((t) => t.unitPrice)).toEqual(["1300", "1250", "1150", "1050"]);

    const owned = await errorOf(
      createStandardPrice({
        sku: XANH_SKU,
        values: { tiers: [{ minQuantity: 1, unitPrice: "1000" }], note: null },
      }),
    );
    expect([owned.status, owned.code]).toEqual([409, "STANDARD_PRICE_VARIANT_REQUIRED"]);
    const unknown = await errorOf(
      createStandardPrice({
        sku: "KHONG-CO-SKU",
        values: { tiers: [{ minQuantity: 1, unitPrice: "1000" }], note: null },
      }),
    );
    expect([unknown.status, unknown.code]).toEqual([404, "VARIANT_NOT_FOUND"]);
    const duplicate = await errorOf(
      createStandardPrice({
        sku: "LY-GIAY-DEMO-12OZ",
        values: { tiers: [{ minQuantity: 1, unitPrice: "1000" }], note: null },
      }),
    );
    expect([duplicate.status, duplicate.code]).toEqual([409, "CONFLICT"]);

    const updated = await updateStandardPrice({
      sku: "LY-GIAY-DEMO-12OZ",
      version: seed?.version ?? 0,
      values: { tiers: [{ minQuantity: 5, unitPrice: "1400" }], note: "Mới" },
    });
    expect([updated.version, updated.moq, updated.note]).toEqual([1, 5, "Mới"]);
    const stale = await errorOf(
      updateStandardPrice({
        sku: "LY-GIAY-DEMO-12OZ",
        version: 0,
        values: { tiers: [{ minQuantity: 5, unitPrice: "1400" }], note: null },
      }),
    );
    expect([stale.status, stale.code]).toEqual([409, "OPTIMISTIC_LOCK"]);
    await deleteStandardPrice({ sku: "LY-GIAY-DEMO-12OZ", version: 1 });
    expect(await listStandardPrices()).toEqual([]);
  });
});
