import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import {
  findQuoteConversationId,
  getCustomerCreditPosition,
  getCustomerPrice,
  getQuote,
  getStandardPriceSuggestion,
  listCustomerSkus,
  listQuotes,
} from "./api";

import type { ListQuoteParams } from "./api";
import type { Quote, QuoteRow } from "./types";

export const quoteKeys = createQueryKeys<ListQuoteParams>("quotes");

export const useQuotes = createListQuery<QuoteRow, ListQuoteParams>(quoteKeys, listQuotes);
export const useQuote = createDetailQuery<Quote>(quoteKeys, getQuote);

export const customerSkuKeys = {
  all: ["customer-skus"] as const,
  byCustomer: (customerId: string) => [...customerSkuKeys.all, customerId] as const,
  price: (customerId: string, sku: string) =>
    [...customerSkuKeys.all, customerId, "price", sku] as const,
  /** Giá chuẩn của quy cách (không theo khách) — cùng gốc để làm mới chung với giá gợi ý. */
  standardPrice: (variantSku: string) =>
    [...customerSkuKeys.all, "standard-price", variantSku] as const,
};

/** SKU riêng của khách cho form báo giá. */
export function useCustomerSkus(customerId: string | undefined) {
  return useQuery({
    queryKey: customerSkuKeys.byCustomer(customerId ?? ""),
    queryFn: ({ signal }) => listCustomerSkus(customerId ?? "", signal),
    enabled: !!customerId,
    ...QUERY_TIMES.master,
  });
}

/** Giá gợi ý (giá riêng của khách) — `null` khi chưa có. */
export function useCustomerPrice(customerId: string | undefined, sku: string | undefined) {
  const code = sku?.trim().toUpperCase() ?? "";
  return useQuery({
    queryKey: customerSkuKeys.price(customerId ?? "", code),
    queryFn: ({ signal }) => getCustomerPrice(customerId ?? "", code, signal),
    enabled: !!customerId && !!code,
    ...QUERY_TIMES.master,
  });
}

/**
 * Giá chuẩn của quy cách SKU được làm từ đó (13 BR-04 sửa ngày 2026-11-26) — giá gợi ý khi khách chưa có giá riêng;
 * `null` khi quy cách chưa có giá chuẩn. `enabled` gồm quyền `catalog-standard-prices:READ` (UI-only).
 */
export function useStandardPriceSuggestion(
  variantSku: string | null | undefined,
  enabled: boolean,
) {
  const code = variantSku?.trim().toUpperCase() ?? "";
  return useQuery({
    queryKey: customerSkuKeys.standardPrice(code),
    queryFn: ({ signal }) => getStandardPriceSuggestion(code, signal),
    enabled: enabled && !!code,
    ...QUERY_TIMES.master,
  });
}

/** BO-UX-19: the conversation to open from the quote's status card (only for staff who may read chats). */
export function useQuoteConversationId(
  quote: { id: string; customerId: string },
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...quoteKeys.all, "conversation", quote.id] as const,
    queryFn: ({ signal }) => findQuoteConversationId(quote, signal),
    enabled,
    ...QUERY_TIMES.master,
  });
}

/** Hạn mức / dư nợ của khách cho khung tóm tắt form báo giá; `enabled` gồm quyền `customer-credit-profiles:READ`. */
export function useCustomerCreditPosition(customerId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...quoteKeys.all, "credit-position", customerId ?? ""] as const,
    queryFn: ({ signal }) => getCustomerCreditPosition(customerId ?? "", signal),
    enabled: enabled && !!customerId,
    ...QUERY_TIMES.detail,
  });
}
