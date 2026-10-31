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
  UNLOAD_REASON_CODES,
  VEHICLE_TYPE_KINDS,
  VEHICLE_TYPE_STATUSES,
} from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

import { LayoutSchema } from "./schemas";

/** BE `UnloadReasonCode` (SCRUM-474 UNLOAD-DESIGN điểm 7): XE_HONG, SAI_XE, KIEN_KHONG_VUA, KHAC. */
const unloadReasonCodeSchema = z.enum(UNLOAD_REASON_CODES);

export const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/** `LoadPlans.ParcelView`: kiện kèm xe đã xếp (`vehicleSeq`) hoặc lý do chưa xếp (`unplacedReason`). */
export const beParcelSchema = z.object({
  packageId: z.string(),
  labelCode: z.string(),
  /** Vắng khi kiện thuộc một lệnh chuyển kho (nguồn TRANSFER): khi đó chỉ có `transferOrderId` (BE PR #164). */
  shipmentId: z.string().nullish(),
  shipmentCode: z.string().nullish(),
  transferOrderId: z.string().nullish(),
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

/**
 * `LoadPlans.CandidateShipment`: lô giao nguyên xe chờ xuất, nguyên lô (LP-5). Với `sourceType=TRANSFER` (BE PR #164)
 * là MỘT lệnh chuyển kho đã đóng gói: `shipmentId` / `orderId` / `orderNumber` vắng, `code` là số lệnh, `readyAt` lúc đóng gói
 * xong, `transferOrderId` + `toWarehouseId` nêu lệnh và kho đích.
 */
export const beCandidateShipmentSchema = z.object({
  sourceType: z.string().nullish(),
  shipmentId: z.string().nullish(),
  transferOrderId: z.string().nullish(),
  toWarehouseId: z.string().nullish(),
  code: z.string(),
  orderId: z.string().nullish(),
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
  /** ORDER / TRANSFER (BE PR #164); vắng ở BE cũ = ORDER. */
  sourceType: z.string().nullish(),
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

/** `LoadPlans.TransferInPlan`: lệnh chuyển kho của kế hoạch nguồn TRANSFER (số lệnh, hai kho, trạng thái, số kiện). */
export const beTransferInPlanSchema = z.object({
  transferOrderId: z.string(),
  number: z.string(),
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  status: z.string(),
  packageCount: z.number().int(),
});

const beAcknowledgementSchema = z.object({
  at: z.string(),
  by: z.string().nullish(),
  note: z.string().nullish(),
});

/**
 * `LoadPlans.PendingUnload`: kiện còn phải quét dỡ khỏi xe của kế hoạch — của đơn đã huỷ khi xe đang xếp (không có `reasonCode`)
 * hoặc của xe đã huỷ có kiểm soát (SCRUM-474, có `reasonCode`); bị khoá tới khi dỡ. `loadId` là chuyến cần quét dỡ (`POST /loads/{loadId}/unloads`); `shipmentCode` là mã lô hoặc số lệnh chuyển kho.
 */
export const bePlanPendingUnloadSchema = z.object({
  loadId: z.string(),
  loadCode: z.string(),
  vehicleSeq: z.number().int().nullish(),
  packageId: z.string(),
  labelCode: z.string(),
  shipmentId: z.string().nullish(),
  transferOrderId: z.string().nullish(),
  shipmentCode: z.string().nullish(),
  reasonCode: unloadReasonCodeSchema.nullish(),
  reason: z.string().nullish(),
  requestedAt: z.string().nullish(),
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
  /** Rỗng ở kế hoạch nguồn TRANSFER (lệnh chuyển kho nằm ở `transferOrder`). */
  shipments: z.array(beShipmentInPlanSchema),
  /** Chỉ có ở kế hoạch nguồn TRANSFER (BE PR #164). */
  transferOrder: beTransferInPlanSchema.nullish(),
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
  /** Mã lý do khi huỷ có kiểm soát (SCRUM-474); `cancelReason` là ghi chú. */
  cancelReasonCode: unloadReasonCodeSchema.nullish(),
  /** Kiện còn phải dỡ khỏi xe (đơn đã huỷ hoặc xe đã huỷ có kiểm soát); vắng = không có. */
  pendingUnloads: z.array(bePlanPendingUnloadSchema).nullish(),
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
  /** Cửa thùng (LP3-DOOR): vắng = không giới hạn; trình soạn xếp tay dùng để kiểm trước vế cửa. */
  doorWidthMm: z.number().int().nullish(),
  doorHeightMm: z.number().int().nullish(),
  availableCount: z.number().int(),
  status: z.enum(VEHICLE_TYPE_STATUSES),
});

export const beVehicleTypeOptionPageSchema = bePageSchema(beVehicleTypeOptionSchema);
