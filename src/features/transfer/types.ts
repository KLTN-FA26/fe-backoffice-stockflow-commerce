import type { z } from "zod";

import type {
  buildDispatchSchema,
  transferFormSchema,
  transferLineInputSchema,
  transferReasonInputSchema,
} from "./input-schemas";
import type { beTransferLineSchema, beTransferOrderSchema, beTransferRowSchema } from "./schemas";

/* ── DTO ─────────────────────────────────────────────────────────────── */

export type TransferOrder = z.infer<typeof beTransferOrderSchema>;
export type TransferOrderRow = z.infer<typeof beTransferRowSchema>;
export type TransferLine = z.infer<typeof beTransferLineSchema>;

/* ── Input ───────────────────────────────────────────────────────────── */

export type TransferFormInput = z.input<typeof transferFormSchema>;
export type TransferFormValues = z.output<typeof transferFormSchema>;
export type TransferLineValues = z.output<typeof transferLineInputSchema>;
export type TransferReasonValues = z.output<typeof transferReasonInputSchema>;
export type TransferDispatchValues = z.output<ReturnType<typeof buildDispatchSchema>>;

export interface UpdateTransferInput {
  transferId: string;
  version: number;
  values: TransferFormValues;
}

export interface TransferReasonInput {
  transferId: string;
  reason: string;
}

export interface DispatchTransferInput {
  transferId: string;
  lines: TransferDispatchValues["lines"];
}
