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
    .regex(SKU_CODE_PATTERN, "Mã SKU chỉ gồm chữ in hoa, số, dấu gạch ngang; 3–64 ký tự"),
  // BE #36 (9fbb90f) ProcurementServiceImpl#description: khi gửi NCC, dòng phải có mô tả — thiếu thì
  // BE lấy tên theo SKU trong danh mục, không có → 400 PO_LINE_DESCRIPTION_REQUIRED và PO kẹt.
  // Chưa có API danh mục SKU (open-question C12) nên FE BẮT BUỘC mô tả ngay từ lúc tạo.
  // BE `po_line.description VARCHAR(300)`.
  description: z
    .string()
    .trim()
    .min(1, UI_LABELS.purchaseOrder.validation.descriptionRequired)
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
  // BE `unitPrice` @PositiveOrZero — 0 được phép (dòng tặng). Số lẻ theo tiền tệ: kiểm ở form.
  unitPrice: z.string().refine((raw) => {
    const n = toNumber(raw);
    return Number.isFinite(n) && n >= 0;
  }, "Nhập đơn giá (không âm)"),
});

export const poCreateFormSchema = z
  .object({
    supplierId: z.string().min(1, UI_LABELS.purchaseOrder.validation.supplierRequired),
    // BR-07 (docs 02 §6): một PO một tiền tệ — chọn ở cấp PO.
    currency: z.enum(PO_INPUT_CURRENCIES),
    // BR-06 (docs 02 §6): ngày đã qua chỉ CẢNH BÁO; trống → BE tự đặt hôm nay + leadTimeDays.
    expectedDate: z.string(),
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
