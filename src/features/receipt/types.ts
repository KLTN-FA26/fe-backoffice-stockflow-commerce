import type { z } from "zod";

import type { ReceiptStatus } from "@/constants";
import type {
  ReceiptLinesContext,
  buildQcDecisionSchema,
  buildReceiptLinesSchema,
  moveToQcInputSchema,
  blindLineInputSchema,
  buildBlindLinesSchema,
  receiptCreateInputSchema,
  receiptCreateWithoutPoInputSchema,
  receiptDecisionInputSchema,
  receiptLineInputSchema,
} from "./input-schemas";
import type {
  beGoodsReceiptRowSchema,
  beGoodsReceiptSchema,
  beInspectionSchema,
  beReceiptApprovalSchema,
  beReceiptLineSchema,
  receivablePoLineSchema,
  receivablePoSchema,
  supplierOptionSchema,
  warehouseOptionSchema,
} from "./schemas";

/* ── DTO trên wire ───────────────────────────────────────────────────── */

export type GoodsReceiptApiDto = z.infer<typeof beGoodsReceiptSchema>;
export type GoodsReceiptRowApiDto = z.infer<typeof beGoodsReceiptRowSchema>;
export type ReceiptLineDto = z.infer<typeof beReceiptLineSchema>;
export type QcInspectionDto = z.infer<typeof beInspectionSchema>;
export type ReceiptApprovalDto = z.infer<typeof beReceiptApprovalSchema>;
export type ReceivablePo = z.infer<typeof receivablePoSchema>;
export type ReceivablePoLine = z.infer<typeof receivablePoLineSchema>;
export type SupplierOption = z.infer<typeof supplierOptionSchema>;
export type WarehouseOption = z.infer<typeof warehouseOptionSchema>;

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
export type ReceiptCreateWithoutPoInput = z.input<typeof receiptCreateWithoutPoInputSchema>;
export type ReceiptCreateWithoutPoValues = z.output<typeof receiptCreateWithoutPoInputSchema>;
export type BlindLineValues = z.output<typeof blindLineInputSchema>;
export type BlindLinesFormInput = z.input<ReturnType<typeof buildBlindLinesSchema>>;
export type BlindLinesValues = z.output<ReturnType<typeof buildBlindLinesSchema>>;
export type ReceiptDecisionValues = z.output<typeof receiptDecisionInputSchema>;
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

/** Phiếu không có PO: các dòng gọi hàng bằng SKU (BR-RCP-002). */
export interface SaveBlindLinesInput {
  receiptId: string;
  lines: readonly BlindLineValues[];
}

export interface ReferencePurchaseOrderInput {
  receiptId: string;
  purchaseOrderId: string;
}

export interface DecideReceiptInput {
  receiptId: string;
  reason: string;
}

export interface InspectLineInput {
  receiptId: string;
  lineId: string;
  decision: QcDecisionValues;
}
