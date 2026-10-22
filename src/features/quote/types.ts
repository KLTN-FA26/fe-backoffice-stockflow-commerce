import type { z } from "zod";

import type {
  quoteDtoSchema,
  quoteFormSchema,
  quoteLineDtoSchema,
  quoteLineInputSchema,
  quoteRowDtoSchema,
  quoteTransitionDtoSchema,
} from "./schemas";

export type Quote = z.infer<typeof quoteDtoSchema>;
export type QuoteLine = z.infer<typeof quoteLineDtoSchema>;
export type QuoteRow = z.infer<typeof quoteRowDtoSchema>;
export type QuoteTransition = z.infer<typeof quoteTransitionDtoSchema>;
export type QuoteFormValues = z.input<typeof quoteFormSchema>;
export type QuoteFormOutput = z.output<typeof quoteFormSchema>;
export type QuoteLineFormValues = z.input<typeof quoteLineInputSchema>;
