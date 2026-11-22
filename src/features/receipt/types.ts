import type { z } from "zod";

import type { ReceiptStatus } from "@/constants";
import type { beReceiptPackageSchema, beReceiptUnitSchema } from "./carton-schemas";
import type {
  countRowSchema,
  productionReceiptCreateInputSchema,
  receiptCountInputSchema,
  receiptLinesRequestSchema,
} from "./count-schemas";
import type {
  beGoodsReceiptRowSchema,
  beGoodsReceiptSchema,
  beProductionLineProgressSchema,
  beReceiptLineSchema,
} from "./schemas";

/* ── DTO trên wire ───────────────────────────────────────────────────── */

export type GoodsReceiptApiDto = z.infer<typeof beGoodsReceiptSchema>;
export type GoodsReceiptRowApiDto = z.infer<typeof beGoodsReceiptRowSchema>;
export type ReceiptLineDto = z.infer<typeof beReceiptLineSchema>;
export type ProductionLineProgressDto = z.infer<typeof beProductionLineProgressSchema>;
export type ReceiptPackageDto = z.infer<typeof beReceiptPackageSchema>;
export type ReceiptUnitDto = z.infer<typeof beReceiptUnitSchema>;

/* ── Model FE: giữ field BE, chỉ đổi `status` sang nhãn docs 03 §5 ───── */

export type GoodsReceipt = Omit<GoodsReceiptApiDto, "status"> & { status: ReceiptStatus };
export type GoodsReceiptRow = Omit<GoodsReceiptRowApiDto, "status"> & { status: ReceiptStatus };

/* ── Input của màn lập phiếu + kiểm đếm (SCRUM-566) ──────────────────── */

export type ProductionReceiptCreateInput = z.output<typeof productionReceiptCreateInputSchema>;
export type ProductionReceiptCreateValues = z.input<typeof productionReceiptCreateInputSchema>;
export type CountRow = z.output<typeof countRowSchema>;
export type ReceiptCountFormValues = z.input<typeof receiptCountInputSchema>;

/** BE `ReceiptLinesRequest` — chỉ field FE gửi (docs 03 §4.1 bước 2). */
export type ReceiptLinesInput = z.infer<typeof receiptLinesRequestSchema>;
