/**
 * Transfer order — Input schemas (form gửi đi), mô phỏng ràng buộc request BE và BR docs 10 §6.
 * BE vẫn là nơi chặn cuối — Backend phải re-check mọi BR dưới đây (TransferOrderServiceImpl).
 */

import { z } from "zod";

import {
  DELIVERY_MODE,
  DELIVERY_MODES,
  TRANSFER_FIELD_MESSAGES as MSG,
  TRANSFER_LIMITS,
  TRANSFER_REASONS,
} from "@/constants";
import { isoDate } from "@/lib/validation/primitives";
import { skuSchema } from "@/lib/validation/sku";

export const transferLineInputSchema = z.object({
  // BE `CreateTransferOrderRequest.Line.sku` @ValidSku — xem lib/validation/sku.ts.
  sku: skuSchema({ required: MSG.skuRequired, format: MSG.skuFormat }),
  lotNumber: z.string().trim().max(TRANSFER_LIMITS.codeMax, MSG.tooLong).default(""),
  quantity: z
    .number({ message: MSG.quantity })
    .int(MSG.quantity)
    .min(1, MSG.quantity)
    .max(TRANSFER_LIMITS.quantityMax, MSG.quantityMax),
});

/** Form tạo / sửa nháp — dùng chung cho `POST` và `PUT /{id}` (PUT thêm `version` ở lớp api). */
export const transferFormSchema = z
  .object({
    fromWarehouseId: z.string().min(1, MSG.fromRequired),
    toWarehouseId: z.string().min(1, MSG.toRequired),
    // "" = không chọn (BE `reason` tuỳ chọn)
    reason: z.union([z.literal(""), z.enum(TRANSFER_REASONS)]).default(""),
    expectedDate: z.union([z.literal(""), isoDate]).default(""),
    // LP2-8: mặc định nguyên chuyến (FTL); đổi được khi lệnh còn DRAFT (PUT)
    deliveryMode: z.enum(DELIVERY_MODES).default(DELIVERY_MODE.FULL_TRUCKLOAD),
    lines: z
      .array(transferLineInputSchema)
      .min(1, MSG.linesRequired)
      .max(TRANSFER_LIMITS.linesMax, MSG.linesTooMany),
  })
  .superRefine((form, issue) => {
    // BR-01 (docs 10 §6): kho nguồn ≠ kho đích — trong một kho dùng module 11
    if (form.fromWarehouseId && form.fromWarehouseId === form.toWarehouseId) {
      issue.addIssue({ code: "custom", path: ["toWarehouseId"], message: MSG.sameWarehouse });
    }
    // BE TransferOrder: mỗi cặp SKU + lô chỉ một dòng — SKU so không phân biệt hoa thường (BE `Sku`
    // in hoa), lô so đúng nguyên văn như BE (TransferLine chỉ trim)
    const seen = new Set<string>();
    form.lines.forEach((line, index) => {
      const key = `${line.sku.toUpperCase()}|${line.lotNumber}`;
      if (seen.has(key)) {
        issue.addIssue({
          code: "custom",
          path: ["lines", index, "sku"],
          message: MSG.duplicateLine,
        });
      }
      seen.add(key);
    });
  });

/** Lý do từ chối / huỷ — BE `ReasonRequest` @NotBlank @Size(max = 500). */
export const transferReasonInputSchema = z.object({
  reason: z.string().trim().min(1, MSG.reasonRequired).max(TRANSFER_LIMITS.reasonMax, MSG.tooLong),
});

/** Dòng có thể xuất: id + SL yêu cầu (lấy từ lệnh BE trả về). */
export interface DispatchableLine {
  lineId: string;
  requested: number;
}

/**
 * Xuất kho (`POST /{id}/dispatch`): mỗi dòng 0 ≤ SL xuất ≤ SL yêu cầu, tổng ≥ 1 — BE
 * TransferOrderServiceImpl#dispatch cho xuất thiếu (dòng không gửi = 0).
 */
export function buildDispatchSchema(lines: readonly DispatchableLine[]) {
  const requestedById = new Map(lines.map((line) => [line.lineId, line.requested]));
  return z
    .object({
      lines: z.array(
        z.object({
          lineId: z.string().min(1),
          shippedQuantity: z
            .number({ message: MSG.shippedRange })
            .int(MSG.shippedRange)
            .min(0, MSG.shippedRange),
        }),
      ),
    })
    .superRefine(({ lines: shipped }, issue) => {
      shipped.forEach((line, index) => {
        const requested = requestedById.get(line.lineId);
        if (requested === undefined || line.shippedQuantity > requested) {
          issue.addIssue({
            code: "custom",
            path: ["lines", index, "shippedQuantity"],
            message: MSG.shippedRange,
          });
        }
      });
      if (shipped.reduce((sum, line) => sum + line.shippedQuantity, 0) < 1) {
        issue.addIssue({ code: "custom", path: ["lines"], message: MSG.shippedTotal });
      }
    });
}
