/**
 * Dòng lấy hàng — zod DTO + Input, khớp BE `FulfillmentController` (`/tasks/{id}/pick-lines`, docs 07 §4.2,
 * §4.4). Mỗi dòng là MỘT THÙNG LPN lấy nguyên (BR-04): quét vị trí rồi LPN, không nhập số lượng. Jackson
 * `non_null`: field null bị bỏ khỏi JSON → `.nullish()`.
 */

import { z } from "zod";

import {
  FULFILLMENT_FIELD_MESSAGES,
  PICK_LINE_API_STATUSES,
  PICK_LINE_LIMITS,
  SHORT_PICK_REASONS,
} from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

const MSG = FULFILLMENT_FIELD_MESSAGES;

/**
 * BE `PickLineResponse` — một điểm dừng của lộ trình: lấy thùng `lpn` (SKU `sku`, lô `lotNumber`) ở
 * `locationCode`. `allocatedQty` = số cái chuẩn của thùng (lấy nguyên, không nhập). `lpn` là mã thùng phải quét
 * để xác nhận dòng (và quét lại khi cất lại); BE chỉ để null ở dòng hàng rời từ trước khi có thùng. `shortQty` /
 * `shortReason` = thùng báo thiếu (NOT_FOUND | DAMAGED), giữ cả khi dòng đã được phân bổ lại → CANCELLED.
 * `stagedAt` / `stagedLocationCode` = thùng đã chuyển sang khu chờ xuất (dòng STAGED, đích STAGING).
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
  shortReason: z.enum(SHORT_PICK_REASONS).nullish(),
  lpn: z.string().nullish(),
  wholeCarton: z.boolean().nullish(),
  stagedAt: z.string().nullish(),
  stagedLocationCode: z.string().nullish(),
});

export const bePickLinePageSchema = bePageSchema(bePickLineSchema);

const code = (required: string) =>
  z.string().trim().min(1, required).max(PICK_LINE_LIMITS.codeMax, MSG.codeTooLong);

/** LPN của thùng: BE `ConfirmPickRequest.lpn` / `PutBackRequest.lpn` @NotBlank @Size(max = 30). */
const lpn = (required: string) =>
  z.string().trim().min(1, required).max(PICK_LINE_LIMITS.lpnMax, MSG.lpnTooLong);

/**
 * BE `ConfirmPickRequest` — `locationCode` @NotBlank @Size(64), `lpn` @NotBlank @Size(30); KHÔNG có số lượng
 * (docs 07 BR-04: mỗi dòng một thùng). Chỉ kiểm định dạng: đúng / sai so với dòng do BE quyết (409
 * PICK_LOCATION_MISMATCH / PICK_ITEM_MISMATCH, BR-10), FE không chặn trước.
 */
export const confirmPickInputSchema = z.object({
  locationCode: code(MSG.locationRequired),
  lpn: lpn(MSG.lpnRequired),
});

/**
 * BE `ShortPickRequest` — `locationCode` @NotBlank @Size(64), `reason` @NotNull (NOT_FOUND | DAMAGED); báo
 * thiếu cả thùng, không nhập số tìm thấy (docs 07 §4.4 bước 9). Vị trí đúng / sai do BE quyết (409
 * PICK_LOCATION_MISMATCH).
 */
export const shortPickInputSchema = z.object({
  locationCode: code(MSG.locationRequired),
  reason: z.enum(SHORT_PICK_REASONS, { error: MSG.shortReasonRequired }),
});
