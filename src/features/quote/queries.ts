import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getQuote, listQuotes } from "./api";

import type { ListQuoteParams } from "./api";
import type { Quote, QuoteRow } from "./types";

export const quoteKeys = createQueryKeys<ListQuoteParams>("quotes");

export const useQuotes = createListQuery<QuoteRow, ListQuoteParams>(quoteKeys, listQuotes);
export const useQuote = createDetailQuery<Quote>(quoteKeys, getQuote);
