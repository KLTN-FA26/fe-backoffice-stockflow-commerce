/**
 * Purchase Order — schema của FORM tạo PO (react-hook-form + zodResolver).
 *
 * Khác `createPoSchema` (payload gửi BE, `input-schemas.ts`): giá trị ở đây là CHUỖI người dùng
 * đang gõ, và mỗi lỗi gắn đúng path của ô (`lines.0.orderedQty`…) để hiện inline ngay dưới ô.
 * Trước khi gửi, form vẫn chuyển sang payload và parse lại bằng `createPoSchema` (chốt chặn cuối).
 * Ràng buộc = bean validation + domain rule BE nhánh `test` (cùng nguồn với `createPoSchema`).
 */

import { z } from "zod";

import { PO_LIMITS, UI_LABELS } from "@/constants";
import { fitsCurrencyScale } from "@/lib/format";

import { PO_INPUT_CURRENCIES, SKU_CODE_PATTERN, unitPriceScaleMessage } from "./input-schemas";

const toNumber = (raw: string) => (raw.trim() === "" ? Number.NaN : Number(raw));

export const poCreateFormLineSchema = z.object({
  // BR-01 (docs 02 §6) + BE `common.domain.Sku` — xem `poLineInputSchema`.
  skuId: z
    .string()
    .min(1, UI_LABELS.purchaseOrder.validation.skuRequired)
    .regex(
      SKU_CODE_PATTERN,
      "Mã SKU chỉ gồm chữ in hoa, số, dấu chấm, gạch dưới, gạch ngang; tối đa 64 ký tự",
    ),
  // BE PR #71: bỏ trống thì BE lấy tên sản phẩm của SKU. `purchase_order_lines.note VARCHAR(255)`.
  description: z
    .string()
    .trim()
    .max(PO_LIMITS.lineDescriptionMax, `Mô tả tối đa ${PO_LIMITS.lineDescriptionMax} ký tự`),
  // BE `int quantityOrdered` @Positive.
  orderedQty: z.string().superRefine((raw, ctx) => {
    const n = toNumber(raw);
    if (!Number.isInteger(n) || n <= 0) {
      ctx.addIssue({ code: "custom", message: "SL đặt phải là số nguyên > 0" });
    } else if (n > PO_LIMITS.quantityMax) {
      ctx.addIssue({ code: "custom", message: "SL đặt vượt giới hạn cho phép" });
    }
  }),
  // BE PR #71 `unitPrice` > 0 (`ck_purchase_order_lines_price`). Số lẻ theo tiền tệ: kiểm ở form.
  unitPrice: z.string().refine((raw) => {
    const n = toNumber(raw);
    return Number.isFinite(n) && n > 0;
  }, "Nhập đơn giá (lớn hơn 0)"),
  // BE PR #71: thuế suất % của dòng, 0–100; để trống = 0.
  taxRate: z.string().refine((raw) => {
    if (raw.trim() === "") return true;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 100;
  }, "Thuế suất 0–100%"),
});

export const poCreateFormSchema = z
  .object({
    supplierId: z.string().min(1, UI_LABELS.purchaseOrder.validation.supplierRequired),
    // SCRUM-390 (docs 02 §3): kho nhận bắt buộc.
    warehouseId: z.string().min(1, UI_LABELS.purchaseOrder.validation.warehouseRequired),
    // BR-07 (docs 02 §6): một PO một tiền tệ — chọn ở cấp PO.
    currency: z.enum(PO_INPUT_CURRENCIES),
    // BR-06 (docs 02 §6): ngày đã qua chỉ CẢNH BÁO; trống → BE tự đặt hôm nay + leadTimeDays.
    expectedDate: z.string(),
    // BE PR #71 `purchase_orders.note` (text) — FE giới hạn như `createPoSchema`.
    note: z.string().max(PO_LIMITS.noteMax, `Ghi chú tối đa ${PO_LIMITS.noteMax} ký tự`),
    lines: z.array(poCreateFormLineSchema).min(1, "Cần ít nhất một dòng hàng"),
  })
  .superRefine((form, ctx) => {
    const seen = new Set<string>();
    form.lines.forEach((line, i) => {
      // ASSUMPTION (chưa có open-question): chặn SKU trùng trong cùng PO — xem `createPoSchema`.
      if (line.skuId && seen.has(line.skuId)) {
        ctx.addIssue({
          code: "custom",
          message: UI_LABELS.purchaseOrder.validation.skuDuplicate,
          path: ["lines", i, "skuId"],
        });
      }
      seen.add(line.skuId);
      // BR-07 + BE `Money` HALF_UP theo số lẻ của tiền tệ (VND: số nguyên).
      const price = toNumber(line.unitPrice);
      if (Number.isFinite(price) && price >= 0 && !fitsCurrencyScale(price, form.currency)) {
        ctx.addIssue({
          code: "custom",
          message: unitPriceScaleMessage(form.currency),
          path: ["lines", i, "unitPrice"],
        });
      }
    });
  });

export type PoCreateFormValues = z.infer<typeof poCreateFormSchema>;
export type PoCreateFormLine = z.infer<typeof poCreateFormLineSchema>;
