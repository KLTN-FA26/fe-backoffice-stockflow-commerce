/**
 * Trả hàng về kệ — zod DTO + Input, khớp BE `FulfillmentController#putBacks / #putBack` (SCRUM-275).
 */

import { z } from "zod";

import { FULFILLMENT_FIELD_MESSAGES, PICK_LINE_LIMITS } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/**
 * BE `PutBackRowResponse` — hàng đã lấy cho đơn bị huỷ sau đó, còn ở ngoài kệ (docs 07 BR-05).
 * `fromLocationCode`: nơi đã lấy ra — vị trí tự nhiên để trả về.
 */
export const bePutBackRowSchema = z.object({
  taskId: z.string(),
  orderNumber: z.string(),
  warehouseId: z.string(),
  lineId: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  pickedQty: z.number().int(),
  fromLocationCode: z.string(),
  // Instant của BE — null thì Jackson bỏ field; một dòng thiếu mốc không được làm hỏng cả trang
  pickedAt: z.string().nullish(),
});

export const bePutBackRowPageSchema = bePageSchema(bePutBackRowSchema);

/** BE `PutBackRequest` — `locationCode` @NotBlank @Size(max = 64). Bin đúng / sai do BE quyết (409). */
export const putBackInputSchema = z.object({
  locationCode: z
    .string()
    .trim()
    .min(1, FULFILLMENT_FIELD_MESSAGES.locationRequired)
    .max(PICK_LINE_LIMITS.codeMax, FULFILLMENT_FIELD_MESSAGES.codeTooLong),
});
