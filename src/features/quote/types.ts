import type { z } from "zod";

import type { quoteFormSchema, quoteLineInputSchema } from "./form-schemas";
import type {
  customerPriceDtoSchema,
  customerSkuDtoSchema,
  priceCheckDtoSchema,
  priceCheckLineDtoSchema,
  priceCheckTierDtoSchema,
  priceReviewDtoSchema,
  quoteDtoSchema,
  quoteFeeDtoSchema,
  quoteLineDtoSchema,
  quoteRowDtoSchema,
  quoteTransitionDtoSchema,
  standardPriceSuggestionSchema,
  tierDtoSchema,
  totalsDtoSchema,
} from "./schemas";

export type Quote = z.infer<typeof quoteDtoSchema>;
export type QuoteLine = z.infer<typeof quoteLineDtoSchema>;
export type QuoteFee = z.infer<typeof quoteFeeDtoSchema>;
/** Tổng như BE trả — có thể thiếu phí / thuế / tổng khi còn khoản chưa có giá. */
export type QuoteTotalsDto = z.infer<typeof totalsDtoSchema>;
/** Tổng đủ bốn số (xem trước ở FE, hoặc tổng BE đã tính xong). */
export interface QuoteTotals {
  subtotal: number;
  fees: number;
  tax: number;
  total: number;
}
export type QuoteTier = z.infer<typeof tierDtoSchema>;
export type QuoteRow = z.infer<typeof quoteRowDtoSchema>;
export type QuoteTransition = z.infer<typeof quoteTransitionDtoSchema>;
export type CustomerSku = z.output<typeof customerSkuDtoSchema>;
export type CustomerPrice = z.infer<typeof customerPriceDtoSchema>;
export type QuoteFormValues = z.input<typeof quoteFormSchema>;
export type QuoteFormOutput = z.output<typeof quoteFormSchema>;
export type QuoteLineFormValues = z.input<typeof quoteLineInputSchema>;
export type PriceCheck = z.infer<typeof priceCheckDtoSchema>;
export type PriceCheckLine = z.infer<typeof priceCheckLineDtoSchema>;
export type PriceCheckTier = z.infer<typeof priceCheckTierDtoSchema>;
export type PriceReview = z.infer<typeof priceReviewDtoSchema>;
export type StandardPriceSuggestion = z.infer<typeof standardPriceSuggestionSchema>;
