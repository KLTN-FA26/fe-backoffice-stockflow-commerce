/** Kiểu của "Ước tính thử" — suy ra từ zod (`trial-schemas.ts`), không khai báo tay. */

import type { z } from "zod";

import type {
  TrialEstimateSchema,
  TrialLineInputSchema,
  TrialRunInputSchema,
} from "./trial-schemas";

export type TrialEstimate = z.infer<typeof TrialEstimateSchema>;
export type TrialLineInput = z.infer<typeof TrialLineInputSchema>;
export type TrialRunInput = z.infer<typeof TrialRunInputSchema>;
