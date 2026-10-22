import type { z } from "zod";

import type {
  sampleCreateInputSchema,
  sampleDetailDtoSchema,
  sampleRoundDtoSchema,
  sampleRowDtoSchema,
  sampleSpecInputSchema,
} from "./schemas";

export type SampleRow = z.infer<typeof sampleRowDtoSchema>;
export type SampleDetail = z.infer<typeof sampleDetailDtoSchema>;
export type SampleRound = z.infer<typeof sampleRoundDtoSchema>;
export type SampleCreateValues = z.input<typeof sampleCreateInputSchema>;
export type SampleCreateOutput = z.output<typeof sampleCreateInputSchema>;
export type SampleSpecValues = z.input<typeof sampleSpecInputSchema>;
export type SampleSpecOutput = z.output<typeof sampleSpecInputSchema>;
