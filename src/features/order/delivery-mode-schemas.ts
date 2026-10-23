/**
 * Hình thức giao của đơn (LP-1/LP-2, BE PR #157) — DTO BE, tách khỏi `schemas.ts` (giới hạn 200 dòng / file).
 */

import { z } from "zod";

import { ORDER_DELIVERY_MODES } from "@/constants/labels-delivery-mode";

/** BE `order/api/DeliveryMode`: giao lẻ / nguyên xe. Tolerant: giá trị lạ → "UNKNOWN" (hiện "Không rõ"). */
export const orderDeliveryModeDtoSchema = z
  .enum([...ORDER_DELIVERY_MODES, "UNKNOWN"])
  .catch("UNKNOWN");

/**
 * Dữ kiện màn đơn dùng để release và đổi hình thức giao (cùng `OrderResponse`): hình thức giao + cờ khoá (BE PR #157,
 * LP-1) và tiền cọc (`depositRequired` / `depositReceivedAt`, BE chặn release đơn cọc khi chưa đủ cọc — BR-PRD-09). Mọi
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
