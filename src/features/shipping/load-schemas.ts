/**
 * Shipping (module 09) — zod DTO chuyến xe khớp BE `LoadRowResponse`, `LoadResponse`, `ManifestResponse`
 * (sau đợt bỏ gửi kiện 2026-11-08): không còn `mode`, COD, lệnh chuyển kho, bộ kiện / nhãn cũ. Trường riêng của
 * xe (kế hoạch, đặt xe, mã vận đơn) ở `ftl-schemas.ts`. Quy ước null / enum khoan dung như `schemas.ts`.
 */

import { z } from "zod";

import { LOAD_STATUSES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

import { ftlLoadFields, ftlManifestFields, ftlRowFields } from "./ftl-schemas";
import { count, isoInstant, measure, shipmentStatusSchema, tolerantEnum } from "./schemas";

/** `LoadStatus` — giá trị lạ → UNKNOWN (không thao tác nào được mở). */
export const loadStatusSchema = tolerantEnum(LOAD_STATUSES);

/** BE `LoadRowResponse`. `packageCount`: kiện ĐÃ quét lên xe. */
export const beLoadRowSchema = z.object({
  loadId: z.string(),
  code: z.string(),
  warehouseId: z.string(),
  status: loadStatusSchema,
  carrierId: z.string().nullish(),
  carrierName: z.string().nullish(),
  vehiclePlate: z.string().nullish(),
  driverName: z.string().nullish(),
  shipmentCount: count,
  packageCount: count,
  loadingStartedAt: isoInstant.nullish(),
  dispatchedAt: isoInstant.nullish(),
  version: z.number().int(),
  ...ftlRowFields,
});

export const beLoadPageSchema = bePageSchema(beLoadRowSchema);

/** BE `LoadResponse.Parcel` — một kiện của lô trên chuyến, đã quét lên xe chưa. */
export const beLoadParcelSchema = z.object({
  packageId: z.string(),
  /** `PKG-<số đơn>-<n>` — mã trên nhãn, mã quét. */
  labelCode: z.string(),
  weightKg: measure.nullish(),
  loaded: z.boolean(),
  loadedAt: isoInstant.nullish(),
  loadedBy: z.string().nullish(),
});

/** BE `LoadResponse.Shipment` — một lô giao trên xe; `taskId`: task đóng gói của đơn. */
export const beLoadShipmentSchema = z.object({
  shipmentId: z.string(),
  code: z.string(),
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  status: shipmentStatusSchema,
  packageCount: count,
  loadedCount: count,
  taskId: z.string().nullish(),
  packages: z.array(beLoadParcelSchema),
});

/**
 * BE `LoadResponse` — chuyến kèm biên bản: các lô, kiện của từng lô và kiện nào đã lên xe.
 * `version` gửi lại khi bàn giao (409 OPTIMISTIC_LOCK nếu đã đổi).
 */
export const beLoadSchema = z.object({
  loadId: z.string(),
  code: z.string(),
  warehouseId: z.string(),
  status: loadStatusSchema,
  carrierId: z.string().nullish(),
  carrierCode: z.string().nullish(),
  carrierName: z.string().nullish(),
  vehiclePlate: z.string().nullish(),
  driverName: z.string().nullish(),
  driverPhone: z.string().nullish(),
  loadingStartedAt: isoInstant.nullish(),
  loadingStartedBy: z.string().nullish(),
  dispatchedAt: isoInstant.nullish(),
  dispatchedBy: z.string().nullish(),
  dispatchedByName: z.string().nullish(),
  carrierRepresentative: z.string().nullish(),
  signatureRef: z.string().nullish(),
  handoverNote: z.string().nullish(),
  cancelledAt: isoInstant.nullish(),
  cancelReason: z.string().nullish(),
  shipmentCount: count,
  /** Kiện đã niêm phong của các lô trên biên bản. */
  expectedPackageCount: count,
  loadedPackageCount: count,
  version: z.number().int(),
  shipments: z.array(beLoadShipmentSchema),
  ...ftlLoadFields,
});

/* ── Biên bản in ─────────────────────────────────────────────────────── */

export const beManifestParcelSchema = z.object({
  labelCode: z.string(),
  weightKg: measure.nullish(),
  lengthCm: measure.nullish(),
  widthCm: measure.nullish(),
  heightCm: measure.nullish(),
  loaded: z.boolean(),
});

/** BE `ManifestResponse.Shipment` — không còn COD (docs 09 BR-08: không thu hộ khi giao). */
export const beManifestShipmentSchema = z.object({
  shipmentCode: z.string(),
  orderNumber: z.string().nullish(),
  recipientName: z.string().nullish(),
  recipientPhone: z.string().nullish(),
  deliveryAddress: z.string().nullish(),
  packageCount: count,
  weightKg: measure.nullish(),
  packages: z.array(beManifestParcelSchema),
});

/** BE `ManifestResponse` (docs 09 §3 "Biên bản bàn giao", §4.1 bước 3). */
export const beManifestSchema = z.object({
  loadCode: z.string(),
  status: loadStatusSchema,
  warehouseName: z.string().nullish(),
  warehouseAddress: z.string().nullish(),
  carrierCode: z.string().nullish(),
  carrierName: z.string().nullish(),
  carrierContactName: z.string().nullish(),
  carrierContactPhone: z.string().nullish(),
  vehiclePlate: z.string().nullish(),
  driverName: z.string().nullish(),
  driverPhone: z.string().nullish(),
  carrierRepresentative: z.string().nullish(),
  signatureRef: z.string().nullish(),
  handoverNote: z.string().nullish(),
  dispatchedAt: isoInstant.nullish(),
  dispatchedByName: z.string().nullish(),
  shipments: z.array(beManifestShipmentSchema),
  shipmentCount: count,
  packageCount: count,
  totalWeightKg: measure.nullish(),
  printedAt: isoInstant,
  ...ftlManifestFields,
});

/** BE `ControlledCancelResponse` (SCRUM-474): chuyến vừa huỷ có kiểm soát và chuyến thay thế (null khi xe đã huỷ từ trước). */
export const beControlledCancelSchema = z.object({
  cancelled: beLoadSchema,
  replacement: beLoadSchema.nullish(),
});
