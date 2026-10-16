/**
 * Lệnh sản xuất của đơn — HỢP ĐỒNG ĐÃ THỐNG NHẤT, BE CHƯA CÓ ENDPOINT.
 *
 * CONTRACT PENDING (coordinator duyệt B0, 2026-10-11): BE develop chỉ có bảng
 * `production.production_order` (V20261010000200) và quyền `production-orders`, chưa có
 * controller. FE gọi `GET /orders/{orderId}/production-orders`; chỉ mock trả dữ liệu. Với BE
 * thật endpoint trả 404/405 → UI báo "chưa có API sản xuất", KHÔNG dựng dữ liệu giả.
 * Tên field lấy từ cột DB (snake_case → camelCase) để BE dựng DTO không lệch.
 *
 * docs 19 BR-01: mỗi dòng tuỳ chỉnh có đúng 1 LSX gốc; ngoại lệ duy nhất là LSX con khi tách
 * gia công (BR-12) — `parentId` trỏ về LSX gốc, mode luôn SUBCONTRACTED.
 */

import { z } from "zod";

import { PRODUCTION_ORDER_MODES, PRODUCTION_ORDER_STATUSES } from "@/constants/orders";

export const productionOrderDtoSchema = z.object({
  productionOrderId: z.string(),
  /** Cột `order_number` — mã LSX hiển thị. */
  productionOrderNumber: z.string(),
  salesOrderLineId: z.string(),
  /** LSX gốc của LSX con gia công; null với LSX gốc. */
  parentId: z.string().nullish(),
  mode: z.enum(PRODUCTION_ORDER_MODES),
  status: z.enum(PRODUCTION_ORDER_STATUSES),
  /** Trạng thái trước khi treo — chỉ có khi status = ON_HOLD. */
  statusBeforeHold: z.enum(PRODUCTION_ORDER_STATUSES).nullish(),
  holdReason: z.string().nullish(),
  plannedQuantity: z.number().int(),
  goodQuantity: z.number().int(),
  dueDate: z.string().nullish(),
  /** Nhà gia công — chỉ LSX SUBCONTRACTED. */
  subcontractorName: z.string().nullish(),
});

export const productionOrderListDtoSchema = z.array(productionOrderDtoSchema);

/** Model FE — nullish → nullable để UI không phải phân biệt vắng key / null. */
export const productionOrderSchema = productionOrderDtoSchema.extend({
  parentId: z.string().nullable(),
  statusBeforeHold: z.enum(PRODUCTION_ORDER_STATUSES).nullable(),
  holdReason: z.string().nullable(),
  dueDate: z.string().nullable(),
  subcontractorName: z.string().nullable(),
});
