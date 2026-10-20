/**
 * Purchase Order — Input schema sửa PO nháp (BE `UpdatePurchaseOrderRequest`, SCRUM-462).
 * Tách khỏi `input-schemas.ts` để giữ mỗi file ≤ 200 dòng; public API vẫn qua `schemas.ts` / `index.ts`.
 */

import { z } from "zod";

import { PO_LIMITS, UI_LABELS } from "@/constants";
import { isoDate, requiredString } from "@/lib/validation/primitives";

import { poLineInputSchema } from "./input-schemas";

/**
 * BE `UpdatePurchaseOrderRequest`: cả nháp như người mua muốn; dòng không gửi bị xoá. NCC và tiền
 * tệ không đổi được (BR-07 docs 02 §6) nên không có trong body. `version` là bản đã đọc — nháp đã đổi
 * thì BE trả 409 OPTIMISTIC_LOCK. `expectedAt` bắt buộc (khác lúc tạo). `lineId` giữ SKU của dòng
 * đã lưu; bỏ trống = thêm dòng mới. Dòng có `lineId` bắt buộc có `unitPrice` (refine bên dưới) —
 * người gọi phải `updatePoSchema.safeParse(toUpdateInput(...))` trước khi gửi.
 */
export const updatePoSchema = z
  .object({
    version: z.number().int().min(0),
    warehouseId: requiredString(UI_LABELS.purchaseOrder.validation.warehouseRequired),
    expectedAt: isoDate,
    note: z
      .string()
      .trim()
      .max(PO_LIMITS.noteMax, UI_LABELS.purchaseOrder.validation.noteMaxError(PO_LIMITS.noteMax))
      .optional(),
    lines: z
      .array(poLineInputSchema.extend({ lineId: z.uuid().optional() }))
      .min(1, UI_LABELS.purchaseOrder.validation.linesMinOne)
      .max(PO_LIMITS.linesMax, UI_LABELS.purchaseOrder.draftEdit.linesMaxError(PO_LIMITS.linesMax)),
  })
  // Issue #30 §2 "Draft edit keeps sending unitPrice": BE thay giá thương lượng của dòng đã lưu
  // bằng giá danh mục khi thiếu `unitPrice` — chặn ở biên payload để không mất giá âm thầm.
  .superRefine((po, ctx) => {
    po.lines.forEach((line, i) => {
      if (line.lineId !== undefined && line.unitPrice === undefined) {
        ctx.addIssue({
          code: "custom",
          message: UI_LABELS.purchaseOrder.validation.unitPriceKeepNegotiated,
          path: ["lines", i, "unitPrice"],
        });
      }
    });
  });

export type UpdatePoInput = z.infer<typeof updatePoSchema>;
