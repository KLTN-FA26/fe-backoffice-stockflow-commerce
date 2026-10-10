/**
 * Purchase Order — Input schemas (form gửi đi). BR sống ở đây, mỗi BR có cite
 * `BR-xx (docs 02 §6)`; giả định chưa chốt đánh dấu `ASSUMPTION (open-question Xn)`.
 * Ràng buộc lấy đúng bean validation + domain rule của BE nhánh `test`.
 */

import { z } from "zod";

import { PO_LIMITS, UI_LABELS } from "@/constants";
import { currencyFractionDigits, fitsCurrencyScale } from "@/lib/format";
import { intQty, isoDate, money, requiredString } from "@/lib/validation/primitives";

/** BR-07 / ASSUMPTION (open-question A4): FE hỗ trợ VND / USD / CNY cho PO mới. */
export const PO_INPUT_CURRENCIES = ["VND", "USD", "CNY"] as const;
/** BE `product.variants.sku` (`ck_variants_sku`): mã được trim + upper-case rồi phải khớp mẫu này. */
export const SKU_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
/** BE: lý do khôi phục / đổi ngày giao 1..1000 ký tự. */
export const PO_REASON_MAX = PO_LIMITS.reasonMax;

const reason = z
  .string()
  .trim()
  .min(1, "Nhập lý do")
  .max(PO_REASON_MAX, `Lý do tối đa ${PO_REASON_MAX} ký tự`);

/* ── Tạo PO — BE CreatePurchaseOrderRequest ─────────────────────────── */

export const poLineInputSchema = z.object({
  // BR-01 (docs 02 §6): SKU phải có inventory item — BE trả 404 INVENTORY_ITEM_NOT_FOUND (PR #71).
  // FE kiểm định dạng mã giống BE; danh mục SKU: `GET /products/{id}/variants`.
  sku: requiredString(UI_LABELS.purchaseOrder.validation.skuRequired).regex(
    SKU_CODE_PATTERN,
    "Mã SKU không đúng định dạng",
  ),
  // BE PR #71: bỏ trống thì BE lấy tên sản phẩm của SKU (SKU luôn thuộc một sản phẩm).
  // BE `purchase_order_lines.note VARCHAR(255)`.
  description: z
    .string()
    .trim()
    .max(PO_LIMITS.lineDescriptionMax, `Mô tả tối đa ${PO_LIMITS.lineDescriptionMax} ký tự`),
  // BE CreatePOLineRequest: `int quantityOrdered` @Positive.
  quantityOrdered: intQty("Số lượng phải là số nguyên > 0").max(
    PO_LIMITS.quantityMax,
    "Số lượng vượt giới hạn cho phép",
  ),
  // BE PR #71 `ck_purchase_order_lines_price`: đơn giá > 0.
  unitPrice: money("Đơn giá phải lớn hơn 0").refine((v) => v > 0, "Đơn giá phải lớn hơn 0"),
  // BE PR #71: thuế suất % theo dòng (0..100), bỏ trống = 0.
  taxRate: z.number().min(0, "Thuế suất 0–100%").max(100, "Thuế suất 0–100%").nullable().optional(),
});

export const createPoSchema = z
  .object({
    supplierId: requiredString(UI_LABELS.purchaseOrder.validation.supplierRequired), // UUID — BE kiểm
    // SCRUM-390 (docs 02 §3): kho nhận bắt buộc, cố định sau khi tạo.
    warehouseId: requiredString(UI_LABELS.purchaseOrder.validation.warehouseRequired),
    note: z
      .string()
      .trim()
      .max(PO_LIMITS.noteMax, `Ghi chú tối đa ${PO_LIMITS.noteMax} ký tự`)
      .optional(),
    // BR-07 (docs 02 §6): một PO một loại tiền — `currency` chỉ ở cấp PO; BE chặn
    // line ≠ order currency. NCC không còn mang tiền tệ (BE #36) nên chọn trên form.
    currency: z.enum(PO_INPUT_CURRENCIES),
    // BR-06 (docs 02 §6): ngày giao trong quá khứ chỉ CẢNH BÁO (`isExpectedDatePast`), không chặn.
    expectedAt: isoDate.nullable(),
    lines: z.array(poLineInputSchema).min(1, "Phải có ít nhất 1 dòng hàng"),
  })
  // ASSUMPTION (chưa có open-question): docs không nói về SKU trùng trong cùng PO và BE cho
  // phép; FE chặn để tránh 2 dòng cùng SKU khó đối chiếu khi nhận hàng (BR-04).
  .refine((po) => new Set(po.lines.map((l) => l.sku)).size === po.lines.length, {
    message: UI_LABELS.purchaseOrder.validation.skuDuplicate,
    path: ["lines"],
  })
  // BR-07 (docs 02 §6) + BE `Money`: đơn giá làm tròn HALF_UP về số chữ số thập phân của
  // tiền tệ PO (VND: số nguyên). Chặn ở FE để tổng hiển thị khớp tổng BE lưu.
  .superRefine((po, ctx) => {
    po.lines.forEach((line, i) => {
      if (!fitsCurrencyScale(line.unitPrice, po.currency)) {
        ctx.addIssue({
          code: "custom",
          message: unitPriceScaleMessage(po.currency),
          path: ["lines", i, "unitPrice"],
        });
      }
    });
  });

/** Câu lỗi khi đơn giá lẻ hơn mức tiền tệ cho phép. */
export function unitPriceScaleMessage(currency: string): string {
  const digits = currencyFractionDigits(currency);
  return digits === 0
    ? `Đơn giá ${currency} phải là số nguyên`
    : `Đơn giá ${currency} tối đa ${digits} chữ số thập phân`;
}

/* ── Huỷ / đóng thiếu / từ chối duyệt ────────────────────────────────── */

export const closeReasonInputSchema = z
  .string()
  .trim()
  .min(1, "Nhập lý do")
  .max(PO_LIMITS.closeReasonMax, `Lý do tối đa ${PO_LIMITS.closeReasonMax} ký tự`);

export const rejectReasonInputSchema = z
  .string()
  .trim()
  .min(1, "Nhập lý do từ chối")
  .max(PO_LIMITS.rejectReasonMax, `Lý do tối đa ${PO_LIMITS.rejectReasonMax} ký tự`);

/* ── Xác nhận = gửi NCC — BE SendPurchaseOrderRequest + PurchaseOrder#confirm ── */

/**
 * `currentExpectedAt` = ngày giao đang lưu trên PO.
 * BE `PurchaseOrder#confirmDeliveryDate` (#36 9fbb90f): ngày giao phải CÓ (thiếu →
 * `PO_DELIVERY_DATE_REQUIRED`); đổi ngày thì bắt buộc lý do 1..1000 (`PO_REASON_REQUIRED`).
 * BR-06 (docs 02 §6): ngày đã qua chỉ CẢNH BÁO — BE không chặn nữa, trả `warnings`.
 */
export function sendPoInputSchema(currentExpectedAt: string | null, orderDate?: string) {
  return (
    z
      .object({ expectedAt: isoDate, reason: z.string().trim().max(PO_REASON_MAX) })
      .refine((v) => v.expectedAt === currentExpectedAt || v.reason.length > 0, {
        message: "Đổi ngày giao cần ghi lý do",
        path: ["reason"],
      })
      // BE PR #71 `PurchaseOrder#confirm`: ngày giao không được trước ngày đặt (400). Đã qua so
      // với HÔM NAY nhưng sau ngày đặt thì vẫn chỉ cảnh báo (BR-06).
      .refine((v) => !orderDate || v.expectedAt >= orderDate, {
        message: "Ngày giao không được trước ngày đặt hàng",
        path: ["expectedAt"],
      })
  );
}

/* ── Khôi phục gửi NCC — BE RecoverPurchaseOrderDeliveryRequest ─────── */

export function recoverDeliveryInputSchema(needsPastDueAck: boolean) {
  return (
    z
      .object({ reason, reconciled: z.boolean(), acknowledgePastDue: z.boolean() })
      // BE requireDeliveryRecovery: phải đối chiếu kết quả lần gửi trước.
      .refine((v) => v.reconciled, {
        message: "Xác nhận đã đối chiếu lần gửi trước",
        path: ["reconciled"],
      })
      // BE: ngày giao đã qua / chưa có → phải xác nhận rõ, khôi phục không sửa được PO đã gửi.
      .refine((v) => !needsPastDueAck || v.acknowledgePastDue, {
        message: "Xác nhận ngày giao đã quá hạn",
        path: ["acknowledgePastDue"],
      })
  );
}

/* ── NCC phản hồi — BE SupplierConfirmationRequest ───────────────────── */

export const supplierConfirmationInputSchema = z
  .object({
    status: z.enum(["CONFIRMED", "REJECTED"]),
    supplierReference: z
      .string()
      .trim()
      .max(
        PO_LIMITS.supplierReferenceMax,
        `Mã tham chiếu tối đa ${PO_LIMITS.supplierReferenceMax} ký tự`,
      ),
    note: z.string().trim().max(PO_REASON_MAX, `Ghi chú tối đa ${PO_REASON_MAX} ký tự`),
  })
  // BE @ValidProcurementFields: NCC từ chối thì bắt buộc ghi lý do.
  .refine((v) => v.status !== "REJECTED" || v.note.length > 0, {
    message: "NCC từ chối cần ghi lý do",
    path: ["note"],
  });

export type CreatePoInput = z.infer<typeof createPoSchema>;
export type PoLineInput = z.infer<typeof poLineInputSchema>;
export type SendPoInput = z.infer<ReturnType<typeof sendPoInputSchema>>;
export type RecoverDeliveryInput = z.infer<ReturnType<typeof recoverDeliveryInputSchema>>;
export type SupplierConfirmationInput = z.infer<typeof supplierConfirmationInputSchema>;
