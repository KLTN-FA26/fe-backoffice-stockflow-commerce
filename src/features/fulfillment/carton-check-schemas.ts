/**
 * Trạm kiểm thùng & dán nhãn giao hàng — zod DTO, khớp BE `CartonCheckController` (4C-6, docs 08):
 * `CartonCheckQueueRowResponse` và `CartonCheckSessionResponse` (+ `Line`, `Carton`, `Shipment`, `PaymentDue`).
 *
 * BE bật Jackson `non_null` → field null bị BỎ khỏi JSON nên field tuỳ chọn khai `.nullish()`; kiểu nguyên thuỷ Java
 * (int, boolean) luôn có mặt nên giữ bắt buộc. `BigDecimal` về dạng số JSON. Enum khoan dung (`.catch("UNKNOWN")`):
 * giá trị BE thêm sau không làm hỏng cả phiên kiểm thùng.
 */

import { z } from "zod";

import {
  CARTON_API_STATUSES,
  CARTON_REMOVAL_REASONS,
  PACK_API_STATUSES,
  PACK_SHIPMENT_API_STATUSES,
} from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

const count = z.number().int().min(0);
const measure = z.number().nonnegative();

function tolerantEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum([...values, "UNKNOWN"]).catch("UNKNOWN");
}

/** `PackStatus` của phiên kiểm thùng; giá trị lạ → UNKNOWN (không thao tác nào được mở). */
export const cartonCheckStatusSchema = tolerantEnum(PACK_API_STATUSES);

/* ── Hàng chờ ────────────────────────────────────────────────────────── */

/** BE `CartonCheckQueueRowResponse` — một đơn đã lấy hàng xong đang chờ ở khu xuất hàng (docs 08 §4.1 bước 1). */
export const beCartonCheckQueueRowSchema = z.object({
  taskId: z.string(),
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  warehouseId: z.string().nullish(),
  /** `PENDING` hoặc `IN_PROGRESS` (hoặc trạng thái đã lọc). */
  status: cartonCheckStatusSchema,
  pickedAt: z.string().nullish(),
  pickerName: z.string().nullish(),
  /** Người bắt đầu kiểm; vắng khi còn PENDING. */
  startedBy: z.string().nullish(),
  startedByName: z.string().nullish(),
  startedAt: z.string().nullish(),
  /** Thùng của phiên chưa bị loại; `checkedCount` = số thùng đã quét (kể cả đã dán nhãn), `labeledCount` = đã dán nhãn. */
  cartonCount: count,
  checkedCount: count,
  labeledCount: count,
  /** Shipment đã tạo (đơn giao nhiều đợt có nhiều). */
  shipmentCount: count,
});

export const beCartonCheckQueuePageSchema = bePageSchema(beCartonCheckQueueRowSchema);

/* ── Phiên kiểm thùng ────────────────────────────────────────────────── */

/** BE `CartonCheckSessionResponse.Line` — một dòng đơn và tiến độ kiểm / dán nhãn của nó. */
export const beCartonCheckLineSchema = z.object({
  orderLineId: z.string(),
  sku: z.string(),
  /** Số cái đợt giao của task còn cần của dòng. */
  wantedUnits: count,
  cartons: count,
  checkedCartons: count,
  labeledCartons: count,
  removedCartons: count,
  shippedCartons: count,
  /** Số cái trong các thùng đã dán nhãn (đã vào shipment hay chưa). */
  labeledUnits: count,
  /** Hoàn tất ngay lúc này sẽ để lại bao nhiêu — chỉ có nghĩa khi giao một phần. */
  missingUnits: count,
});

/** BE `CartonCheckSessionResponse.Carton` — MỘT thùng LPN: kiện giao (docs 08 BR-02). */
export const beCartonSchema = z.object({
  /** Vắng với thùng phiên chưa nhận (đọc trước khi bắt đầu). */
  packageId: z.string().nullish(),
  packageNo: z.number().int().positive(),
  labelCode: z.string().nullish(),
  lpn: z.string(),
  pickLineId: z.string().nullish(),
  orderLineId: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  /** Số cái chuẩn / thùng của SKU (docs 08 BR-02 — không mở thùng). */
  quantity: count,
  status: tolerantEnum(CARTON_API_STATUSES),
  checkedAt: z.string().nullish(),
  labeledAt: z.string().nullish(),
  /** 0 trước nhãn đầu; in lại tăng một và nhãn cũ vô hiệu (docs 08 BR-08). */
  labelVersion: count,
  lengthCm: measure.nullish(),
  widthCm: measure.nullish(),
  heightCm: measure.nullish(),
  weightKg: measure.nullish(),
  /** Khối lượng quy đổi = D × R × C / hệ số (docs 08 BR-09). */
  dimWeightKg: measure.nullish(),
  rotatable: z.boolean(),
  shipmentId: z.string().nullish(),
  removalReason: z.enum(CARTON_REMOVAL_REASONS).nullish().catch(null),
  removalNote: z.string().nullish(),
});

/** BE `CartonCheckSessionResponse.Shipment` — shipment do một lần hoàn tất tạo ra. */
export const beCartonShipmentSchema = z.object({
  shipmentId: z.string(),
  /** `<số đơn>-S<n>`. */
  code: z.string(),
  status: tolerantEnum(PACK_SHIPMENT_API_STATUSES),
  packageCount: count,
  partial: z.boolean(),
  partialNote: z.string().nullish(),
  readyAt: z.string().nullish(),
});

/**
 * BE `CartonCheckSessionResponse.PaymentDue` — đợt thanh toán phải thu trước khi giao còn nợ (docs 08 BR-11): chỉ là
 * cảnh báo, bàn giao mới bị chặn. LƯU Ý: khác `FulfillmentTaskResponse.PaymentDue` (`amountDueBeforeHandover`) của câu
 * trả lời hoàn tất — ở đây field tên `amount`.
 */
export const beCartonPaymentDueSchema = z.object({
  amount: measure,
  currency: z.string(),
});

/** BE `CartonCheckSessionResponse` — câu trả lời của start / session / carton-checks / carton-labels / reprint / removal. */
export const beCartonCheckSessionSchema = z.object({
  taskId: z.string(),
  orderId: z.string(),
  orderNumber: z.string().nullish(),
  warehouseId: z.string().nullish(),
  status: cartonCheckStatusSchema,
  startedBy: z.string().nullish(),
  startedByName: z.string().nullish(),
  startedAt: z.string().nullish(),
  completedAt: z.string().nullish(),
  /** Đã có thùng dán nhãn: đơn không huỷ được, không đổi địa chỉ giao (docs 08 BR-04). */
  orderLocked: z.boolean(),
  lines: z.array(beCartonCheckLineSchema),
  cartons: z.array(beCartonSchema),
  shipments: z.array(beCartonShipmentSchema),
  paymentDue: beCartonPaymentDueSchema.nullish(),
  /** SKU chưa có quy cách thùng (kích thước / khối lượng): thùng của SKU này chưa dán nhãn được (docs 08 BR-07). */
  skusWithoutCartonSpec: z.array(z.string()),
});
