/**
 * Cất hàng — zod DTO + Input, khớp BE `PutawayController` (docs 05 §4.2–4.4). Một nhiệm vụ = một thùng LPN, cất
 * nguyên thùng vào một bin (BR-08): không có số lượng trong request.
 */

import { z } from "zod";

import {
  PUTAWAY_FIELD_MESSAGES,
  PUTAWAY_LIMITS,
  PUTAWAY_SOURCES,
  PUTAWAY_SUGGESTION_REASONS,
  PUTAWAY_TASK_STATUSES,
} from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/**
 * BE `PutawaySuggestionResponse` — bin gợi ý tính lúc xem, không lưu (docs 05 §3). `reason` là nhóm xếp hạng
 * (BR-05); không có điểm số. `freeVolumeM3` null = tầng chưa có chiều cao thông thuỷ (không giới hạn thể tích, BR-03);
 * `freeWeightKg` null = bin không giới hạn tải. Hai số đã trừ chỗ giữ của chuyến khác (BR-16).
 */
export const bePutawaySuggestionSchema = z.object({
  locationCode: z.string(),
  reason: z.enum(PUTAWAY_SUGGESTION_REASONS),
  freeVolumeM3: z.number().nullish(),
  freeWeightKg: z.number().nullish(),
});

/**
 * BE `PutawayTaskResponse`. `goodsReceiptId` / `goodsReceiptLineId` null khi `source = QUARANTINE_RELEASE`.
 * `sourceLocationCode` = nơi thùng đang đứng (BE không lưu). `targetLocationCode` chỉ có sau khi cất. Danh sách luôn
 * trả `suggestions: []`; chi tiết trả tối đa 10 bin, `overflowLocationCodes` chỉ có khi không bin nào nhận (BR-13).
 */
export const bePutawayTaskSchema = z.object({
  id: z.string(),
  goodsReceiptId: z.string().nullish(),
  goodsReceiptLineId: z.string().nullish(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  quantity: z.number().int(),
  left: z.number().int(),
  sourceLocationCode: z.string(),
  lpn: z.string().nullish(),
  status: z.enum(PUTAWAY_TASK_STATUSES),
  targetLocationCode: z.string().nullish(),
  suggestions: z.array(bePutawaySuggestionSchema).default([]),
  overflowLocationCodes: z.array(z.string()).default([]),
  source: z.enum(PUTAWAY_SOURCES),
  // Kho của nhiệm vụ (BE #394, "nên làm") — để link cũ chuyển vào đúng tab theo kho; BE cũ chưa trả
  warehouseId: z.string().nullish(),
  // Issue #286: mã (prefix) + tên kho cạnh id — dựng link tab kho không cần tải danh mục kho
  warehouseCode: z.string().nullish(),
  warehouseName: z.string().nullish(),
});

export const bePutawayTaskPageSchema = bePageSchema(bePutawayTaskSchema);

/**
 * BE `PutawayConfirmRequest` — `locationCode` @NotBlank @Size(max = 64), `lpn` @NotBlank @Size(max = 30). Đúng thùng,
 * đúng bin do BE quyết (409 PUTAWAY_LPN_MISMATCH, 422 CARTON_DOES_NOT_FIT_BIN…). BR-07 (docs 05 §6): bin khác gợi ý
 * vẫn được, KHÔNG có lý do (reason code) — C18 hoãn việc bắt buộc lý do.
 */
export const putawayConfirmInputSchema = z.object({
  lpn: z
    .string()
    .trim()
    .min(1, PUTAWAY_FIELD_MESSAGES.lpnRequired)
    .max(PUTAWAY_LIMITS.lpnMax, PUTAWAY_FIELD_MESSAGES.lpnTooLong),
  locationCode: z
    .string()
    .trim()
    .min(1, PUTAWAY_FIELD_MESSAGES.locationRequired)
    .max(PUTAWAY_LIMITS.codeMax, PUTAWAY_FIELD_MESSAGES.codeTooLong),
});
