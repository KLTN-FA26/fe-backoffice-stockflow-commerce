/**
 * Order — zod schemas + BR traceability.
 *
 * Hai lớp, KHÔNG trộn (api-conventions §3.1):
 * - DTO (`*DtoSchema`): hình dạng BE trả về — `OrderResponse.java`
 *   (order/internal/controller/dto, BE develop). Parse MỘT lần ở `api.ts`.
 * - Model FE (`orderSchema`): kiểu UI đọc, sau khi map status BE → FE.
 * - Input (`adminCancelOrderSchema`): body form gửi đi.
 */

import { z } from "zod";

import {
  ORDER_BALANCE_POLICIES,
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_HISTORY_ENTRY_TYPES,
  ORDER_HOLD_REASONS,
  ORDER_MANUAL_HOLD_REASONS,
  ORDER_REMAINDER_CLOSURE_REASONS,
  ORDER_REMAINDER_FEE_LABELS,
  ORDER_SHIPMENT_STATUSES,
} from "@/constants/labels-order";
import { ORDER_LIMITS } from "@/constants/numbers";
import { ORDER_STATUSES } from "@/constants/statuses";

/* ── DTO (BE wire) ───────────────────────────────────────────────────── */

/**
 * BE `OrderResponse.currency` — mã ISO 4217 bất kỳ (không chỉ VND/USD). Chỉ kiểm định dạng
 * để một mã lạ không làm hỏng cả trang danh sách; hiển thị qua `formatMoney`.
 */
const currencyCode = z.string().regex(/^[A-Z]{3}$/, "Mã tiền tệ không hợp lệ");

/**
 * BE `order/api/OrderStatus.java` — 19 giá trị (BE PR #133: bỏ IN_FULFILMENT / PAID, thêm PICKING,
 * PACKED, PARTIALLY_FULFILLED, DELIVERY_FAILED, RETURN_REQUESTED, REFUNDED, PARTIALLY_REFUNDED, CLOSED…).
 * Giá trị lạ (BE thêm sau, hoặc mã cũ BE không còn trả) → "UNKNOWN" thay vì làm hỏng cả danh sách.
 */
export const BACKEND_ORDER_STATUSES = [
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "PICKING",
  "PARTIALLY_FULFILLED",
  "PACKED",
  "ON_HOLD",
  "SHIPPED",
  "DELIVERY_FAILED",
  "DELIVERED",
  "RETURN_REQUESTED",
  "RETURNED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "COMPLETED",
  "CANCELLED",
  "CLOSED",
] as const;

export const orderStatusDtoSchema = z.enum([...BACKEND_ORDER_STATUSES, "UNKNOWN"]).catch("UNKNOWN");

/** BE `HoldReason` — tolerant: giá trị lạ → "UNKNOWN" (không cho phép gỡ giữ, xem lifecycle). */
export const orderHoldReasonDtoSchema = z.enum([...ORDER_HOLD_REASONS, "UNKNOWN"]).catch("UNKNOWN");

/** BE `DeliveryFailureReason` — tolerant. */
export const orderDeliveryFailureReasonDtoSchema = z
  .enum([...ORDER_DELIVERY_FAILURE_REASONS, "UNKNOWN"])
  .catch("UNKNOWN");

/**
 * BE `BalancePolicy` — cách thu phần còn lại của đơn cọc (BE PR #150: thêm ON_CREDIT). Tolerant: giá trị
 * lạ → "UNKNOWN" (hiện "Không rõ"), không làm hỏng cả trang.
 */
export const orderBalancePolicyDtoSchema = z
  .enum([...ORDER_BALANCE_POLICIES, "UNKNOWN"])
  .catch("UNKNOWN");

/** BE `OrderShipmentStatus` — tolerant. */
export const orderShipmentStatusDtoSchema = z.enum(ORDER_SHIPMENT_STATUSES).catch("UNKNOWN");

/**
 * Field có thể null dùng `.nullish()` (cho phép vắng key): BE bật Jackson
 * `default-property-inclusion: non_null` (application.yml) nên field null bị BỎ HẲN khỏi JSON
 * (vd đơn guest không có key `customerId`). Chỉ cho null mà bắt buộc có key → parse fail.
 */

/** BE `OrderResponse.Address` — mọi field có thể vắng (đơn guest/địa chỉ thiếu). */
export const orderAddressDtoSchema = z.object({
  recipientName: z.string().nullish(),
  phone: z.string().nullish(),
  line1: z.string().nullish(),
  line2: z.string().nullish(),
  wardCode: z.string().nullish(),
  wardName: z.string().nullish(),
  provinceCode: z.string().nullish(),
  provinceName: z.string().nullish(),
  countryCode: z.string().nullish(),
  postalCode: z.string().nullish(),
});

/** BE `OrderResponse.Line` — tiền là BigDecimal, JSON ra number. */
export const orderLineDtoSchema = z.object({
  lineId: z.string(),
  sku: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  reservationIds: z.array(z.string()).default([]),
  designSnapshotId: z.string().nullish(),
  designChecksum: z.string().nullish(),
  /** Số đơn vị nằm trong lô còn ở hãng vận chuyển / khách (BE PR #133, omit khi null). */
  shippedQuantity: z.number().int().nullish(),
  /** Số đơn vị ở các lô đã giao. */
  deliveredQuantity: z.number().int().nullish(),
  /** Số đơn vị đã đóng ở đơn giao một phần — sẽ không được giao. */
  cancelledQuantity: z.number().int().nullish(),
});

/** BE `OrderResponse.ShipmentLine`. */
export const orderShipmentLineDtoSchema = z.object({
  lineId: z.string(),
  quantity: z.number().int(),
});

/** BE `OrderResponse.Shipment` — lô giao của đơn (split shipments, G4-Q3). */
export const orderShipmentDtoSchema = z.object({
  shipmentId: z.string(),
  status: orderShipmentStatusDtoSchema,
  /** Giá trị hàng của lô theo giá đơn. */
  amount: z.number().nullish(),
  /** Số tiền giao lô này đã ghi nhận công nợ (đơn công nợ). */
  billedAmount: z.number().nullish(),
  handedOverAt: z.string().nullish(),
  outcomeAt: z.string().nullish(),
  failureReason: z.string().nullish(),
  lines: z.array(orderShipmentLineDtoSchema).nullish(),
});

export const orderDtoSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string().nullish(),
  status: orderStatusDtoSchema,
  totalAmount: z.number(),
  currency: currencyCode,
  lines: z.array(orderLineDtoSchema),
  placedAt: z.string(),
  createdBy: z.string().nullish(),
  lastModifiedAt: z.string().nullish(),
  lastModifiedBy: z.string().nullish(),
  contactName: z.string().nullish(),
  contactEmail: z.string().nullish(),
  contactPhone: z.string().nullish(),
  shippingAddress: orderAddressDtoSchema.nullish(),
  billingAddress: orderAddressDtoSchema.nullish(),
  /** BE `PaymentTerm`: PREPAID | DEPOSIT | CREDIT; null trên dòng danh sách không mang field này. */
  paymentTerm: z.string().nullish(),
  /** Staff: lý do đang giữ (ON_HOLD); null/vắng với đơn không bị giữ. */
  holdReason: orderHoldReasonDtoSchema.nullish(),
  /** Lý do giữ khách được đọc (AWAITING_CREDIT_APPROVAL | UNDER_REVIEW). */
  holdReasonPublic: z.string().nullish(),
  /** Staff: trạng thái đơn sẽ quay về khi gỡ giữ; vắng với giữ công nợ. */
  statusBeforeHold: orderStatusDtoSchema.nullish(),
  /** Staff: ghi chú lúc giữ. */
  holdNote: z.string().nullish(),
  packedAt: z.string().nullish(),
  shippedAt: z.string().nullish(),
  deliveredAt: z.string().nullish(),
  deliveryFailureReason: orderDeliveryFailureReasonDtoSchema.nullish(),
  completedAt: z.string().nullish(),
  closedAt: z.string().nullish(),
  /** Các lô giao đã ghi công nợ (đơn công nợ). */
  billedAmount: z.number().nullish(),
  /** Tổng trừ số đơn vị đã đóng ở đơn giao một phần. */
  effectiveTotal: z.number().nullish(),
  /** Khách còn nợ (effectiveTotal − paidAmount, không âm). */
  amountDue: z.number().nullish(),
  /** Phải trả trước khi hàng rời kho (G3-Q4): > 0 thì bàn giao bị từ chối. */
  amountDueBeforeHandover: z.number().nullish(),
  shipments: z.array(orderShipmentDtoSchema).nullish(),
  /**
   * Cách thu phần còn lại của đơn cọc: BEFORE_DELIVERY | ON_DELIVERY | ON_CREDIT; null với đơn không
   * cọc (BE PR #150).
   */
  balancePolicy: orderBalancePolicyDtoSchema.nullish(),
  /** Số ngày trả sau khi giao: đơn CREDIT, hoặc đơn cọc ON_CREDIT cho phần còn lại; null nếu khác. */
  creditTermDays: z.number().int().nullish(),
  /**
   * Sales cho phép giao một phần (PACK-PARTIAL, BE PR #150); mặc định false. Vắng (null) trên dòng
   * danh sách không mang field này.
   */
  allowPartialShipment: z.boolean().nullish(),
  /**
   * Hàng in của đơn đã về bàn đóng gói (không có dòng in, hoặc sản xuất xong). False khi đơn còn đang in,
   * hoặc đã giao hàng có sẵn trước khi sản xuất xong (PACK-EARLY); vắng trên dòng danh sách.
   */
  printLinesReady: z.boolean().nullish(),
});

/** BE `PageResponse<OrderResponse>` — trang đánh số từ 0. */
export const orderPageDtoSchema = z.object({
  items: z.array(orderDtoSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

/* ── Model FE ────────────────────────────────────────────────────────── */

export const orderLineSchema = orderLineDtoSchema
  .pick({
    lineId: true,
    sku: true,
    quantity: true,
    unitPrice: true,
    lineTotal: true,
  })
  .extend({
    /** null khi BE không trả (đơn chưa có lô giao). */
    shippedQuantity: z.number().int().nullable(),
    deliveredQuantity: z.number().int().nullable(),
    cancelledQuantity: z.number().int().nullable(),
  });

export const orderShipmentSchema = z.object({
  shipmentId: z.string(),
  status: orderShipmentStatusDtoSchema,
  amount: z.number().nullable(),
  billedAmount: z.number().nullable(),
  handedOverAt: z.string().nullable(),
  outcomeAt: z.string().nullable(),
  failureReason: z.string().nullable(),
  lines: z.array(orderShipmentLineDtoSchema),
});

/**
 * Kiểu UI đọc. Người nhận lấy từ `shippingAddress`, fallback `contact*`.
 * BE không trả subtotal/phí ship/thuế/giảm giá/phương thức thanh toán/kho xử lý
 * → UI không hiển thị các field đó (không bịa số).
 */
export const orderSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string().nullable(),
  status: z.enum(ORDER_STATUSES),
  totalAmount: z.number(),
  currency: currencyCode,
  placedAt: z.string(),
  recipientName: z.string(),
  recipientPhone: z.string(),
  contactEmail: z.string().nullable(),
  /** Địa chỉ giao đã ghép sẵn (line1, line2, phường/xã, tỉnh); null khi BE không có. */
  shippingAddressText: z.string().nullable(),
  lines: z.array(orderLineSchema),
  paymentTerm: z.string().nullable(),
  /** Staff: lý do đang giữ; null khi đơn không ON_HOLD. */
  holdReason: orderHoldReasonDtoSchema.nullable(),
  holdReasonPublic: z.string().nullable(),
  /** Trạng thái FE đơn quay về khi gỡ giữ; null với giữ công nợ. */
  statusBeforeHold: z.enum(ORDER_STATUSES).nullable(),
  holdNote: z.string().nullable(),
  packedAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  deliveryFailureReason: orderDeliveryFailureReasonDtoSchema.nullable(),
  completedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  billedAmount: z.number().nullable(),
  effectiveTotal: z.number().nullable(),
  amountDue: z.number().nullable(),
  amountDueBeforeHandover: z.number().nullable(),
  /** Rỗng khi BE không trả `shipments` (đơn chưa chia lô). */
  shipments: z.array(orderShipmentSchema),
  /** null khi đơn không cọc (hoặc dòng danh sách không mang field này). */
  balancePolicy: orderBalancePolicyDtoSchema.nullable(),
  creditTermDays: z.number().int().nullable(),
  /** null = BE không trả (dòng danh sách) — màn chi tiết không đoán, ẩn điều khiển. */
  allowPartialShipment: z.boolean().nullable(),
  printLinesReady: z.boolean().nullable(),
});

/* ── Lịch sử đơn (BE GET /orders/{id}/history) ───────────────────────── */

/**
 * BE `OrderStatusChangeResponse` (BE PR #150, "review of #150"): mỗi mục có `type` — `STATUS_CHANGE`
 * (trạng thái đi `from` → `to`) hoặc `PARTIAL_SHIPMENT_DECISION` (Sales bật / tắt giao một phần,
 * `from` / `to` null, `partialShipmentAllowed`, `reason` = ghi chú của Sales). Mục thứ hai chỉ nhân viên
 * thấy. `type` vắng (BE cũ) = STATUS_CHANGE; giá trị lạ → "UNKNOWN".
 */
export const orderHistoryEntryDtoSchema = z.object({
  type: z
    .enum([...ORDER_HISTORY_ENTRY_TYPES, "UNKNOWN"])
    .default("STATUS_CHANGE")
    .catch("UNKNOWN"),
  from: orderStatusDtoSchema.nullish(),
  to: orderStatusDtoSchema.nullish(),
  reason: z.string().nullish(),
  occurredAt: z.string(),
  actorId: z.string().nullish(),
  actorName: z.string().nullish(),
  partialShipmentAllowed: z.boolean().nullish(),
});

export const orderHistoryDtoSchema = z.array(orderHistoryEntryDtoSchema);

const historyEntryBase = {
  occurredAt: z.string(),
  reason: z.string().nullable(),
  /** Tên người thực hiện; null với hệ thống / bước ghi trước G3-2. */
  actorName: z.string().nullable(),
};

/** Mục lịch sử đã phân loại — UI render theo `kind`, không đọc `type` thô. */
export const orderHistoryEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    ...historyEntryBase,
    kind: z.literal("status-change"),
    /** null ở bước đầu (đơn vừa được đặt). */
    from: z.enum(ORDER_STATUSES).nullable(),
    to: z.enum(ORDER_STATUSES),
  }),
  z.object({
    ...historyEntryBase,
    kind: z.literal("partial-shipment"),
    /** true = Sales bật giao một phần; false = tắt. */
    allowed: z.boolean(),
  }),
  z.object({ ...historyEntryBase, kind: z.literal("unknown") }),
]);

/* ── Admin cancel input ──────────────────────────────────────────────── */

/**
 * Nguồn BE: OrderController#adminCancel — AdminCancelOrderRequest
 * (record AdminCancelOrderRequest(@NotBlank(message = "reason is required") String reason)).
 */
export const adminCancelOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Lý do huỷ là bắt buộc")
    // Cột cancellation_reason VARCHAR(500) — xem ORDER_LIMITS (BE không có @Size)
    .max(ORDER_LIMITS.cancelReasonMax, `Lý do huỷ tối đa ${ORDER_LIMITS.cancelReasonMax} ký tự`),
});

export type AdminCancelOrderInput = z.infer<typeof adminCancelOrderSchema>;

/* ── Hold / resolve / delivery-failure / remainder-closure input ─────── */

const NOTE_REQUIRED = "Ghi chú là bắt buộc khi chọn “Lý do khác”";

/**
 * Lý do + ghi chú: BE `Order#putOnHold`, `#markDeliveryFailed`, `#closeRemainder` — OTHER bắt buộc
 * có ghi chú (400 VALIDATION_FAILED nếu thiếu). `note` được trim; rỗng → bỏ khỏi body.
 */
function reasonWithNote<const R extends readonly [string, ...string[]]>(
  reasons: R,
  noteMax: number,
  noteLabel: string,
) {
  return z
    .object({
      reasonCode: z.enum(reasons, { error: "Chọn lý do" }),
      note: z.string().trim().max(noteMax, `${noteLabel} tối đa ${noteMax} ký tự`),
    })
    .refine((value) => value.reasonCode !== "OTHER" || value.note.length > 0, {
      path: ["note"],
      message: NOTE_REQUIRED,
    });
}

/**
 * Giữ đơn (`POST /orders/{id}/hold`, `HoldOrderRequest`). Chỉ lý do tự nêu — CREDIT và
 * DESIGN_MISMATCH là của hệ thống, BE trả 400.
 */
export const holdOrderSchema = reasonWithNote(
  ORDER_MANUAL_HOLD_REASONS,
  ORDER_LIMITS.holdNoteMax,
  "Ghi chú",
);

/** Gỡ giữ (`POST /orders/{id}/hold/resolution`, `ResolveHoldRequest`): ghi chú @NotBlank. */
export const resolveOrderHoldSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Hãy ghi cách đã xử lý")
    .max(ORDER_LIMITS.resolveNoteMax, `Ghi chú tối đa ${ORDER_LIMITS.resolveNoteMax} ký tự`),
});

/** Ghi giao thất bại (`POST /orders/{id}/delivery-failure`, `DeliveryFailureRequest`). */
export const deliveryFailureSchema = reasonWithNote(
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_LIMITS.deliveryFailureNoteMax,
  "Ghi chú",
);

/**
 * Khoản phí đã thoả thuận khi đóng phần còn lại (`CloseRemainderRequest.agreedFee` = `CancellationFeeRequest`,
 * BE PR #150): số tiền nguyên VND > 0 (BE `Order#requireRemainderFee`: đúng số chữ số thập phân của tiền
 * tệ, VND = 0), lý do ≤ 500 và chi tiết ≤ 2000 đều bắt buộc. Trần = giá trị phần hàng in bị đóng, BE
 * mới biết (400) — FE không đoán.
 */
export const agreedFeeSchema = z.object({
  amount: z
    .number({ error: ORDER_REMAINDER_FEE_LABELS.amountInvalid })
    .int(ORDER_REMAINDER_FEE_LABELS.amountInvalid)
    .positive(ORDER_REMAINDER_FEE_LABELS.amountInvalid),
  reason: z
    .string()
    .trim()
    .min(1, ORDER_REMAINDER_FEE_LABELS.reasonRequired)
    .max(ORDER_LIMITS.feeReasonMax, ORDER_REMAINDER_FEE_LABELS.reasonTooLong),
  detail: z
    .string()
    .trim()
    .min(1, ORDER_REMAINDER_FEE_LABELS.detailRequired)
    .max(ORDER_LIMITS.feeDetailMax, ORDER_REMAINDER_FEE_LABELS.detailTooLong),
});

/** Đóng phần còn lại (`POST /orders/{id}/remainder-closure`, `CloseRemainderRequest`). */
export const remainderClosureSchema = z
  .object({
    reasonCode: z.enum(ORDER_REMAINDER_CLOSURE_REASONS, { error: "Chọn lý do" }),
    note: z
      .string()
      .trim()
      .max(
        ORDER_LIMITS.remainderClosureNoteMax,
        `Ghi chú tối đa ${ORDER_LIMITS.remainderClosureNoteMax} ký tự`,
      ),
    /** Tuỳ chọn; chỉ sau khi hàng in đã in (BE 409 CANCELLATION_FEE_BEFORE_PRINTING nếu chưa). */
    agreedFee: agreedFeeSchema.optional(),
  })
  .refine((value) => value.reasonCode !== "OTHER" || value.note.length > 0, {
    path: ["note"],
    message: NOTE_REQUIRED,
  });

/**
 * Cho phép / dừng giao một phần (`PUT /orders/{id}/partial-shipment`, `PartialShipmentRequest`):
 * `allowed` bắt buộc, `note` ≤ 500 không bắt buộc (được ghi vào lịch sử đơn).
 */
export const partialShipmentSchema = z.object({
  allowed: z.boolean(),
  note: z
    .string()
    .trim()
    .max(
      ORDER_LIMITS.partialShipmentNoteMax,
      `Ghi chú tối đa ${ORDER_LIMITS.partialShipmentNoteMax} ký tự`,
    ),
});

export type HoldOrderValues = z.infer<typeof holdOrderSchema>;
export type ResolveOrderHoldValues = z.infer<typeof resolveOrderHoldSchema>;
export type DeliveryFailureValues = z.infer<typeof deliveryFailureSchema>;
export type RemainderClosureValues = z.infer<typeof remainderClosureSchema>;
export type AgreedFeeValues = z.infer<typeof agreedFeeSchema>;
export type PartialShipmentValues = z.infer<typeof partialShipmentSchema>;
