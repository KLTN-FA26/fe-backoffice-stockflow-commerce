/**
 * Báo giá theo thùng — API layer (BE `QuoteController`, origin/develop 438fe6fb). Parse tại biên.
 * Mọi lệnh ghi gửi `version` đang hiển thị → BE 409 OPTIMISTIC_LOCK nếu đã cũ (plan WF-02 §1.4).
 */

import { z } from "zod";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { toQuoteBody } from "./form-body";
import {
  customerPriceDtoSchema,
  customerSkuListDtoSchema,
  quoteCreditPositionSchema,
  quoteDtoSchema,
  quotePageDtoSchema,
  quoteStatusCountsDtoSchema,
  standardPriceSuggestionSchema,
} from "./schemas";

import type { QuoteApiStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  CustomerPrice,
  CustomerSku,
  Quote,
  QuoteCreditPosition,
  QuoteFormOutput,
  QuoteRow,
  QuoteStatusCounts,
  StandardPriceSuggestion,
} from "./types";

const QUOTES = "/quotes";
const byId = (id: string) => `${QUOTES}/${encodeURIComponent(id)}`;

export interface ListQuoteParams extends ListQueryParams {
  page?: number;
  size?: number;
  search?: string;
  status?: QuoteApiStatus[];
  customerId?: string;
  /** `createdAt|validUntil|quoteNumber|status[,asc|desc]`. */
  sort?: string;
  /** 14 BR-10: `PENDING` = chỉ nháp đang chờ duyệt giá (hàng chờ của Quản lý kinh doanh). */
  priceReview?: "PENDING";
}

export async function listQuotes(
  params: ListQuoteParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<QuoteRow>> {
  // Trang 0-based trên dây (PageResponse BE).
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 15),
  });
  if (params.search?.trim()) query.set("search", params.search.trim());
  for (const status of params.status ?? []) query.append("status", status);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.sort) query.set("sort", params.sort);
  if (params.priceReview) query.set("priceReview", params.priceReview);
  const { data } = await api.get<unknown>(QUOTES, { params: query, signal });
  return quotePageDtoSchema.parse(data);
}

/** Bộ lọc của số đếm theo trạng thái — cùng tên tham số với danh sách (không có trang / sắp xếp). */
export type QuoteStatusCountParams = Pick<
  ListQuoteParams,
  "search" | "status" | "customerId" | "priceReview"
>;

/**
 * `GET /quotes/status-counts` (audit bo-06): số báo giá theo trạng thái, tổng và số nháp chờ duyệt giá, cùng bộ lọc và
 * phạm vi với danh sách. `null` = không có số (400 / 404: BE chưa có endpoint — PR #497 chưa vào; 403) → tab không số.
 */
export async function getQuoteStatusCounts(
  params: QuoteStatusCountParams,
  signal?: AbortSignal,
): Promise<QuoteStatusCounts | null> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  for (const status of params.status ?? []) query.append("status", status);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.priceReview) query.set("priceReview", params.priceReview);
  try {
    const { data } = await api.get<unknown>(`${QUOTES}/status-counts`, { params: query, signal });
    return quoteStatusCountsDtoSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiError && [400, 403, 404].includes(error.status)) return null;
    throw error;
  }
}

export async function getQuote(id: string, signal?: AbortSignal): Promise<Quote> {
  const { data } = await api.get<unknown>(byId(id), { signal });
  return quoteDtoSchema.parse(data);
}

/** `GET /quotes/{id}/document` — PDF báo giá. */
export async function getQuotePdf(id: string): Promise<Blob> {
  const { data } = await api.get<Blob>(`${byId(id)}/document`, {
    responseType: "blob",
    headers: { Accept: "application/pdf, application/json" },
  });
  return data;
}

/** `requestId` sinh ở FE, giữ nguyên khi bấm lại → BE trả cùng báo giá (idempotent). */
export async function createQuote(input: {
  requestId: string;
  values: QuoteFormOutput;
}): Promise<Quote> {
  const { data } = await api.post<unknown>(QUOTES, {
    requestId: input.requestId,
    customerId: input.values.customerId,
    ...toQuoteBody(input.values),
  });
  return quoteDtoSchema.parse(data);
}

export async function updateQuote(input: {
  id: string;
  version: number;
  values: QuoteFormOutput;
}): Promise<Quote> {
  const { data } = await api.put<unknown>(byId(input.id), {
    version: input.version,
    ...toQuoteBody(input.values),
  });
  return quoteDtoSchema.parse(data);
}

export interface QuoteActionInput {
  id: string;
  version: number;
}

async function action(id: string, path: string, body: object): Promise<Quote> {
  const { data } = await api.post<unknown>(`${byId(id)}/${path}`, body);
  return quoteDtoSchema.parse(data);
}

/**
 * DRAFT → SENT; hoặc (14 BR-10) báo giá ở lại `DRAFT` với `priceReviewPending: true` khi có bậc giá thấp hơn giá tham
 * chiếu quá ngưỡng hoặc không có giá tham chiếu — màn hình đọc response để biết đã gửi khách hay gửi duyệt.
 */
export const sendQuote = ({ id, version }: QuoteActionInput) => action(id, "sending", { version });
/** 14 BR-10: Quản lý kinh doanh duyệt giá → báo giá gửi khách ngay (SENT). Người gửi duyệt không tự duyệt (403). */
export const approveQuotePrice = ({ id, version, note }: QuoteActionInput & { note?: string }) =>
  action(id, "price-approval", { version, ...(note?.trim() ? { note: note.trim() } : {}) });
/** 14 BR-10: từ chối giá, lý do bắt buộc → báo giá trở về nháp sửa được. */
export const rejectQuotePrice = ({ id, version, reason }: QuoteActionInput & { reason: string }) =>
  action(id, "price-rejection", { version, reason });
/** 14 BR-10: Sales rút lại yêu cầu duyệt giá để sửa báo giá (`sales-quotes:UPDATE`). */
export const withdrawQuotePriceReview = ({ id, version }: QuoteActionInput) =>
  action(id, "price-review-withdrawal", { version });
export const reviseQuote = ({ id, version }: QuoteActionInput) =>
  action(id, "revision", { version });
export const cancelQuote = ({ id, version, reason }: QuoteActionInput & { reason: string }) =>
  action(id, "cancellation", { version, reason });
/** ACCEPTED → CONVERTED + đơn DRAFT; gọi lại trả cùng đơn (BE idempotent). */
export const convertQuote = ({
  id,
  version,
  shippingAddressId,
  billingAddressId,
}: QuoteActionInput & { shippingAddressId?: string; billingAddressId?: string }) =>
  action(id, "conversion", {
    version,
    ...(shippingAddressId ? { shippingAddressId } : {}),
    ...(billingAddressId ? { billingAddressId } : {}),
  });

/** SKU riêng của khách (`product-variants:READ`). */
export async function listCustomerSkus(
  customerId: string,
  signal?: AbortSignal,
): Promise<CustomerSku[]> {
  const { data } = await api.get<unknown>("/customer-skus", { params: { customerId }, signal });
  return customerSkuListDtoSchema.parse(data);
}

/** Giá riêng của khách cho SKU; `null` = chưa có (404) → Sale phải nhập bậc giá. */
export async function getCustomerPrice(
  customerId: string,
  sku: string,
  signal?: AbortSignal,
): Promise<CustomerPrice | null> {
  try {
    const { data } = await api.get<unknown>(
      `/catalog/customer-prices/${encodeURIComponent(customerId)}/${encodeURIComponent(sku)}`,
      { signal },
    );
    return customerPriceDtoSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Giá chuẩn của quy cách SKU được làm từ đó (`GET /catalog/standard-prices/{sku}`, `catalog-standard-prices:READ`) — giá
 * gợi ý khi khách chưa có giá riêng (13 BR-04 sửa ngày 2026-11-26). `null` = quy cách chưa có giá chuẩn (404) hoặc người
 * dùng không được xem giá chuẩn (403): khi đó Sale nhập bậc giá như trước.
 */
export async function getStandardPriceSuggestion(
  variantSku: string,
  signal?: AbortSignal,
): Promise<StandardPriceSuggestion | null> {
  try {
    const { data } = await api.get<unknown>(
      `/catalog/standard-prices/${encodeURIComponent(variantSku)}`,
      { signal },
    );
    return standardPriceSuggestionSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null;
    throw error;
  }
}

const conversationRefSchema = z.object({ items: z.array(z.object({ id: z.string() })) });

/**
 * BO-UX-19: the chat conversation where the customer answers this quote — the one about the quote
 * (`contextKind=QUOTE`), else the customer's latest open one (BE `GET /chat/conversations`, `chat-conversations:READ`).
 * `null` when the customer has none.
 */
export async function findQuoteConversationId(
  quote: Pick<Quote, "id" | "customerId">,
  signal?: AbortSignal,
): Promise<string | null> {
  const first = async (params: Record<string, string>) => {
    const { data } = await api.get<unknown>("/chat/conversations", {
      params: { ...params, size: "1" },
      signal,
    });
    return conversationRefSchema.parse(data).items[0]?.id ?? null;
  };
  return (
    (await first({ contextKind: "QUOTE", contextId: quote.id })) ??
    (await first({ customerId: quote.customerId }))
  );
}

/**
 * Hạn mức và dư nợ của khách (`GET /orders/credit-position/{customerId}`, BE `CreditHoldController#position`,
 * `customer-credit-profiles:READ` — Sales có) cho khung tóm tắt của form báo giá: Sale thấy trước khi gửi khách đã dùng
 * bao nhiêu hạn mức, còn khoản quá hạn không.
 */
export async function getCustomerCreditPosition(
  customerId: string,
  signal?: AbortSignal,
): Promise<QuoteCreditPosition> {
  const { data } = await api.get<unknown>(
    `/orders/credit-position/${encodeURIComponent(customerId)}`,
    { signal },
  );
  return quoteCreditPositionSchema.parse(data);
}
