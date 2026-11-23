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
  quoteDtoSchema,
  quotePageDtoSchema,
} from "./schemas";

import type { QuoteApiStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { CustomerPrice, CustomerSku, Quote, QuoteFormOutput, QuoteRow } from "./types";

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
  const { data } = await api.get<unknown>(QUOTES, { params: query, signal });
  return quotePageDtoSchema.parse(data);
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

export const sendQuote = ({ id, version }: QuoteActionInput) => action(id, "sending", { version });
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
