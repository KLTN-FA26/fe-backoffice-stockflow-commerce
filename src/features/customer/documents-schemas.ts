/**
 * Báo giá và đơn của MỘT khách trên trang chi tiết khách (UI/UX bo-30) — chỉ các trường bảng cần, đọc từ hai danh sách
 * BE đã có tham số `customerId`: `GET /quotes` (`QuoteRowResponse`) và `GET /orders` (`OrderResponse`). Jackson
 * non_null: trường null bị bỏ → `.nullish()`. Trạng thái giữ là chuỗi: mã lạ hiện nguyên, không làm hỏng cả bảng.
 */

import { z } from "zod";

import { bePageSchema } from "@/lib/api/page-schema";

export const customerQuoteRowSchema = z.object({
  id: z.string(),
  quoteNumber: z.string(),
  status: z.string(),
  revision: z.number().int().default(1),
  validUntil: z.string().nullish(),
  createdAt: z.string(),
  /** VND có thuế (R5-2); null khi còn dòng chưa có giá. */
  total: z.number().nullish(),
  firstItemName: z.string().nullish(),
  convertedOrderId: z.string().nullish(),
  convertedOrderNumber: z.string().nullish(),
});

export const customerOrderRowSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  totalAmount: z.number().nullish(),
  currency: z.string().nullish(),
  placedAt: z.string().nullish(),
});

export const customerQuotePageSchema = bePageSchema(customerQuoteRowSchema);
export const customerOrderPageSchema = bePageSchema(customerOrderRowSchema);
