/**
 * Dữ kiện phụ của `OrderResponse` — tách khỏi `schemas.ts` (giới hạn 200 dòng / file). `deliveryMode` /
 * `deliveryModeLocked` chỉ còn để ĐỌC dữ liệu cũ: BE đã bỏ hình thức giao (docs 17 BR-16) nên không trả nữa.
 */

import { z } from "zod";

import { ORDER_DELIVERY_MODES } from "@/constants/labels-delivery-mode";

/** BE `order/api/DeliveryMode`: giao lẻ / nguyên xe. Tolerant: giá trị lạ → "UNKNOWN" (hiện "Không rõ"). */
export const orderDeliveryModeDtoSchema = z
  .enum([...ORDER_DELIVERY_MODES, "UNKNOWN"])
  .catch("UNKNOWN");

/**
 * Dữ kiện màn đơn dùng ở release (cùng `OrderResponse`): hình thức giao cũ + cờ khoá (BE đã bỏ, luôn vắng) và tiền cọc
 * (`depositRequired` / `depositReceivedAt`, đơn cọc chưa nhận cọc nằm ở Pending Payment nên chưa release được). Mọi
 * trường vắng trên dòng danh sách không mang chúng, hoặc với đơn không cọc.
 */
export const orderReleaseFactsShape = {
  deliveryMode: orderDeliveryModeDtoSchema.nullish(),
  /** true khi không còn đổi được (đã đóng gói / qua đóng gói / huỷ / đóng); vắng = không biết. */
  deliveryModeLocked: z.boolean().nullish(),
  /** Tiền cọc đơn CỌC cần có trước khi xác nhận; null với đơn không cọc. */
  depositRequired: z.number().nullish(),
  /** Lúc tiền cọc về; vắng = chưa nhận. */
  depositReceivedAt: z.string().nullish(),
};
