/**
 * Trả hàng về kệ — zod DTO + Input, khớp BE `FulfillmentController#putBacks / #putBack` (docs 07 §4.5 bước 13–14):
 * cất lại NGUYÊN THÙNG, quét LPN để xác nhận.
 */

import { z } from "zod";

import { FULFILLMENT_FIELD_MESSAGES, PICK_LINE_LIMITS } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/**
 * BE `PutBackRowResponse` — thùng đã lấy (hoặc đã về khu chờ xuất) cho đơn bị huỷ sau đó, còn ở ngoài kệ (docs 07
 * BR-05), hoặc thùng bị loại ở trạm kiểm vì hư hỏng (docs 08 §4.2 bước 4). `lpn`: mã thùng phải quét để cất lại.
 * `fromLocationCode`: nơi thùng đang đứng — bin đã lấy ra (vị trí tự nhiên để trả về), hoặc khu chờ xuất với dòng
 * Staged. `quarantine`: thùng hư hỏng vào khu cách ly của kho, không về bin.
 */
export const bePutBackRowSchema = z.object({
  taskId: z.string(),
  orderNumber: z.string(),
  warehouseId: z.string(),
  lineId: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  lpn: z.string().nullish(),
  pickedQty: z.number().int(),
  fromLocationCode: z.string(),
  // Instant của BE — null thì Jackson bỏ field; một dòng thiếu mốc không được làm hỏng cả trang
  pickedAt: z.string().nullish(),
  quarantine: z.boolean().nullish(),
});

export const bePutBackRowPageSchema = bePageSchema(bePutBackRowSchema);

/**
 * BE `PutBackRequest` — `locationCode` @NotBlank @Size(max = 64), `lpn` @NotBlank @Size(max = 30). Bin / khu cách ly
 * và LPN đúng / sai do BE quyết (409 PUT_BACK_LOCATION_INVALID / PICK_ITEM_MISMATCH).
 */
export const putBackInputSchema = z.object({
  locationCode: z
    .string()
    .trim()
    .min(1, FULFILLMENT_FIELD_MESSAGES.locationRequired)
    .max(PICK_LINE_LIMITS.codeMax, FULFILLMENT_FIELD_MESSAGES.codeTooLong),
  lpn: z
    .string()
    .trim()
    .min(1, FULFILLMENT_FIELD_MESSAGES.lpnRequired)
    .max(PICK_LINE_LIMITS.lpnMax, FULFILLMENT_FIELD_MESSAGES.lpnTooLong),
});
