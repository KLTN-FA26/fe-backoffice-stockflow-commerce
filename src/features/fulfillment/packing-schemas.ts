/**
 * Trạm đóng gói — zod DTO, khớp BE `PackingController` + `PackingSessionResponse`, `PackageResponse`,
 * `PackageLabelResponse`, `PackingQueueRowResponse` (BE PR #136, SCRUM-278/281/282).
 *
 * BE bật Jackson `non_null` → field null bị BỎ khỏi JSON nên field tuỳ chọn khai `.nullish()`;
 * kiểu nguyên thuỷ Java (int, boolean) luôn có mặt nên giữ bắt buộc. `BigDecimal` về dạng số JSON.
 * Enum khoan dung (`.catch("UNKNOWN")`): giá trị BE thêm sau không làm hỏng cả phiên đóng gói.
 */

import { z } from "zod";

import {
  DELIVERY_MODES,
  PACKAGE_API_STATUSES,
  PACKAGE_TYPES,
  PACK_API_STATUSES,
  PACK_SHIPMENT_API_STATUSES,
} from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

const count = z.number().int().min(0);
const measure = z.number().nonnegative();

function tolerantEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum([...values, "UNKNOWN"]).catch("UNKNOWN");
}

/** `PackStatus` của phiên đóng gói; giá trị lạ → UNKNOWN (không thao tác nào được mở). */
export const packSessionStatusSchema = tolerantEnum(PACK_API_STATUSES);

/* ── Hàng chờ ────────────────────────────────────────────────────────── */

/** BE `PackingQueueRowResponse` — một đơn đã lấy hàng xong đang chờ ở bàn đóng gói. */
export const bePackingQueueRowSchema = z.object({
  taskId: z.string(),
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  warehouseId: z.string().nullish(),
  packStatus: packSessionStatusSchema,
  pickedAt: z.string().nullish(),
  pickerName: z.string().nullish(),
  /** Người đã nhận đơn ở bàn đóng gói; vắng khi chưa ai nhận. */
  packerId: z.string().nullish(),
  packerName: z.string().nullish(),
  packingStartedAt: z.string().nullish(),
  /** Kiện chưa huỷ; `sealedPackageCount` trong số đó đã niêm phong. */
  packageCount: count,
  sealedPackageCount: count,
  /** Lô giao đã tạo (đơn tách nhiều lô có nhiều). */
  shipmentCount: count,
});

export const bePackingQueuePageSchema = bePageSchema(bePackingQueueRowSchema);

/* ── Phiên đóng gói ──────────────────────────────────────────────────── */

export const bePackLotSchema = z.object({
  lotNumber: z.string(),
  /** Số của lô đã lấy cho dòng. */
  available: count,
  /** Đã đóng vào kiện chưa huỷ. */
  packed: count,
});

/** BE `PackingSessionResponse.Line` — một dòng đơn tại bàn đóng gói. */
export const bePackLineSchema = z.object({
  orderLineId: z.string(),
  sku: z.string(),
  barcode: z.string().nullish(),
  /** Dòng in theo thiết kế khách chốt. */
  printLine: z.boolean(),
  designSnapshotId: z.string().nullish(),
  wanted: count,
  available: count,
  packed: count,
  shipped: count,
  remaining: z.number().int(),
  /** Quét dòng này phải kèm số lô; `lots` liệt kê các lô đã lấy. */
  lotTracked: z.boolean(),
  /** Quét dòng này kèm một serial, từng đơn vị một. */
  serialTracked: z.boolean(),
  lots: z.array(bePackLotSchema),
});

/** BE `PackageResponse.Content` — số đơn vị của một dòng nằm trong kiện, theo lô / serial đã quét. */
export const bePackContentSchema = z.object({
  orderLineId: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  serialNumber: z.string().nullish(),
  quantity: z.number().int().positive(),
});

/** BE `PackageResponse` — một kiện: OPEN → SEALED (cân, đo) → vào lô giao; hoặc VOIDED. */
export const bePackageSchema = z.object({
  packageId: z.string(),
  packageNo: z.number().int().positive(),
  /** `PKG-<số đơn>-<n>` — mã trên nhãn, mã quét khi xếp xe. */
  labelCode: z.string(),
  packageType: tolerantEnum(PACKAGE_TYPES),
  status: tolerantEnum(PACKAGE_API_STATUSES),
  /** Có khi hoàn tất đóng gói đã đưa kiện vào lô giao. */
  shipmentId: z.string().nullish(),
  weightKg: measure.nullish(),
  lengthCm: measure.nullish(),
  widthCm: measure.nullish(),
  heightCm: measure.nullish(),
  dimWeightKg: measure.nullish(),
  rotatable: z.boolean(),
  /** Người đóng đặt cờ khác với mặc định từ SKU bên trong (E13). */
  rotatableOverridden: z.boolean(),
  fragile: z.boolean(),
  fragileOverridden: z.boolean(),
  sealedAt: z.string().nullish(),
  contents: z.array(bePackContentSchema),
});

/** BE `PackingSessionResponse.Shipment` — lô giao do một lần hoàn tất đóng gói tạo ra. */
export const bePackShipmentSchema = z.object({
  shipmentId: z.string(),
  /** `<số đơn>-S<n>`. */
  code: z.string(),
  status: tolerantEnum(PACK_SHIPMENT_API_STATUSES),
  deliveryMode: tolerantEnum(DELIVERY_MODES),
  packageCount: count,
  codAmount: measure.nullish(),
  partial: z.boolean(),
  partialNote: z.string().nullish(),
  readyAt: z.string().nullish(),
});

/** BE `PackingSessionResponse.PaymentDue` — cùng ý nghĩa `bePaymentDueSchema` của task. */
const bePackPaymentDueSchema = z.object({
  amountDueBeforeHandover: measure,
  currency: z.string(),
});

/** BE `PackingSessionResponse` — câu trả lời của start / session / scan / remove / void. */
export const bePackingSessionSchema = z.object({
  taskId: z.string(),
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  warehouseId: z.string().nullish(),
  packStatus: packSessionStatusSchema,
  packerId: z.string().nullish(),
  packerName: z.string().nullish(),
  startedAt: z.string().nullish(),
  packedAt: z.string().nullish(),
  lines: z.array(bePackLineSchema),
  packages: z.array(bePackageSchema),
  shipments: z.array(bePackShipmentSchema),
  /** Có khi đơn còn khoản phải thu trước khi bàn giao (G3-Q4); vắng khi không nợ. */
  paymentDue: bePackPaymentDueSchema.nullish(),
});

/* ── Nhãn kiện ───────────────────────────────────────────────────────── */

/** BE `PackageLabelResponse.Recipient`. */
export const bePackLabelRecipientSchema = z.object({
  name: z.string().nullish(),
  phone: z.string().nullish(),
  line1: z.string().nullish(),
  line2: z.string().nullish(),
  wardName: z.string().nullish(),
  provinceName: z.string().nullish(),
  countryCode: z.string().nullish(),
  postalCode: z.string().nullish(),
});

/**
 * BE `PackageLabelResponse` — những gì nhãn nội bộ in ra (docs 08 bước 6). Không gọi hãng vận chuyển;
 * FE tự dựng bố cục. `provisional`: kiện chưa vào lô giao nên n/N và COD còn có thể đổi.
 */
export const bePackageLabelSchema = z.object({
  labelCode: z.string(),
  packageId: z.string(),
  orderNumber: z.string().nullish(),
  shipmentId: z.string().nullish(),
  shipmentCode: z.string().nullish(),
  packageNo: z.number().int().positive(),
  packageCount: z.number().int().positive(),
  provisional: z.boolean(),
  /** Tiền hãng thu hộ cho lô (docs 09 BR-04); 0 khi không thu. */
  codAmount: measure.nullish(),
  currency: z.string().nullish(),
  recipient: bePackLabelRecipientSchema,
  returnWarehouseName: z.string().nullish(),
  returnAddress: z.string().nullish(),
  packageType: tolerantEnum(PACKAGE_TYPES),
  weightKg: measure.nullish(),
  lengthCm: measure.nullish(),
  widthCm: measure.nullish(),
  heightCm: measure.nullish(),
  dimWeightKg: measure.nullish(),
  fragile: z.boolean(),
  rotatable: z.boolean(),
  contents: z.array(bePackContentSchema),
});
