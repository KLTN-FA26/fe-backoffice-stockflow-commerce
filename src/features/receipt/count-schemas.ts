/**
 * Goods receipt — Input schema của màn lập phiếu theo Đơn sản xuất và kiểm đếm theo thùng (docs 03 §4.1, SCRUM-566).
 * Lớp Input (api-conventions §3.1): dữ liệu form gửi đi, kèm BR refine. DTO ở `schemas.ts`.
 *
 * Mọi kiểm ở đây là UI-only — Backend phải re-check (`GoodsReceiptServiceImpl#replaceLines`).
 */

import { z } from "zod";

import { PRODUCTION_RECEIPT_LIMITS, RECEIPT_COUNT_FIELD_MESSAGES as M } from "@/constants";

/* ── Lập phiếu (BE `CreateProductionGoodsReceiptRequest`) ───────────── */

// BR-01 (docs 03 §6): một phiếu nhập = một Đơn sản xuất
export const productionReceiptCreateInputSchema = z.object({
  productionOrderId: z.string().min(1, M.productionOrderRequired),
  deliveryNote: z
    .string()
    .trim()
    .max(PRODUCTION_RECEIPT_LIMITS.deliveryNoteMax, M.deliveryNoteTooLong),
  note: z.string().trim().max(PRODUCTION_RECEIPT_LIMITS.noteMax, M.noteTooLong),
});

/* ── Kiểm đếm (BE `ReceiptLinesRequest`) ──────────────────────────────── */

/** Thùng đã dán nhãn ở lần lưu trước: bỏ chọn `keep` → thùng thành Void khi lưu (docs 03 §4.1 bước 2). */
export const countedCartonSchema = z.object({
  lpn: z.string(),
  keep: z.boolean(),
});

/**
 * Một dòng Đơn sản xuất trong form. Các field số liệu (`orderedCartons`, `receivedCartons`, `maxCartons`,
 * `unitsPerCarton`, `onReceipt`) chỉ để hiển thị và kiểm — không gửi lên BE.
 */
export const countRowSchema = z
  .object({
    productionOrderLineId: z.string(),
    sku: z.string(),
    unitsPerCarton: z.number().int(),
    orderedCartons: z.number().int(),
    /** Thùng đã nhận ở các phiếu khác (đã xác nhận) — trước phiếu này. */
    receivedCartons: z.number().int(),
    /** Số thùng tối đa phiếu này còn nhận được. */
    maxCartons: z.number().int(),
    /** Dòng đã có trên phiếu (đã từng có thùng) → không bỏ được. */
    onReceipt: z.boolean(),
    locationCode: z.string(),
    existing: z.array(countedCartonSchema),
    newCartons: z
      .number({ message: M.cartonsInvalid })
      .int(M.cartonsInvalid)
      .min(0, M.cartonsInvalid),
  })
  .superRefine((row, ctx) => {
    const total = countRowTotal(row);
    // BR-02 (docs 03 §6): số thùng nhận luỹ kế của dòng ≤ số thùng đặt — chặn, không có dung sai. Giới hạn ở đây chỉ
    // tính phiếu đã xác nhận; phiếu nháp khác do BE kiểm (`RECEIPT_EXCEEDS_PRODUCTION_ORDER`).
    if (total > row.maxCartons) {
      ctx.addIssue({
        code: "custom",
        path: ["newCartons"],
        message: M.exceedsOpen(row.maxCartons),
      });
    }
    // Docs 03 §4.1 bước 5 + BR-09: dòng đã từng có thùng không bỏ được
    if (row.onReceipt && total === 0) {
      ctx.addIssue({ code: "custom", path: ["newCartons"], message: M.lineHadCartons });
    }
    // Docs 03 §3 Input: khu nhận hàng bắt buộc với từng dòng
    if (total > 0 && !row.locationCode.trim()) {
      ctx.addIssue({ code: "custom", path: ["locationCode"], message: M.locationRequired });
    }
  });

export const receiptCountInputSchema = z
  .object({ rows: z.array(countRowSchema) })
  .superRefine((form, ctx) => {
    const counted = form.rows.filter(isCountedRow).length;
    // BR-12 (docs 03 §6): mỗi dòng nhập có ít nhất một thùng; BE `lines` @NotEmpty
    if (counted === 0) ctx.addIssue({ code: "custom", path: ["rows"], message: M.nothingCounted });
    // Docs 03 §3 Input: 1–200 dòng
    if (counted > PRODUCTION_RECEIPT_LIMITS.linesMax) {
      ctx.addIssue({ code: "custom", path: ["rows"], message: M.tooManyLines });
    }
  });

/**
 * Body BE `ReceiptLinesRequest` mà FE gửi: thùng có `lpn` = đếm lại thùng cũ, không `lpn` = thùng mới (BE cấp LPN).
 */
export const receiptLinesRequestSchema = z.object({
  lines: z
    .array(
      z.object({
        productionOrderLineId: z.string(),
        locationCode: z.string(),
        packages: z.array(z.object({ lpn: z.string().optional() })),
      }),
    )
    .min(1)
    .max(PRODUCTION_RECEIPT_LIMITS.linesMax),
});

type CountRowShape = Pick<z.input<typeof countRowSchema>, "existing" | "newCartons" | "onReceipt">;

/** Thùng của dòng trên phiếu này = thùng cũ còn giữ + thùng mới. */
export function countRowTotal(row: Pick<CountRowShape, "existing" | "newCartons">): number {
  const kept = row.existing.filter((carton) => carton.keep).length;
  return kept + (Number.isInteger(row.newCartons) ? Math.max(0, row.newCartons) : 0);
}

/** Dòng gửi lên BE: có thùng, hoặc đã có trên phiếu (gửi để BE thấy dòng vẫn còn — không gửi là bỏ dòng). */
export function isCountedRow(row: CountRowShape): boolean {
  return row.onReceipt || countRowTotal(row) > 0;
}
