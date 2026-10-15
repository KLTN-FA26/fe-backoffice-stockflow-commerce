/**
 * Transfer order — zod DTO, khớp BE `TransferOrderController` (SCRUM-326/327/462, nhánh develop).
 *
 * Hai lớp (api-conventions §3.1): DTO ở đây = hình dạng response BE; Input (form gửi đi + BR refine)
 * ở `input-schemas.ts`. BE trả `status` / `reason` là String, FE parse về union nguyên văn mã wire.
 */

import { z } from "zod";

import { TRANSFER_REASONS, TRANSFER_STATUSES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

export const transferStatusSchema = z.enum(TRANSFER_STATUSES);
export const transferReasonSchema = z.enum(TRANSFER_REASONS);

/** BE `TransferOrderResponse.Line` — `shipped` = SL đã xuất ở kho nguồn (0 trước khi dispatch). */
export const beTransferLineSchema = z.object({
  lineId: z.string(),
  lineNo: z.number().int(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  requested: z.number().int().positive(),
  shipped: z.number().int().min(0),
});

/** BE `TransferOrderResponse` — một lệnh kèm dòng. Kho chỉ có id, tên tra qua `lib/references`. */
export const beTransferOrderSchema = z.object({
  transferId: z.string(),
  number: z.string(),
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  status: transferStatusSchema,
  reason: transferReasonSchema.nullish(),
  expectedDate: z.string().nullish(),
  lines: z.array(beTransferLineSchema).default([]),
  submittedBy: z.string().nullish(),
  submittedAt: z.string().nullish(),
  approvedBy: z.string().nullish(),
  approvedAt: z.string().nullish(),
  dispatchedBy: z.string().nullish(),
  dispatchedAt: z.string().nullish(),
  cancelReason: z.string().nullish(),
  createdAt: z.string(),
  // Gửi lại khi sửa nháp (PUT) — OPTIMISTIC_LOCK nếu lệnh đã đổi
  version: z.number().int(),
});

/** BE `TransferOrderRowResponse` — dòng danh sách, không kèm dòng hàng. */
export const beTransferRowSchema = z.object({
  transferId: z.string(),
  number: z.string(),
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  status: transferStatusSchema,
  expectedDate: z.string().nullish(),
  createdAt: z.string(),
  dispatchedAt: z.string().nullish(),
});

export const beTransferPageSchema = bePageSchema(beTransferRowSchema);
