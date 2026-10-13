/**
 * Goods receipt — Input schemas (form gửi đi), mô phỏng ràng buộc request BE PR #62 và BR docs 03.
 * BE vẫn là nơi chặn cuối — FE chặn sớm để báo lỗi inline (Backend phải re-check mọi BR dưới đây).
 */

import { z } from "zod";

import { RECEIPT_FIELD_MESSAGES as MSG, RECEIPT_LIMITS } from "@/constants";
import { isoDate } from "@/lib/validation/primitives";

const optionalText = (max: number) => z.string().trim().max(max, MSG.tooLong).default("");

/** Mã vị trí BE so khớp sau khi `trim().toUpperCase()` (GoodsReceiptServiceImpl#area). */
const locationCodeInput = z
  .string()
  .trim()
  .min(1, MSG.locationRequired)
  .max(RECEIPT_LIMITS.codeMax, MSG.tooLong)
  .transform((code) => code.toUpperCase());

/* ── Tạo phiếu ───────────────────────────────────────────────────────── */

// BR-01 (docs 03 §6): chỉ tạo cho PO đã chốt — FE lọc ở combobox, BE chặn bằng requireReceivable
export const receiptCreateInputSchema = z.object({
  purchaseOrderId: z.string().min(1, MSG.purchaseOrderRequired),
  deliveryNote: optionalText(RECEIPT_LIMITS.deliveryNoteMax),
  note: optionalText(RECEIPT_LIMITS.noteMax),
});

/* ── Kiểm đếm ────────────────────────────────────────────────────────── */

export const receiptLineInputSchema = z.object({
  purchaseOrderLineId: z.string().min(1),
  quantity: z.number({ message: MSG.quantity }).int(MSG.quantity).positive(MSG.quantity),
  lotNumber: optionalText(RECEIPT_LIMITS.codeMax),
  // "" = không nhập; BE nhận LocalDate yyyy-MM-dd
  expiryDate: z.union([z.literal(""), isoDate]).default(""),
  locationCode: locationCodeInput,
  note: optionalText(RECEIPT_LIMITS.lineNoteMax),
});

/** Cách SKU của dòng PO được theo dõi (docs 01). Chưa biết → không ép ở FE. */
export interface LineTracking {
  lotTracked?: boolean;
  expiryTracked?: boolean;
}

export interface ReceiptLinesContext {
  /** Ngày nhận (yyyy-MM-dd, giờ VN) — mốc của BR-06. */
  receivedOn: string;
  /** SL tối đa nhận được của từng dòng PO trên phiếu này (đã trừ phiếu khác). Thiếu → bỏ qua. */
  limitByPoLine?: Readonly<Record<string, number>>;
  trackingByPoLine?: Readonly<Record<string, LineTracking>>;
}

/** Schema kiểm đếm phụ thuộc ngữ cảnh (ngày nhận, giới hạn, cách theo dõi SKU). */
export function buildReceiptLinesSchema(ctx: ReceiptLinesContext) {
  return z
    .object({
      lines: z
        .array(receiptLineInputSchema)
        .min(1, MSG.linesRequired)
        .max(RECEIPT_LIMITS.linesMax, MSG.linesTooMany),
    })
    .superRefine(({ lines }, issue) => {
      const totals = new Map<string, number>();
      const seenLots = new Set<string>();
      lines.forEach((line, index) => {
        const at = (field: string) => ["lines", index, field];
        // BE GoodsReceipt#requireDistinctLines (uk_goods_receipt_lines_lot): mỗi cặp dòng PO + lô
        // chỉ một dòng — gộp cả SL của một lô vào một dòng
        const lotKey = `${line.purchaseOrderLineId}|${line.lotNumber}`;
        if (seenLots.has(lotKey)) {
          issue.addIssue({ code: "custom", path: at("lotNumber"), message: MSG.duplicateLot });
        }
        seenLots.add(lotKey);
        const tracking = ctx.trackingByPoLine?.[line.purchaseOrderLineId];
        // BR-03 (docs 03 §6): SKU theo dõi lô / hạn dùng → bắt buộc nhập mới cho Confirmed
        if (tracking?.lotTracked && !line.lotNumber) {
          issue.addIssue({ code: "custom", path: at("lotNumber"), message: MSG.lotRequired });
        }
        if (tracking?.expiryTracked && !line.expiryDate) {
          issue.addIssue({ code: "custom", path: at("expiryDate"), message: MSG.expiryRequired });
        }
        // BR-06 (docs 03 §6): hạn dùng phải > ngày nhận (so chuỗi ISO yyyy-MM-dd)
        if (line.expiryDate && line.expiryDate <= ctx.receivedOn) {
          issue.addIssue({
            code: "custom",
            path: at("expiryDate"),
            message: MSG.expiryNotAfterReceipt,
          });
        }
        totals.set(
          line.purchaseOrderLineId,
          (totals.get(line.purchaseOrderLineId) ?? 0) + line.quantity,
        );
      });
      // BR-02 (docs 03 §6): luỹ kế một dòng PO ≤ SL đặt × (1 + dung sai) — một dòng PO tách nhiều lô
      lines.forEach((line, index) => {
        const limit = ctx.limitByPoLine?.[line.purchaseOrderLineId];
        const total = totals.get(line.purchaseOrderLineId) ?? 0;
        if (limit !== undefined && total > limit) {
          issue.addIssue({
            code: "custom",
            path: ["lines", index, "quantity"],
            message: MSG.overLimit,
          });
        }
      });
    });
}

/* ── QC ──────────────────────────────────────────────────────────────── */

export const moveToQcInputSchema = z.object({
  qcLocationCode: locationCodeInput,
});

const qcQuantity = z.number({ message: MSG.qcQuantity }).int(MSG.qcQuantity).min(0, MSG.qcQuantity);

const qcPartInput = z.object({
  quantity: qcQuantity,
  locationCode: z.string().trim().max(RECEIPT_LIMITS.codeMax, MSG.tooLong).default(""),
  reason: z.string().trim().max(RECEIPT_LIMITS.qcReasonMax, MSG.tooLong).default(""),
});

/** Kết luận QC cho một dòng đã ở khu QC; `movedQuantity` = SL đã chuyển sang khu QC. */
export function buildQcDecisionSchema(movedQuantity: number) {
  return z
    .object({ accepted: qcQuantity, quarantined: qcPartInput, rejected: qcPartInput })
    .superRefine(({ accepted, quarantined, rejected }, issue) => {
      // BR-08 (docs 03 §6): Accepted + Quarantine + Rejected = SL đã chuyển sang khu QC
      if (accepted + quarantined.quantity + rejected.quantity !== movedQuantity) {
        issue.addIssue({ code: "custom", path: ["accepted"], message: MSG.qcSum });
      }
      // BR-08: phần Quarantine / Rejected bắt buộc có lý do (và khu cách ly nhận hàng)
      for (const key of ["quarantined", "rejected"] as const) {
        const part = key === "quarantined" ? quarantined : rejected;
        if (part.quantity === 0) continue;
        if (!part.locationCode) {
          issue.addIssue({
            code: "custom",
            path: [key, "locationCode"],
            message: MSG.qcLocationRequired,
          });
        }
        if (!part.reason) {
          issue.addIssue({ code: "custom", path: [key, "reason"], message: MSG.qcReasonRequired });
        }
      }
      // BE: một lô không thể vừa QUARANTINE vừa BLOCKED ở cùng một vị trí (GoodsReceiptServiceImpl#inspect)
      if (
        quarantined.quantity > 0 &&
        rejected.quantity > 0 &&
        quarantined.locationCode &&
        quarantined.locationCode.toUpperCase() === rejected.locationCode.toUpperCase()
      ) {
        issue.addIssue({
          code: "custom",
          path: ["rejected", "locationCode"],
          message: MSG.qcSameLocation,
        });
      }
    });
}
