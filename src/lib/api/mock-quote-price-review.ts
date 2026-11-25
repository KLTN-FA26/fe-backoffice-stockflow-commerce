/**
 * Duyệt giá báo giá cho mock (kltn-docs 14 BR-10 sửa ngày 2026-11-26; BE `QuotePriceCheck`, `QuotePriceReviews`,
 * `QuoteService.send / approvePrice / rejectPrice / withdrawPriceReview`). Mỗi bậc giá của mỗi dòng đo với giá tham
 * chiếu ở chính điểm bắt đầu của bậc: giá riêng của khách cho SKU (nếu đã có bậc ở đó), không có thì giá chuẩn của quy
 * cách SKU được làm từ đó. Thấp hơn quá ngưỡng (10%) hoặc không có tham chiếu → phải duyệt. Người gửi duyệt không tự
 * duyệt / từ chối (403 QUOTE_PRICE_REVIEW_SELF). Thông báo lấy theo `messages_vi.properties` (`refusal.quote.*`).
 */

import { findCustomerPrice } from "./mock-customer-price-store";
import { refuse, refuseInvalid } from "./mock-quote-refusal";
import { wf02Sku } from "./mock-quote-seed";
import { findStandardPrice } from "./mock-standard-price-store";
import { text } from "./mock-route-utils";

import type { MockQuote } from "./mock-quote-store";

/** BE `stockflow.quotes.price-approval-percent` (application.yml, mặc định 10). */
export const PRICE_APPROVAL_PERCENT = 10;
const REASON_MAX = 500;

type Source = "CUSTOMER_PRICE" | "STANDARD_PRICE";
type Outcome = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

interface Break {
  minQuantity: number;
  unitPrice: number;
}

export interface MockPriceCheckLine {
  lineNo: number;
  sku: string;
  cartons: number;
  needsApproval: boolean;
  tiers: {
    minQuantity: number;
    unitPrice: number;
    referencePrice: number | null;
    source: Source | null;
    discountPercent: number | null;
    needsApproval: boolean;
  }[];
}

export interface MockPriceReview {
  id: string;
  revision: number;
  outcome: Outcome;
  thresholdPercent: number;
  submittedAt: string;
  submittedBy: string;
  submittedByName: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  decidedByName: string | null;
  reason: string | null;
  lines: MockPriceCheckLine[];
}

/** Người đang gọi API (mock: tài khoản demo đang đăng nhập; không có thì Sale demo). */
export interface MockActor {
  id: string;
  name: string | null;
}

/** BE `Reference.priceAt`: giá của bậc đã bắt đầu tới số thùng này; null dưới bậc đầu. */
function priceAt(breaks: readonly Break[], cartons: number): number | null {
  let price: number | null = null;
  for (const b of [...breaks].sort((x, y) => x.minQuantity - y.minQuantity)) {
    if (b.minQuantity > cartons) break;
    price = b.unitPrice;
  }
  return price;
}

const asBreaks = (tiers: readonly { minQuantity: number; unitPrice: string }[]): Break[] =>
  tiers.map((t) => ({ minQuantity: t.minQuantity, unitPrice: Number(t.unitPrice) }));

/** BE `QuotePriceCheck.of` — `discountPercent` 2 số lẻ (HALF_UP), âm khi cao hơn tham chiếu. */
export function priceCheckOf(quote: MockQuote) {
  const lines: MockPriceCheckLine[] = quote.lines.map((line) => {
    const own = findCustomerPrice(quote.customerId, line.sku);
    const sourceSku = wf02Sku(line.sku)?.sourceSku;
    const standard = sourceSku ? findStandardPrice(sourceSku) : null;
    const tiers = line.tiers.map((tier) => {
      const fromOwn = own ? priceAt(asBreaks(own.tiers), tier.minQuantity) : null;
      const fromStandard =
        fromOwn === null && standard ? priceAt(asBreaks(standard.tiers), tier.minQuantity) : null;
      const reference = fromOwn ?? fromStandard;
      if (reference === null) {
        return {
          ...tier,
          referencePrice: null,
          source: null,
          discountPercent: null,
          needsApproval: true,
        };
      }
      const discount = Math.round(((reference - tier.unitPrice) * 10_000) / reference) / 100;
      return {
        ...tier,
        referencePrice: reference,
        source: (fromOwn !== null ? "CUSTOMER_PRICE" : "STANDARD_PRICE") as Source,
        discountPercent: discount,
        // So đúng như BE: (tham chiếu − giá) × 100 > ngưỡng × tham chiếu; con số làm tròn chỉ để hiện.
        needsApproval: (reference - tier.unitPrice) * 100 > PRICE_APPROVAL_PERCENT * reference,
      };
    });
    return {
      lineNo: line.lineNo,
      sku: line.sku,
      cartons: line.cartons,
      needsApproval: tiers.some((t) => t.needsApproval),
      tiers,
    };
  });
  return {
    thresholdPercent: PRICE_APPROVAL_PERCENT,
    needsApproval: lines.some((l) => l.needsApproval),
    lines,
  };
}

const latest = (quote: MockQuote): MockPriceReview | null => quote.priceReviews?.at(-1) ?? null;

/** BE `QuoteResponse`: cờ chờ duyệt, lần gửi duyệt gần nhất, kiểm tra giá của bản nháp (chỉ DRAFT). */
export function priceReviewView(quote: MockQuote) {
  return {
    priceReviewPending: quote.priceReviewPending ?? false,
    priceReview: latest(quote),
    priceCheck: quote.status === "DRAFT" ? priceCheckOf(quote) : null,
  };
}

/** BE `QuoteService.send`, nhánh 14 BR-10: nháp ở lại DRAFT, chờ duyệt, với số liệu lúc gửi. */
export function submitForPriceReview(quote: MockQuote, actor: MockActor): MockQuote {
  const check = priceCheckOf(quote);
  quote.priceReviews = [
    ...(quote.priceReviews ?? []),
    {
      id: crypto.randomUUID(),
      revision: quote.revision,
      outcome: "PENDING",
      thresholdPercent: check.thresholdPercent,
      submittedAt: new Date().toISOString(),
      submittedBy: actor.id,
      submittedByName: actor.name,
      decidedAt: null,
      decidedBy: null,
      decidedByName: null,
      reason: null,
      lines: check.lines,
    },
  ];
  quote.priceReviewPending = true;
  quote.version += 1;
  return quote;
}

/** 409 QUOTE_PRICE_REVIEW_PENDING — sửa / gửi lại khi đang chờ duyệt (BE `refusal.quote.priceReviewPending`). */
export function refuseWhilePending(quote: MockQuote): void {
  if (quote.priceReviewPending)
    refuse(
      409,
      "QUOTE_PRICE_REVIEW_PENDING",
      `Báo giá ${quote.quoteNumber} đang chờ duyệt giá: rút lại trước khi sửa.`,
    );
}

/** Lần gửi duyệt đang chờ; không chờ → 409 QUOTE_PRICE_REVIEW_NOT_PENDING. */
export function pendingReview(quote: MockQuote): MockPriceReview {
  const review = latest(quote);
  if (!quote.priceReviewPending || review?.outcome !== "PENDING")
    refuse(
      409,
      "QUOTE_PRICE_REVIEW_NOT_PENDING",
      `Báo giá ${quote.quoteNumber} không ở trạng thái chờ duyệt giá.`,
    );
  return review;
}

/** Bốn mắt: người gửi duyệt không quyết (BE 403 QUOTE_PRICE_REVIEW_SELF). */
export function refuseSelfReview(quote: MockQuote, review: MockPriceReview, actor: MockActor) {
  if (review.submittedBy.toLowerCase() === actor.id.toLowerCase())
    refuse(
      403,
      "QUOTE_PRICE_REVIEW_SELF",
      `Bạn là người gửi duyệt báo giá ${quote.quoteNumber}: người khác duyệt hoặc từ chối giá.`,
    );
}

/** Đóng lần gửi duyệt đang chờ với kết quả; báo giá thôi chờ. */
export function decide(
  quote: MockQuote,
  review: MockPriceReview,
  outcome: Exclude<Outcome, "PENDING">,
  actor: MockActor,
  reason: string | null,
): void {
  review.outcome = outcome;
  review.decidedAt = new Date().toISOString();
  review.decidedBy = actor.id;
  review.decidedByName = actor.name;
  review.reason = reason;
  quote.priceReviewPending = false;
}

/** Ghi chú khi duyệt (tuỳ chọn) / lý do từ chối (bắt buộc), tối đa 500 ký tự. */
export function reviewText(body: Record<string, unknown>, field: "note" | "reason"): string | null {
  const value = text(body[field]);
  if (field === "reason" && !value)
    refuseInvalid(`Nhập lý do từ chối giá, tối đa ${REASON_MAX} ký tự.`, [
      { field, message: "Cần lý do.", code: "NotBlank" },
    ]);
  if (value.length > REASON_MAX)
    refuseInvalid(`Ghi chú tối đa ${REASON_MAX} ký tự.`, [
      { field, message: `Tối đa ${REASON_MAX} ký tự.`, code: "Size" },
    ]);
  return value || null;
}
