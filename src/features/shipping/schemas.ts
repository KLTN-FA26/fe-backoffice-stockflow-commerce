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
  CARRIER_CONNECTION_TYPES,
  CARRIER_STATUSES,
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

/** `ShipmentStatus` của lô giao (docs 09 §5). */
export const shipmentStatusSchema = tolerantEnum(PACK_SHIPMENT_API_STATUSES);

/* ── Hãng vận chuyển ─────────────────────────────────────────────────── */

/**
 * BE `CarrierResponse.Connection` — cách hãng kết nối (docs 09 §4.1). Khoá bí mật chỉ đi vào, không bao giờ đi ra:
 * BE chỉ nói đã đặt hay chưa (`*Configured`).
 */
export const beCarrierConnectionSchema = z.object({
  connectionType: tolerantEnum(CARRIER_CONNECTION_TYPES),
  webhookEnabled: z.boolean().nullish(),
  webhookSecretConfigured: z.boolean().nullish(),
  webhookAuthHeader: z.string().nullish(),
  webhookAuthValueConfigured: z.boolean().nullish(),
  apiEnvironment: z.string().nullish(),
  apiAccount: z.string().nullish(),
  apiKeyConfigured: z.boolean().nullish(),
});

/** BE `CarrierResponse` — hãng trong danh mục (docs 09 §3: tên và liên hệ) kèm kiểu kết nối. */
export const beCarrierSchema = z.object({
  carrierId: z.string(),
  code: z.string(),
  name: z.string(),
  contactName: z.string().nullish(),
  contactPhone: z.string().nullish(),
  status: tolerantEnum(CARRIER_STATUSES),
  connection: beCarrierConnectionSchema.nullish(),
  version: z.number().int(),
});

export const beCarrierPageSchema = bePageSchema(beCarrierSchema);

/* ── Lô giao ─────────────────────────────────────────────────────────── */

/** BE `ShipmentRowResponse` — không còn `deliveryMode` / COD (chỉ giao nguyên chuyến, không thu hộ — docs 09 BR-08). */
export const beShipmentRowSchema = z.object({
  shipmentId: z.string(),
  /** `<số đơn>-S<n>`. */
  code: z.string(),
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  warehouseId: z.string(),
  status: shipmentStatusSchema,
  packageCount: count,
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
  taskId: z.string().nullish(),
  partialNote: z.string().nullish(),
  /** Ghi chú nội bộ của lần giao thất bại — không hiện cho khách. */
  failureNote: z.string().nullish(),
  cancelledAt: isoInstant.nullish(),
  packages: z.array(beShipmentParcelSchema),
  timeline: z.array(beShipmentStepSchema),
});
