import type { z } from "zod";

import type { quoteFormSchema, quoteLineInputSchema } from "./form-schemas";
import type {
  customerPriceDtoSchema,
  customerSkuDtoSchema,
  quoteDtoSchema,
  quoteFeeDtoSchema,
  quoteLineDtoSchema,
  quoteRowDtoSchema,
  quoteTransitionDtoSchema,
  tierDtoSchema,
  totalsDtoSchema,
} from "./schemas";

export type Quote = z.infer<typeof quoteDtoSchema>;
export type QuoteLine = z.infer<typeof quoteLineDtoSchema>;
export type QuoteFee = z.infer<typeof quoteFeeDtoSchema>;
export type QuoteTotals = z.infer<typeof totalsDtoSchema>;
export type QuoteTier = z.infer<typeof tierDtoSchema>;
export type QuoteRow = z.infer<typeof quoteRowDtoSchema>;
export type QuoteTransition = z.infer<typeof quoteTransitionDtoSchema>;
export type CustomerSku = z.infer<typeof customerSkuDtoSchema>;
export type CustomerPrice = z.infer<typeof customerPriceDtoSchema>;
export type QuoteFormValues = z.input<typeof quoteFormSchema>;
export type QuoteFormOutput = z.output<typeof quoteFormSchema>;
export type QuoteLineFormValues = z.input<typeof quoteLineInputSchema>;
