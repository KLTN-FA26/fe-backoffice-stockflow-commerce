/**
 * Dòng lấy hàng — zod DTO + Input, khớp BE `FulfillmentController` (`/tasks/{id}/pick-lines`,
 * SCRUM-267/274/275; báo thiếu BE PR #147). Jackson `non_null`: field null bị bỏ khỏi JSON → `.nullish()`.
 */

import { z } from "zod";

import {
  FULFILLMENT_FIELD_MESSAGES,
  PICK_LINE_API_STATUSES,
  PICK_LINE_ERROR_MESSAGES,
  PICK_LINE_LIMITS,
} from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

const MSG = FULFILLMENT_FIELD_MESSAGES;

/**
 * BE `PickLineResponse` — một điểm dừng của lộ trình: lấy `allocatedQty` × `sku` (lô `lotNumber`) ở
 * `locationCode`. `orderLineId` là dòng đơn; `barcode` của SKU (quét được thay cho SKU). `shortQty` = số
 * thiếu khi báo thiếu (giữ cả khi dòng thiếu đã được phân bổ lại → CANCELLED).
 */
export const bePickLineSchema = z.object({
  lineId: z.string(),
  taskId: z.string(),
  sequenceNo: z.number().int(),
  orderLineId: z.string(),
  sku: z.string(),
  barcode: z.string().nullish(),
  locationCode: z.string(),
  lotNumber: z.string().nullish(),
  allocatedQty: z.number().int(),
  pickedQty: z.number().int(),
  status: z.enum(PICK_LINE_API_STATUSES),
  pickedAt: z.string().nullish(),
  putBackQty: z.number().int(),
  putBackLocationCode: z.string().nullish(),
  putBackAt: z.string().nullish(),
  shortQty: z.number().int().min(0).default(0),
});

export const bePickLinePageSchema = bePageSchema(bePickLineSchema);

const code = (required: string) =>
  z.string().trim().min(1, required).max(PICK_LINE_LIMITS.codeMax, MSG.codeTooLong);

/**
 * BE `ConfirmPickRequest` — vị trí, SKU hoặc barcode, số lượng (@NotBlank @Size(64), @Positive).
 * Chỉ kiểm định dạng: đúng / sai so với dòng do BE quyết (409 PICK_*), FE không chặn trước.
 */
export const confirmPickInputSchema = z.object({
  locationCode: code(MSG.locationRequired),
  scannedCode: code(MSG.codeRequired),
  quantity: z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/, MSG.quantityRequired)
    .transform(Number),
});

/**
 * BE `ShortPickRequest` (@NotBlank @Size(64), foundQuantity @NotNull @PositiveOrZero) + `PickList.reportShort`:
 * số tìm thấy phải từ 0 đến SL phân bổ − 1 (bằng phân bổ thì là lấy đủ, không phải thiếu). Vị trí đúng / sai
 * do BE quyết (409 PICK_LOCATION_MISMATCH).
 */
export function shortPickInputSchema(allocatedQty: number) {
  const max = allocatedQty - 1;
  const outOfRange = PICK_LINE_ERROR_MESSAGES.shortFoundRange(max);
  return z.object({
    locationCode: code(MSG.locationRequired),
    foundQuantity: z
      .string()
      .trim()
      .regex(/^\d+$/, outOfRange)
      .transform(Number)
      .refine((found) => found <= max, outOfRange),
  });
}
