/**
 * Shipping (module 09) — zod DTO chuyến xe khớp BE PR #137: `LoadRowResponse`, `LoadResponse`,
 * `ManifestResponse`. Quy ước null / enum khoan dung như `schemas.ts`.
 */

import { z } from "zod";

import { LOAD_STATUSES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

import {
  count,
  deliveryModeSchema,
  isoInstant,
  measure,
  shipmentStatusSchema,
  tolerantEnum,
} from "./schemas";

/** `LoadStatus` — giá trị lạ → UNKNOWN (không thao tác nào được mở). */
export const loadStatusSchema = tolerantEnum(LOAD_STATUSES);

/** BE `LoadRowResponse`. `packageCount`: kiện ĐÃ quét lên xe; `codTotal`: COD theo nhãn khi đang xếp, theo đơn khi đã bàn giao. */
export const beLoadRowSchema = z.object({
  loadId: z.string(),
  code: z.string(),
  warehouseId: z.string(),
  mode: deliveryModeSchema,
  status: loadStatusSchema,
  carrierId: z.string().nullish(),
  carrierName: z.string().nullish(),
  vehiclePlate: z.string().nullish(),
  driverName: z.string().nullish(),
  shipmentCount: count,
  packageCount: count,
  codTotal: measure.nullish(),
  loadingStartedAt: isoInstant.nullish(),
  dispatchedAt: isoInstant.nullish(),
  version: z.number().int(),
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

/** BE `LoadResponse.Shipment` — `labelCodAmount`: COD trên nhãn; `codAmount`: số đơn chốt, chỉ có sau bàn giao. */
export const beLoadShipmentSchema = z.object({
  shipmentId: z.string(),
  code: z.string(),
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  status: shipmentStatusSchema,
  packageCount: count,
  loadedCount: count,
  labelCodAmount: measure.nullish(),
  codAmount: measure.nullish(),
  /** Tiền tệ riêng của lô (BE #137 bổ sung); thiếu thì dùng `currency` của chuyến. */
  currency: z.string().nullish(),
  /** Task đóng gói của đơn — đích của lối "in lại nhãn" (BE #137 bổ sung). */
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
  mode: deliveryModeSchema,
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
  codTotal: measure.nullish(),
  currency: z.string().nullish(),
  version: z.number().int(),
  shipments: z.array(beLoadShipmentSchema),
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

/** BE `ManifestResponse.Shipment` — `codChangedSinceLabel`: số thu theo đơn khác nhãn (tiền về sau khi in nhãn). */
export const beManifestShipmentSchema = z.object({
  shipmentCode: z.string(),
  orderNumber: z.string().nullish(),
  recipientName: z.string().nullish(),
  recipientPhone: z.string().nullish(),
  deliveryAddress: z.string().nullish(),
  packageCount: count,
  weightKg: measure.nullish(),
  codAmount: measure.nullish(),
  codChangedSinceLabel: z.boolean(),
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
  codTotal: measure.nullish(),
  currency: z.string().nullish(),
  printedAt: isoInstant,
});
