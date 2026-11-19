/**
 * Đơn sản xuất của đơn bán — `GET /production-orders?salesOrderId=…` (BE `ProductionOrderController#list`,
 * `production-orders:READ`, docs 17 §4.3). Trả `ApiResponse<PageResponse<ProductionOrder>>` — client đã bóc `data`,
 * còn lại trang `{items, page, size, totalElements, totalPages, hasNext, hasPrevious}`. Jackson `non_null` → field
 * null bị BỎ khỏi JSON nên field tuỳ chọn là `nullish`.
 *
 * Mỗi Đơn sản xuất thuộc đúng MỘT đợt giao của đơn bán và gửi một đơn vị sản xuất; các dòng của nó trỏ về dòng đơn
 * bán (`orderLineId`) với số thùng cần làm và số thùng đã nhập kho. Đơn nhiều đợt có nhiều Đơn sản xuất cho cùng
 * một dòng.
 */

import { z } from "zod";

import { PRODUCTION_ORDER_STATUSES } from "@/constants/orders";

/** BE `ProductionOrderLine` — chỉ field FE dùng (zod bỏ field thừa). */
export const productionOrderLineDtoSchema = z.object({
  id: z.string(),
  orderLineId: z.string(),
  sku: z.string(),
  cartons: z.number().int(),
  totalUnits: z.number().int(),
  /** Số thùng đã nhập kho (docs 17 §5.3 Partially Received / Received). */
  receivedCartons: z.number().int(),
});

/** BE `ProductionOrder` (record `ProductionOrderResponse`) — chỉ field FE dùng + định danh. */
export const productionOrderDtoSchema = z.object({
  id: z.string(),
  /** Mã Đơn sản xuất hiển thị. */
  code: z.string(),
  salesOrderId: z.string().nullish(),
  status: z.enum(PRODUCTION_ORDER_STATUSES),
  /** Ngày cần hàng — mặc định ngày bắt đầu cửa sổ giao của đợt (BR-26). */
  needByDate: z.string().nullish(),
  /** Ngày hoàn thành dự kiến đơn vị sản xuất báo, từ Accepted trở đi. */
  expectedCompletionDate: z.string().nullish(),
  lines: z.array(productionOrderLineDtoSchema),
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

/** Model FE — phần của MỘT Đơn sản xuất dành cho một dòng đơn bán; nullish → nullable. */
export const productionOrderSchema = z.object({
  productionOrderId: z.string(),
  code: z.string(),
  orderLineId: z.string(),
  status: z.enum(PRODUCTION_ORDER_STATUSES),
  cartons: z.number().int(),
  receivedCartons: z.number().int(),
  needByDate: z.string().nullable(),
  expectedCompletionDate: z.string().nullable(),
});
