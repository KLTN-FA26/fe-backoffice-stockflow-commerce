/**
 * Ước tính xếp xe (SCRUM-287 PR EST, BE PR #160 `LoadEstimateController`) — DTO trả về, parse tại biên API.
 *
 * BE bật Jackson `non_null` nên trường null bị BỎ HẲN khỏi JSON (`partial` của dòng không lẻ, `sourceRef`…) →
 * `.nullish()` rồi chuẩn về null. Mã lạ (rule, reason, mã cảnh báo) giữ nguyên là chuỗi: màn tra bảng nhãn và rơi
 * về chính mã đó, nên BE thêm mã mới không làm hỏng cả ước tính. Trường BE gửi thêm (`volumeFillPct`…) zod bỏ qua.
 */

import { z } from "zod";

import { LOAD_ESTIMATE_LIMITS, LOAD_ESTIMATE_SELECTION_MODES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

import { DimsMmSchema, LayoutSchema, UnplacedLineSchema } from "./schemas";

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const decimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/** Dòng đơn đã quy ra thùng (`LoadEstimates.EstimateLine`): quantity = phần CÒN phải giao, theo đơn vị cơ sở. */
export const EstimateLineSchema = z.object({
  orderLineId: z.string(),
  sku: z.string(),
  inventoryItemId: z.string(),
  quantity: z.number().int(),
  /** Tầng quy tắc đóng gói đã dùng (LP2-2): DEFAULT_SHIPPING_UNIT, LARGEST_PACKING_UNIT, ITEM_BOX, ITEM_UNIT. */
  rule: z.string(),
  uom: z.string(),
  /** Đơn vị cơ sở trong một thùng. */
  factor: z.number().int(),
  /** Số thùng, đã gồm thùng lẻ; mỗi thùng là `kitParts` hộp. */
  cartons: z.number().int().nonnegative(),
  /** Thùng lẻ (LP2-4): thùng đủ cỡ chứa ít đơn vị hơn, khối lượng theo tỉ lệ; vắng khi chẵn thùng. */
  partial: z
    .object({ units: z.number().int(), weightKg: decimal })
    .nullish()
    .transform((value) => value ?? null),
  dimsMm: DimsMmSchema,
  weightKg: decimal,
  rotatable: z.boolean(),
  /** > 1: mỗi thùng là một bộ gồm ngần ấy hộp cùng cỡ (LP2-5). */
  kitParts: z.number().int().positive(),
});

/** Dòng bị chặn vì mặt hàng thiếu kích thước / khối lượng (LP2-3): bị loại khỏi ước tính. */
export const MissingLineSchema = z.object({
  orderLineId: z.string(),
  sku: z.string(),
  inventoryItemId: z.string(),
  /** Trường còn trống: lengthCm, widthCm, heightCm, weightKg. */
  missingFields: z.array(z.string()),
});

export const EstimateWarningSchema = z.object({
  orderLineId: z.string().nullish(),
  sku: z.string().nullish(),
  code: z.string(),
  unitOfMeasure: z.string().nullish(),
  fields: z.array(z.string()).default([]),
});

export const KitWarningSchema = z.object({
  kitName: z.string().nullish(),
  type: z.string(),
  partCode: z.string().nullish(),
  count: z.number().int().nullish(),
});

/** Kiện chưa xếp (nhóm theo dòng, phần, cỡ, lý do): `UnplacedLineSchema` của F1 cộng `sourceRef`, `reason`, `refs`. */
export const EstimateUnplacedSchema = UnplacedLineSchema.extend({
  sourceRef: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  /** TOO_LARGE | TOO_HEAVY | NO_VEHICLE_AVAILABLE | NO_SPACE | SEARCH_CUT_OFF. */
  reason: z.string(),
  refs: z.array(z.string()).default([]),
});

/** Số liệu lần giải: chỉ phần màn dùng; `budgetExhausted` = hết thời gian tính, đây là phương án tốt nhất tìm được. */
export const EstimateMetaSchema = z.object({
  budgetExhausted: z.boolean().default(false),
  budgetMillis: z.number().nullish(),
  elapsedMillis: z.number().nullish(),
  placedBoxes: z.number().int().nullish(),
  unplacedBoxes: z.number().int().nullish(),
  kitWarnings: z.array(KitWarningSchema).default([]),
});

export const LoadEstimateSchema = z.object({
  id: z.string(),
  sourceType: z.string(),
  sourceId: z.string(),
  warehouseId: z.string().nullish(),
  /** CURRENT, hoặc SUPERSEDED khi nguồn đã được ước tính lại. */
  status: z.string(),
  selectionMode: z.string(),
  vehicleTypeIds: z.array(z.string()),
  lines: z.array(EstimateLineSchema),
  missing: z.array(MissingLineSchema),
  /** true đúng khi `missing` không rỗng (BE `ck_load_estimate_incomplete`). */
  incomplete: z.boolean(),
  warnings: z.array(EstimateWarningSchema).default([]),
  vehicles: z.array(LayoutSchema),
  unplaced: z.array(EstimateUnplacedSchema).default([]),
  meta: EstimateMetaSchema,
  createdAt: z.string().nullish(),
  createdBy: z.string().nullish(),
});

/** Loại xe cho ô chọn (`GET /fulfillment/vehicle-types?status=ACTIVE`): chỉ trường màn dùng. */
export const EstimateVehicleTypeSchema = z.object({
  vehicleTypeId: z.string(),
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  maxPayloadKg: decimal,
});

export const EstimateVehicleTypePageSchema = bePageSchema(EstimateVehicleTypeSchema);

/**
 * Yêu cầu ước tính (`LoadEstimateRequest`): `warehouseId` chỉ cho đơn CONFIRMED (chưa release) — đơn đã release dùng kho
 * của nó và BE từ chối kho khác. `vehicleTypeIds` rỗng = mọi loại đang dùng; tối đa 20.
 */
export const CreateEstimateInputSchema = z.object({
  orderId: z.string().min(1),
  warehouseId: z.string().min(1).nullable(),
  vehicleTypeIds: z.array(z.string().min(1)).max(LOAD_ESTIMATE_LIMITS.vehicleTypesMax),
  selectionMode: z.enum(LOAD_ESTIMATE_SELECTION_MODES),
});
