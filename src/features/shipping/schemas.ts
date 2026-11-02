/**
 * Shipping (module 09) — zod DTO khớp BE PR #137 (SCRUM-288/292/293): `CarrierResponse`,
 * `ShipmentRowResponse`, `ShipmentResponse`.
 *
 * BE bật Jackson `non_null` → field null bị BỎ khỏi JSON nên field tuỳ chọn khai `.nullish()`; kiểu
 * nguyên thuỷ Java (int, long, boolean) luôn có mặt nên giữ bắt buộc. `BigDecimal` về dạng số JSON,
 * `Instant` về chuỗi ISO. Enum khoan dung (`.catch("UNKNOWN")`): giá trị BE thêm sau không làm hỏng
 * cả trang, màn hiện "Không rõ" và không mở thao tác nào.
 * Không có `trackingNumber` / `awb`: hãng là bên thứ ba (rescope 2026-10-06).
 */

import { z } from "zod";

import {
  CARRIER_STATUSES,
  DELIVERY_MODES,
  PACKAGE_API_STATUSES,
  PACK_SHIPMENT_API_STATUSES,
} from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

export const count = z.number().int().min(0);
export const measure = z.number().nonnegative();
export const isoInstant = z.iso.datetime({ offset: true });

export function tolerantEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum([...values, "UNKNOWN"]).catch("UNKNOWN");
}

export const deliveryModeSchema = tolerantEnum(DELIVERY_MODES);
/** `ShipmentStatus` của lô giao (docs 09 §5). */
export const shipmentStatusSchema = tolerantEnum(PACK_SHIPMENT_API_STATUSES);

/* ── Hãng vận chuyển ─────────────────────────────────────────────────── */

/** BE `CarrierResponse` — hãng trong danh mục (docs 09 §3: tên và liên hệ). */
export const beCarrierSchema = z.object({
  carrierId: z.string(),
  code: z.string(),
  name: z.string(),
  contactName: z.string().nullish(),
  contactPhone: z.string().nullish(),
  status: tolerantEnum(CARRIER_STATUSES),
  version: z.number().int(),
});

export const beCarrierPageSchema = bePageSchema(beCarrierSchema);

/* ── Lô giao ─────────────────────────────────────────────────────────── */

/** BE `ShipmentRowResponse`. `codAmount`: số hãng thu — của nhãn tới khi bàn giao chốt (BR-04). */
export const beShipmentRowSchema = z.object({
  shipmentId: z.string(),
  /** `<số đơn>-S<n>`. */
  code: z.string(),
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  warehouseId: z.string(),
  status: shipmentStatusSchema,
  deliveryMode: deliveryModeSchema,
  packageCount: count,
  codAmount: measure.nullish(),
  /** Tiền tệ của `codAmount` (BE #137 bổ sung; thiếu thì chỉ hiện "có thu hộ"). */
  currency: z.string().nullish(),
  /** Task xuất kho / đóng gói của đơn — đích của lối "in lại nhãn" (BE #137 bổ sung). */
  taskId: z.string().nullish(),
  carrierId: z.string().nullish(),
  carrierName: z.string().nullish(),
  /** Chuyến đang mở hoặc đã bàn giao; vắng khi lô chưa lên chuyến nào. */
  loadId: z.string().nullish(),
  loadCode: z.string().nullish(),
  partial: z.boolean(),
  readyAt: isoInstant.nullish(),
  handedOverAt: isoInstant.nullish(),
  outcomeAt: isoInstant.nullish(),
  failureReason: z.string().nullish(),
  /** Bàn giao trước khi có chuyến — không biên bản nào nêu lô này. */
  wholeOrderHandover: z.boolean(),
  version: z.number().int(),
});

export const beShipmentPageSchema = bePageSchema(beShipmentRowSchema);

/** BE `ShipmentResponse.Parcel`. */
export const beShipmentParcelSchema = z.object({
  packageId: z.string(),
  labelCode: z.string(),
  status: tolerantEnum(PACKAGE_API_STATUSES),
  weightKg: measure.nullish(),
  lengthCm: measure.nullish(),
  widthCm: measure.nullish(),
  heightCm: measure.nullish(),
  /** Nhãn kiện đã cũ — in lại trước khi quét lên xe (BE PR #165); thiếu = còn đúng. */
  labelOutdated: z.boolean().default(false),
  labelOutdatedAt: isoInstant.nullish(),
});

/** BE `ShipmentResponse.Step` — mỗi bước ghi người thực hiện và thời điểm (docs 09 BR-02). */
export const beShipmentStepSchema = z.object({
  status: shipmentStatusSchema,
  occurredAt: isoInstant,
  recordedBy: z.string().nullish(),
  recordedByName: z.string().nullish(),
  note: z.string().nullish(),
});

/** BE `ShipmentResponse` — lô giao kèm kiện và lịch sử (chỉ nhân viên xem). */
export const beShipmentSchema = z.object({
  shipment: beShipmentRowSchema,
  /** BE có thể đặt `taskId` / `currency` ở ngoài hàng lô thay vì trong đó — nhận cả hai chỗ. */
  taskId: z.string().nullish(),
  currency: z.string().nullish(),
  partialNote: z.string().nullish(),
  /** Ghi chú nội bộ của lần giao thất bại — không hiện cho khách. */
  failureNote: z.string().nullish(),
  cancelledAt: isoInstant.nullish(),
  packages: z.array(beShipmentParcelSchema),
  timeline: z.array(beShipmentStepSchema),
});
