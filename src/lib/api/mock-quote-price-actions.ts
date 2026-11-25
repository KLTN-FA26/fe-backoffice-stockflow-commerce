/**
 * Ba bước duyệt giá của mock (14 BR-10; BE `QuoteService.approvePrice / rejectPrice / withdrawPriceReview`), mỗi bước
 * kiểm hết rồi mới đổi báo giá: body → báo giá → version → đang chờ duyệt → (duyệt / từ chối) không phải người gửi duyệt.
 * Duyệt: báo giá gửi khách ngay (SENT). Từ chối: lý do bắt buộc, về nháp sửa được. Rút lại: về nháp.
 */

import { viDateTime } from "./mock-quote-money";
import { decide, pendingReview, refuseSelfReview, reviewText } from "./mock-quote-price-review";
import { refuseInvalid } from "./mock-quote-refusal";
import { markSent, quoteGuards } from "./mock-quote-rules";
import { WF02_USERS } from "./mock-quote-seed";

import type { MockActor } from "./mock-quote-price-review";
import type { MockFieldError } from "./mock-quote-refusal";
import type { MockQuote } from "./mock-quote-store";

const { find, requireVersion, readVersion, requireNoErrors } = quoteGuards;

/** Tài khoản demo đang đăng nhập (như `/identity/me`); không có thì Sale demo của seed BE. */
export async function mockActor(): Promise<MockActor> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  const user = useAuthStore.getState().user;
  return user ? { id: user.userId, name: user.fullName } : { id: WF02_USERS.sales, name: null };
}

function pendingQuote(id: string, body: Record<string, unknown>) {
  const errors: MockFieldError[] = [];
  const version = readVersion(body, errors);
  requireNoErrors(errors);
  const quote = find(id);
  requireVersion(quote, version);
  return { quote, review: pendingReview(quote) };
}

/** `POST /quotes/{id}/price-approval` — duyệt giá: báo giá được gửi khách ngay. */
export function approveQuotePrice(
  id: string,
  body: Record<string, unknown>,
  actor: MockActor,
): MockQuote {
  const note = reviewText(body, "note");
  const { quote, review } = pendingQuote(id, body);
  refuseSelfReview(quote, review, actor);
  if (Date.parse(quote.validUntil) <= Date.now())
    refuseInvalid(
      `Báo giá ${quote.quoteNumber} có hiệu lực đến ${viDateTime(quote.validUntil)}, đã qua: đặt hạn hiệu lực mới trước khi gửi.`,
    );
  decide(quote, review, "APPROVED", actor, note);
  // Khách thấy báo giá như Sale đã gửi: người gửi là người gửi duyệt (BE `Quote.send` lúc duyệt)
  return markSent(quote, review.submittedBy);
}

/** `POST /quotes/{id}/price-rejection` — từ chối giá, lý do bắt buộc: báo giá về nháp sửa được. */
export function rejectQuotePrice(
  id: string,
  body: Record<string, unknown>,
  actor: MockActor,
): MockQuote {
  const reason = reviewText(body, "reason");
  const { quote, review } = pendingQuote(id, body);
  refuseSelfReview(quote, review, actor);
  decide(quote, review, "REJECTED", actor, reason);
  quote.version += 1;
  return quote;
}

/** `POST /quotes/{id}/price-review-withdrawal` — Sales rút lại yêu cầu duyệt giá để sửa. */
export function withdrawQuotePriceReview(
  id: string,
  body: Record<string, unknown>,
  actor: MockActor,
): MockQuote {
  const { quote, review } = pendingQuote(id, body);
  decide(quote, review, "WITHDRAWN", actor, null);
  quote.version += 1;
  return quote;
}
