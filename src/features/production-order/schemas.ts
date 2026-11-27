/**
 * Đơn sản xuất (kltn-docs 17 §4.3, §5.3; BE `ProductionOrderController`, `ProductionOrderDispatchController`) — DTO
 * parse một lần tại biên API. BE `non_null`: field null vắng mặt → `.nullish()`. Ngày `LocalDate` = "yyyy-MM-dd",
 * thời điểm `Instant` = ISO. Đơn sản xuất không ghi tiền (be#383, docs 17 BR-31 chốt 2026-11-19).
 */

import { z } from "zod";

import { PRODUCTION_ORDER_STATUSES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/** BE `BigDecimal` → số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

export const productionOrderStatusSchema = z.enum(PRODUCTION_ORDER_STATUSES);

/** BE `ProductionOrderLine`. */
export const productionOrderLineDto = z.object({
  id: z.string(),
  orderLineId: z.string(),
  sku: z.string(),
  cartons: z.number().int(),
  unitsPerCarton: z.number().int(),
  totalUnits: z.number().int(),
  designSnapshotId: z.string().nullish(),
  printFileChecksum: z.string().nullish(),
  packingRequirements: z.string().nullish(),
  receivedCartons: z.number().int(),
});

/** BE `ProductionOrderHistoryEntry` — `by` vắng khi hệ thống chuyển (nhập kho, khách duyệt mẫu). */
export const productionOrderHistoryDto = z.object({
  from: productionOrderStatusSchema.nullish(),
  to: productionOrderStatusSchema,
  reason: z.string().nullish(),
  by: z.string().nullish(),
  /** Họ tên người thao tác (FE#286); vắng khi hệ thống chuyển hoặc tài khoản không còn. */
  byName: z.string().nullish(),
  at: z.string(),
});

/**
 * Phần bảng sức chứa kho nhận FE dùng (BE `WarehouseCapacityService.Board`) — feature không import chéo
 * `warehouse-capacity` (feature-architecture), zod bỏ field thừa.
 */
export const capacityBoardSliceDto = z.object({
  warehouseId: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  projectedFreeM3: beDecimal,
  pendingM3: beDecimal,
  freeIfAllApprovedM3: beDecimal,
});

/**
 * BR-25 (docs 17 §4.3 bước 6–7): bảng sức chứa kho nhận lúc đọc và thể tích đơn còn mang về có vừa không — chỉ
 * cảnh báo, không chặn. Vắng khi kho không còn.
 */
export const productionOrderCapacityDto = z.object({
  board: capacityBoardSliceDto,
  neededM3: beDecimal.nullish(),
  exceedsProjected: z.boolean(),
  exceedsIfAllApproved: z.boolean(),
  shortfallM3: beDecimal.nullish(),
});

/** BE `ProductionOrder` — danh sách không có `history`. */
export const productionOrderDto = z.object({
  id: z.string(),
  code: z.string(),
  salesOrderId: z.string(),
  deliveryBatchId: z.string(),
  customerId: z.string().nullish(),
  producerId: z.string(),
  receivingWarehouseId: z.string(),
  needByDate: z.string(),
  status: productionOrderStatusSchema,
  sampleApprovalRequired: z.boolean(),
  sampleRequiredByDefault: z.boolean(),
  sampleWaiverReason: z.string().nullish(),
  note: z.string().nullish(),
  drawnUpBy: z.string(),
  // Chỉ còn ở đơn trước 2026-11-20 (bỏ bước duyệt, docs 17 BR-23) — BE vẫn trả cho đơn cũ
  submittedAt: z.string().nullish(),
  approvedBy: z.string().nullish(),
  approvedAt: z.string().nullish(),
  returnedReason: z.string().nullish(),
  sentAt: z.string().nullish(),
  /** Người gửi cho đơn vị sản xuất (đơn trước 2026-11-20: người duyệt). */
  sentBy: z.string().nullish(),
  productionStartedAt: z.string().nullish(),
  expectedCompletionDate: z.string().nullish(),
  /** Ghi chú khi ghi nhận nhận đơn (docs 17 §4.3 bước 8) — ghi một lần. */
  acceptanceNote: z.string().nullish(),
  cancelledAt: z.string().nullish(),
  cancellationReason: z.string().nullish(),
  closedAt: z.string().nullish(),
  closingReason: z.string().nullish(),
  capacity: productionOrderCapacityDto.nullish(),
  lines: z.array(productionOrderLineDto),
  history: z.array(productionOrderHistoryDto).nullish(),
  version: z.number().int(),
  // Tên đi kèm id (BE FE#286): hiện tên thay UUID / mã. `.nullish()` vì BE `non_null` bỏ trường khi không tra được.
  salesOrderNumber: z.string().nullish(),
  customerName: z.string().nullish(),
  customerCode: z.string().nullish(),
  producerName: z.string().nullish(),
  receivingWarehouseCode: z.string().nullish(),
  receivingWarehouseName: z.string().nullish(),
  drawnUpByName: z.string().nullish(),
  approvedByName: z.string().nullish(),
  sentByName: z.string().nullish(),
});

export const productionOrderPageDto = bePageSchema(productionOrderDto);

export * from "./dispatch-schemas";
