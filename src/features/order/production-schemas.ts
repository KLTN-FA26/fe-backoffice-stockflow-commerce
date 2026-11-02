/**
 * Lệnh sản xuất của đơn — `GET /production/orders?salesOrderId=…` (BE ProductionOrderController#list,
 * `production-orders:READ`). Hợp đồng chép từ BE develop 5683fe14:
 * `ApiResponse<PageResponse<ProductionOrderRowResponse>>` — client đã bóc `data`, còn lại trang
 * `{items, page, size, totalElements, totalPages, hasNext, hasPrevious}`. Jackson `non_null` → field
 * null bị BỎ khỏi JSON (không phải `null`) nên field tuỳ chọn là `nullish`.
 *
 * `salesOrderId` không tồn tại → 200 trang rỗng (BE chỉ lọc, không kiểm đơn). Row không có tên nhà
 * gia công / trạng thái trước khi treo — chỉ có ở endpoint chi tiết, FE không gọi.
 *
 * docs 19 BR-01: mỗi dòng tuỳ chỉnh có đúng 1 LSX gốc; LSX con (tách gia công BR-12, bù thiếu /
 * làm lại) kế thừa `salesOrderLineId` của gốc và có `parentId` trỏ về gốc.
 */

import { z } from "zod";

import { PRODUCTION_ORDER_MODES, PRODUCTION_ORDER_STATUSES } from "@/constants/orders";

/** BE `ProductionOrder.Type` — LSX mẫu (SAMPLE) không gắn đơn bán. */
export const PRODUCTION_ORDER_TYPES = ["SAMPLE", "ORDER"] as const;

/** BE `ProductionOrderRowResponse` — chỉ các field FE dùng + định danh (zod bỏ field thừa). */
export const productionOrderDtoSchema = z.object({
  id: z.string(),
  /** Mã LSX hiển thị, dạng `LSX-yyyyMMdd-NNNN`. */
  orderNumber: z.string(),
  type: z.enum(PRODUCTION_ORDER_TYPES),
  mode: z.enum(PRODUCTION_ORDER_MODES),
  status: z.enum(PRODUCTION_ORDER_STATUSES),
  holdReason: z.string().nullish(),
  plannedQuantity: z.number().int(),
  goodQuantity: z.number().int(),
  dueDate: z.string().nullish(),
  /** Null (vắng) với LSX mẫu. */
  salesOrderId: z.string().nullish(),
  salesOrderLineId: z.string().nullish(),
  /** LSX gốc của LSX con; vắng với LSX gốc. */
  parentId: z.string().nullish(),
  createdAt: z.string(),
});

export const productionOrderPageDtoSchema = z.object({
  items: z.array(productionOrderDtoSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

/** Model FE — LSX của một dòng đơn (đã lọc LSX mẫu / thiếu dòng); nullish → nullable. */
export const productionOrderSchema = z.object({
  productionOrderId: z.string(),
  productionOrderNumber: z.string(),
  salesOrderLineId: z.string(),
  parentId: z.string().nullable(),
  mode: z.enum(PRODUCTION_ORDER_MODES),
  status: z.enum(PRODUCTION_ORDER_STATUSES),
  holdReason: z.string().nullable(),
  plannedQuantity: z.number().int(),
  goodQuantity: z.number().int(),
  dueDate: z.string().nullable(),
});
