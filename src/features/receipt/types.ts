import type { z } from "zod";

import type { ReceiptStatus } from "@/constants";
import type {
  ReceiptLinesContext,
  buildQcDecisionSchema,
  buildReceiptLinesSchema,
  moveToQcInputSchema,
  receiptCreateInputSchema,
  receiptLineInputSchema,
} from "./input-schemas";
import type {
  beGoodsReceiptRowSchema,
  beGoodsReceiptSchema,
  beInspectionSchema,
  beReceiptLineSchema,
  receivablePoLineSchema,
  receivablePoSchema,
} from "./schemas";

/* ── DTO trên wire ───────────────────────────────────────────────────── */

export type GoodsReceiptApiDto = z.infer<typeof beGoodsReceiptSchema>;
export type GoodsReceiptRowApiDto = z.infer<typeof beGoodsReceiptRowSchema>;
export type ReceiptLineDto = z.infer<typeof beReceiptLineSchema>;
export type QcInspectionDto = z.infer<typeof beInspectionSchema>;
export type ReceivablePo = z.infer<typeof receivablePoSchema>;
export type ReceivablePoLine = z.infer<typeof receivablePoLineSchema>;

/* ── Model FE: giữ field BE, chỉ đổi `status` sang nhãn docs 03 §5.1 ─── */

export type GoodsReceipt = Omit<GoodsReceiptApiDto, "status"> & { status: ReceiptStatus };
export type GoodsReceiptRow = Omit<GoodsReceiptRowApiDto, "status"> & { status: ReceiptStatus };

/* ── Input ───────────────────────────────────────────────────────────── */

export type ReceiptCreateInput = z.input<typeof receiptCreateInputSchema>;
export type ReceiptCreateValues = z.output<typeof receiptCreateInputSchema>;
export type ReceiptLineValues = z.output<typeof receiptLineInputSchema>;
export type ReceiptLinesFormInput = z.input<ReturnType<typeof buildReceiptLinesSchema>>;
export type ReceiptLinesValues = z.output<ReturnType<typeof buildReceiptLinesSchema>>;
export type MoveToQcValues = z.output<typeof moveToQcInputSchema>;
export type QcDecisionFormInput = z.input<ReturnType<typeof buildQcDecisionSchema>>;
export type QcDecisionValues = z.output<ReturnType<typeof buildQcDecisionSchema>>;
export type { ReceiptLinesContext };

export interface SaveReceiptLinesInput {
  receiptId: string;
  lines: readonly ReceiptLineValues[];
}

export interface MoveLineToQcInput {
  receiptId: string;
  lineId: string;
  qcLocationCode: string;
}

export interface InspectLineInput {
  receiptId: string;
  lineId: string;
  decision: QcDecisionValues;
}
