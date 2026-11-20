import type { z } from "zod";

import type {
  designQuoteRequestDtoSchema,
  projectQuoteRequestDtoSchema,
  projectQuoteRequestLineSchema,
  QUOTE_REQUEST_STATUSES,
} from "./schemas";

export type DesignQuoteRequest = z.infer<typeof designQuoteRequestDtoSchema>;
export type ProjectQuoteRequest = z.infer<typeof projectQuoteRequestDtoSchema>;
export type ProjectQuoteRequestLine = z.infer<typeof projectQuoteRequestLineSchema>;
export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];
/** Một dòng của hộp yêu cầu báo giá: đơn lẻ hoặc dự án. */
export type QuoteRequest = DesignQuoteRequest | ProjectQuoteRequest;
