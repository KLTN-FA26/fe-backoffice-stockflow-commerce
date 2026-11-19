/**
 * Lịch sản xuất (kltn-docs 17 §4.12 bước 47; BE `ProductionScheduleController`) — Đơn sản xuất đang mở theo ngày cần
 * hàng kèm cờ trễ, và đợt giao còn thiếu chưa có Đơn sản xuất phủ (nguồn lập Đơn sản xuất — §4.3 bước 6).
 */

import { z } from "zod";

import { DELAY_ALERT_TYPES } from "@/constants";

import { productionOrderStatusSchema } from "./schemas";

/** BE `DelayFlag` — cờ trễ đang mở (docs 17 §4.12 bước 48). */
export const delayFlagDto = z.object({
  alertId: z.string(),
  type: z.enum(DELAY_ALERT_TYPES),
  openedAt: z.string(),
});

/** BE `ScheduledProductionOrder`. */
export const scheduledProductionOrderDto = z.object({
  id: z.string(),
  code: z.string(),
  status: productionOrderStatusSchema,
  producerId: z.string(),
  producerCode: z.string(),
  producerName: z.string(),
  salesOrderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string().nullish(),
  deliveryBatchId: z.string(),
  deliveryBatchSeq: z.number().int(),
  windowStart: z.string().nullish(),
  windowEnd: z.string().nullish(),
  receivingWarehouseId: z.string(),
  receivingWarehouseCode: z.string().nullish(),
  needByDate: z.string(),
  expectedCompletionDate: z.string().nullish(),
  cartons: z.number().int(),
  receivedCartons: z.number().int(),
  alerts: z.array(delayFlagDto).default([]),
});

/** BE `ShortDeliveryBatch` — đợt còn thiếu thùng mà chưa Đơn sản xuất đang mở nào phủ. */
export const shortDeliveryBatchDto = z.object({
  salesOrderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string().nullish(),
  shippingWarehouseId: z.string(),
  shippingWarehouseCode: z.string().nullish(),
  deliveryBatchId: z.string(),
  seq: z.number().int(),
  windowStart: z.string().nullish(),
  windowEnd: z.string().nullish(),
  shortCartons: z.number().int(),
  lines: z
    .array(z.object({ orderLineId: z.string(), sku: z.string(), cartons: z.number().int() }))
    .default([]),
  alerts: z.array(delayFlagDto).default([]),
});

/** BE `ProductionSchedule`. `truncated` = một danh sách bị cắt ở `limit`. */
export const productionScheduleDto = z.object({
  productionOrders: z.array(scheduledProductionOrderDto).default([]),
  shortBatches: z.array(shortDeliveryBatchDto).default([]),
  truncated: z.boolean(),
});

export type DelayFlag = z.infer<typeof delayFlagDto>;
export type ScheduledProductionOrder = z.infer<typeof scheduledProductionOrderDto>;
export type ShortDeliveryBatch = z.infer<typeof shortDeliveryBatchDto>;
export type ProductionSchedule = z.infer<typeof productionScheduleDto>;

export interface ProductionScheduleParams {
  producerId?: string;
  warehouseId?: string;
  /** "yyyy-MM-dd" — lọc theo ngày cần hàng / ngày bắt đầu cửa sổ giao. */
  from?: string;
  to?: string;
  alertsOnly?: boolean;
  limit?: number;
}
