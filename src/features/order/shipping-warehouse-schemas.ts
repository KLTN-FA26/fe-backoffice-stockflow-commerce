/**
 * Kho xuất của đơn — schema (BE `ShippingWarehouseService`, docs 17 §4.2 bước 2-3, BR-21, BR-22, BR-25).
 *
 * Hai lớp, KHÔNG trộn (api-conventions §3.1): DTO = hình dạng BE trả (`Options`, `Coverage` — record trong
 * `ShippingWarehouseService`), parse MỘT lần ở `shipping-warehouse-api.ts`; Input = form Sale gửi đi.
 * BE bật `default-property-inclusion: non_null` nên field null bị bỏ khỏi JSON → `.nullish()`.
 */

import { z } from "zod";

const cartonCount = z.number().int().nonnegative();
const volumeM3 = z.number().nullish();

/** BE `LineAvailability`: dòng hàng tại một kho — số thùng đặt và số thùng còn khả dụng ở kho đó. */
export const shippingLineAvailabilitySchema = z.object({
  lineId: z.string(),
  sku: z.string(),
  cartons: cartonCount,
  availableCartons: cartonCount,
});

/**
 * BE `Option`: một kho đơn có thể xuất từ đó + sức chứa (m³, docs 06 §4.6). `neededM3` null khi thùng của một SKU chưa có
 * kích thước; `exceedsProjected` / `exceedsIfAllApproved` là CẢNH BÁO (BR-25), không bao giờ là từ chối.
 */
export const shippingWarehouseOptionSchema = z.object({
  warehouseId: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  holdsEveryLine: z.boolean(),
  availableCartons: cartonCount,
  lines: z.array(shippingLineAvailabilitySchema).default([]),
  projectedFreeM3: volumeM3,
  pendingM3: volumeM3,
  freeIfAllApprovedM3: volumeM3,
  neededM3: volumeM3,
  exceedsProjected: z.boolean().default(false),
  exceedsIfAllApproved: z.boolean().default(false),
});

/** BE `Options`: các kho xếp theo gợi ý (tốt nhất đầu danh sách — docs 17 §4.2 bước 2, C3) + kho đã chọn (nếu có). */
export const shippingWarehouseOptionsSchema = z.object({
  orderId: z.string(),
  chosenWarehouseId: z.string().nullish(),
  warehouses: z.array(shippingWarehouseOptionSchema).default([]),
});

/** BE `LineCoverage`: một dòng hàng — cần, đã giữ, còn thiếu (thùng). */
export const shippingLineCoverageSchema = z.object({
  lineId: z.string(),
  sku: z.string(),
  cartons: cartonCount,
  heldCartons: cartonCount,
  shortCartons: cartonCount,
});

/** BE `BatchCoverage`: tình trạng giữ hàng của một đợt giao (đợt sớm nhất được giữ trước — docs 17 §4.2 bước 3). */
export const shippingBatchCoverageSchema = z.object({
  seq: z.number().int(),
  fullyHeld: z.boolean(),
  lines: z.array(shippingLineCoverageSchema).default([]),
});

/** BE `Coverage`: tình trạng giữ hàng của đơn ở kho xuất — cũng là kết quả của `PUT /orders/{id}/shipping-warehouse`. */
export const shippingCoverageSchema = z.object({
  orderId: z.string(),
  warehouseId: z.string().nullish(),
  warehouseCode: z.string().nullish(),
  /** Optional (BE#488): absent from an older BE, then the card shows the code only. */
  warehouseName: z.string().nullish(),
  fullyHeld: z.boolean(),
  lines: z.array(shippingLineCoverageSchema).default([]),
  batches: z.array(shippingBatchCoverageSchema).default([]),
});

/** Input form: kho Sale chọn (BE `ChooseShippingWarehouseRequest.warehouseId`, bắt buộc). */
export const chooseShippingWarehouseSchema = z.object({
  warehouseId: z.string().min(1, "Chọn một kho xuất"),
});

export type ShippingLineAvailability = z.infer<typeof shippingLineAvailabilitySchema>;
export type ShippingWarehouseOption = z.infer<typeof shippingWarehouseOptionSchema>;
export type ShippingWarehouseOptions = z.infer<typeof shippingWarehouseOptionsSchema>;
export type ShippingLineCoverage = z.infer<typeof shippingLineCoverageSchema>;
export type ShippingBatchCoverage = z.infer<typeof shippingBatchCoverageSchema>;
export type ShippingCoverage = z.infer<typeof shippingCoverageSchema>;
export type ChooseShippingWarehouseValues = z.infer<typeof chooseShippingWarehouseSchema>;
