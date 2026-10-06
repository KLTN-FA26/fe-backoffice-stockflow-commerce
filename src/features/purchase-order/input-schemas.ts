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
/** BE `common.domain.Sku`: mã được trim + upper-case rồi phải khớp mẫu này. */
export const SKU_CODE_PATTERN = /^[A-Z0-9-]{3,64}$/;
/** BE: lý do khôi phục / đổi ngày giao 1..1000 ký tự. */
export const PO_REASON_MAX = PO_LIMITS.reasonMax;

const reason = z
  .string()
  .trim()
  .min(1, "Nhập lý do")
  .max(PO_REASON_MAX, `Lý do tối đa ${PO_REASON_MAX} ký tự`);

/* ── Tạo PO — BE CreatePurchaseOrderRequest ─────────────────────────── */

export const poLineInputSchema = z.object({
  // BR-01 (docs 02 §6): chỉ SKU `Active`. ASSUMPTION (open-question C12): BE chưa có API
  // danh mục SKU và không kiểm SKU tồn tại — FE chỉ kiểm định dạng mã giống BE.
  // TODO(SKU combobox): khi có API danh mục, form chuyển sang chọn SKU (xem PoLineCard.tsx);
  // regex này vẫn giữ làm chốt chặn cuối khớp BE.
  sku: requiredString(UI_LABELS.purchaseOrder.validation.skuRequired).regex(
    SKU_CODE_PATTERN,
    "Mã SKU không đúng định dạng",
  ),
  // BE #36 (9fbb90f) ProcurementServiceImpl#description: khi gửi NCC, dòng phải có mô tả — thiếu thì
  // BE lấy tên theo SKU trong danh mục, không có → 400 PO_LINE_DESCRIPTION_REQUIRED và PO kẹt.
  // Chưa có API danh mục SKU (open-question C12) nên FE BẮT BUỘC mô tả ngay từ lúc tạo.
  // BE `po_line.description VARCHAR(300)`.
  description: z
    .string()
    .trim()
    .min(1, UI_LABELS.purchaseOrder.validation.descriptionRequired)
    .max(PO_LIMITS.lineDescriptionMax, `Mô tả tối đa ${PO_LIMITS.lineDescriptionMax} ký tự`),
  // BE CreatePOLineRequest: `int quantityOrdered` @Positive.
  quantityOrdered: intQty("Số lượng phải là số nguyên > 0").max(
    PO_LIMITS.quantityMax,
    "Số lượng vượt giới hạn cho phép",
  ),
  // BE @PositiveOrZero — cho phép 0 (dòng khuyến mãi/tặng).
  unitPrice: money("Đơn giá không âm"),
});

export const createPoSchema = z
  .object({
    supplierId: requiredString(UI_LABELS.purchaseOrder.validation.supplierRequired), // UUID — BE kiểm
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

/* ── Nhận hàng — BE ReceiveGoodsRequest ──────────────────────────────── */

export const receiveGoodsLineInputSchema = z.object({
  lineId: requiredString("Thiếu dòng PO"),
  // BE ReceiveGoodsLineRequest: `int quantity` @Positive. Cận trên (BR-04) cần openQuantity
  // của dòng — kiểm trong `validateReceiveDraft` (selectors.ts).
  quantity: intQty("SL nhận phải là số nguyên > 0"),
});

export const receiveGoodsInputSchema = z.object({
  lines: z.array(receiveGoodsLineInputSchema).min(1, "Nhập SL nhận cho ít nhất một dòng"),
});

/* ── Gửi NCC — BE SendPurchaseOrderRequest + PurchaseOrder#confirmDeliveryDate ── */

/**
 * `currentExpectedAt` = ngày giao đang lưu trên PO.
 * BE `PurchaseOrder#confirmDeliveryDate` (#36 9fbb90f): ngày giao phải CÓ (thiếu →
 * `PO_DELIVERY_DATE_REQUIRED`); đổi ngày thì bắt buộc lý do 1..1000 (`PO_REASON_REQUIRED`).
 * BR-06 (docs 02 §6): ngày đã qua chỉ CẢNH BÁO — BE không chặn nữa, trả `warnings`.
 */
export function sendPoInputSchema(currentExpectedAt: string | null) {
  return z
    .object({ expectedAt: isoDate, reason: z.string().trim().max(PO_REASON_MAX) })
    .refine((v) => v.expectedAt === currentExpectedAt || v.reason.length > 0, {
      message: "Đổi ngày giao cần ghi lý do",
      path: ["reason"],
    });
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
export type ReceiveGoodsInput = z.infer<typeof receiveGoodsInputSchema>;
export type SendPoInput = z.infer<ReturnType<typeof sendPoInputSchema>>;
export type RecoverDeliveryInput = z.infer<ReturnType<typeof recoverDeliveryInputSchema>>;
export type SupplierConfirmationInput = z.infer<typeof supplierConfirmationInputSchema>;
