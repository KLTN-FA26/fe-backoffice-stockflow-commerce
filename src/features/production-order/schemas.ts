/**
 * Đơn sản xuất (kltn-docs 17 §4.3, §5.3; BE `ProductionOrderController`, `ProductionOrderDispatchController`) — DTO
 * parse một lần tại biên API. BE `non_null`: field null vắng mặt → `.nullish()`. Ngày `LocalDate` = "yyyy-MM-dd",
 * thời điểm `Instant` = ISO. Đơn sản xuất không ghi tiền (be#383, docs 17 BR-31 chốt 2026-11-19).
 */

import { z } from "zod";

import { PRODUCER_CHANNELS, PRODUCTION_ORDER_STATUSES } from "@/constants";
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
  submittedAt: z.string().nullish(),
  approvedBy: z.string().nullish(),
  approvedAt: z.string().nullish(),
  returnedReason: z.string().nullish(),
  sentAt: z.string().nullish(),
  productionStartedAt: z.string().nullish(),
  expectedCompletionDate: z.string().nullish(),
  cancelledAt: z.string().nullish(),
  cancellationReason: z.string().nullish(),
  closedAt: z.string().nullish(),
  closingReason: z.string().nullish(),
  capacity: productionOrderCapacityDto.nullish(),
  lines: z.array(productionOrderLineDto),
  history: z.array(productionOrderHistoryDto).nullish(),
  version: z.number().int(),
});

export const productionOrderPageDto = bePageSchema(productionOrderDto);

/** BE `DownloadLink` — link vài phút, không log. */
export const downloadLinkDto = z.object({ url: z.string(), expiresAt: z.string().nullish() });

/** BE `ProductionOrderMessageAttempt`. */
export const dispatchMessageDto = z.object({
  message: z.string(),
  status: z.string(),
  attemptedAt: z.string().nullish(),
  sentAt: z.string().nullish(),
  failure: z.string().nullish(),
  attemptNumber: z.number().int(),
  recipient: z.string().nullish(),
  generation: z.number().int(),
});

/** BE `ProductionOrderDispatch`: kênh, phiếu đã gửi (vắng khi chưa duyệt) và các lần gửi mail. */
export const dispatchDto = z.object({
  channel: z.enum(PRODUCER_CHANNELS),
  slip: z
    .object({ sha256: z.string(), sizeBytes: z.number().int(), createdAt: z.string() })
    .nullish(),
  messages: bePageSchema(dispatchMessageDto),
});

/** Phần lịch giao của đơn bán FE cần để hiện số đơn + cửa sổ giao (`GET /orders/{id}/delivery-batches`). */
export const salesOrderBatchesDto = z.object({
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  batches: z
    .array(
      z.object({
        batchId: z.string(),
        seq: z.number().int(),
        windowStart: z.string().nullish(),
        windowEnd: z.string().nullish(),
      }),
    )
    .default([]),
});
