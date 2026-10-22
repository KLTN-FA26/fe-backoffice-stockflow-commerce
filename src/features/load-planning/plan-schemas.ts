/**
 * Kế hoạch xếp xe (BE PR #161 `LoadPlanController`, record `LoadPlans.*`) — DTO trả về, parse tại biên API.
 * BE `default-property-inclusion: non_null`: trường chưa có bị BỎ khỏi JSON → `.nullish()`; mảng luôn có mặt.
 * Mọi chiều dài là mm, khối lượng kg (BigDecimal → số JSON, nhận cả chuỗi số).
 */

import { z } from "zod";

import {
  LOAD_PLAN_SELECTION_MODES,
  LOAD_PLAN_STATUSES,
  LOAD_PLAN_UNPLACED_REASONS,
  VEHICLE_TYPE_KINDS,
  VEHICLE_TYPE_STATUSES,
} from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

import { LayoutSchema } from "./schemas";

export const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/** `LoadPlans.ParcelView`: kiện kèm xe đã xếp (`vehicleSeq`) hoặc lý do chưa xếp (`unplacedReason`). */
export const beParcelSchema = z.object({
  packageId: z.string(),
  labelCode: z.string(),
  shipmentId: z.string(),
  shipmentCode: z.string(),
  /** SKU; kiện của bộ là `SKU n/N`, kiện hỗn hợp là `SKU1 + SKU2`. */
  partName: z.string(),
  lengthMm: z.number().int(),
  widthMm: z.number().int(),
  heightMm: z.number().int(),
  weightKg: beDecimal,
  rotatable: z.boolean(),
  kitGroupId: z.string().nullish(),
  kitPartNo: z.number().int().nullish(),
  kitPartCount: z.number().int().nullish(),
  vehicleSeq: z.number().int().nullish(),
  unplacedReason: z.enum(LOAD_PLAN_UNPLACED_REASONS).nullish(),
});

/** `LoadPlans.CandidateShipment`: lô giao nguyên xe chờ xuất, nguyên lô (LP-5). */
export const beCandidateShipmentSchema = z.object({
  shipmentId: z.string(),
  code: z.string(),
  orderId: z.string(),
  /** Vắng khi BE không tra được đơn của lô. */
  orderNumber: z.string().nullish(),
  allowPartialShipment: z.boolean(),
  readyAt: z.string().nullish(),
  packageCount: z.number().int(),
  /** Kiện của lô mà kế hoạch khác đang giữ (chỉ xảy ra sau khi một kế hoạch để lại kiện). */
  packagesInOtherPlans: z.number().int(),
  weightKg: beDecimal,
  volumeMm3: z.number(),
  packages: z.array(beParcelSchema),
});

export const beCandidateListSchema = z.array(beCandidateShipmentSchema);

/** `LoadPlans.PlanRow`. */
export const bePlanRowSchema = z.object({
  loadPlanId: z.string(),
  code: z.string(),
  warehouseId: z.string(),
  status: z.enum(LOAD_PLAN_STATUSES),
  selectionMode: z.enum(LOAD_PLAN_SELECTION_MODES),
  shipmentCount: z.number().int(),
  packageCount: z.number().int(),
  vehicleCount: z.number().int(),
  unplacedCount: z.number().int(),
  createdAt: z.string(),
  calculatedAt: z.string().nullish(),
  confirmedAt: z.string().nullish(),
  version: z.number().int(),
});

export const bePlanRowPageSchema = bePageSchema(bePlanRowSchema);

const beVehicleTypeChoiceSchema = z.object({
  vehicleTypeId: z.string(),
  code: z.string(),
  name: z.string(),
  kind: z.enum(VEHICLE_TYPE_KINDS),
  availableCount: z.number().int(),
  status: z.enum(VEHICLE_TYPE_STATUSES),
});

const beShipmentInPlanSchema = z.object({
  shipmentId: z.string(),
  code: z.string(),
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  allowPartialShipment: z.boolean(),
  packageCount: z.number().int(),
});

/** Chuyến xe (dispatch load) mà một xe đã chốt trở thành; PLANNED tới khi PR E đặt xe. */
const beLoadRefSchema = z.object({
  loadId: z.string(),
  code: z.string(),
  status: z.string(),
});

/** `LoadPlans.VehicleSummary`; `needsRecalculation`: bị bỏ kiện (đơn bị huỷ), cần tính lại trước khi chốt. */
export const beVehicleSummarySchema = z.object({
  seq: z.number().int(),
  loadPlanVehicleId: z.string(),
  vehicleTypeId: z.string(),
  code: z.string(),
  packageCount: z.number().int(),
  usedVolumeMm3: z.number(),
  usedWeightKg: beDecimal,
  volumeFillPct: beDecimal,
  weightFillPct: beDecimal,
  load: beLoadRefSchema.nullish(),
  needsRecalculation: z.boolean().default(false),
});

const beAcknowledgementSchema = z.object({
  at: z.string(),
  by: z.string().nullish(),
  note: z.string().nullish(),
});

/** `LoadPlans.PlanDetail`. `version` gửi lại ở mọi thay đổi (409 OPTIMISTIC_LOCK nếu đã đổi). */
export const bePlanDetailSchema = z.object({
  loadPlanId: z.string(),
  code: z.string(),
  warehouseId: z.string(),
  sourceType: z.string().nullish(),
  selectionMode: z.enum(LOAD_PLAN_SELECTION_MODES),
  status: z.enum(LOAD_PLAN_STATUSES),
  note: z.string().nullish(),
  vehicleTypes: z.array(beVehicleTypeChoiceSchema),
  shipments: z.array(beShipmentInPlanSchema),
  vehicles: z.array(beVehicleSummarySchema),
  packages: z.array(beParcelSchema),
  packageCount: z.number().int(),
  placedCount: z.number().int(),
  unplacedCount: z.number().int(),
  unplacedAcknowledgement: beAcknowledgementSchema.nullish(),
  calculatedAt: z.string().nullish(),
  /** Siêu dữ liệu solver (thuật toán, số xe tối thiểu, hết thời gian…) — chỉ để tham khảo. */
  solverMeta: z.record(z.string(), z.unknown()).nullish(),
  confirmedAt: z.string().nullish(),
  reopenedAt: z.string().nullish(),
  reopenReason: z.string().nullish(),
  dispatchedAt: z.string().nullish(),
  cancelledAt: z.string().nullish(),
  cancelReason: z.string().nullish(),
  createdAt: z.string(),
  version: z.number().int(),
});

/** `GET load-plans/{id}/layouts`: Layout của từng xe theo `seq`. */
export const beLayoutListSchema = z.array(LayoutSchema);

/** Loại xe cho ô chọn (GET /fulfillment/vehicle-types, đủ trường FE cần để chọn). */
export const beVehicleTypeOptionSchema = z.object({
  vehicleTypeId: z.string(),
  code: z.string(),
  name: z.string(),
  kind: z.enum(VEHICLE_TYPE_KINDS),
  innerLengthMm: z.number().int(),
  innerWidthMm: z.number().int(),
  innerHeightMm: z.number().int(),
  maxPayloadKg: beDecimal,
  availableCount: z.number().int(),
  status: z.enum(VEHICLE_TYPE_STATUSES),
});

export const beVehicleTypeOptionPageSchema = bePageSchema(beVehicleTypeOptionSchema);
