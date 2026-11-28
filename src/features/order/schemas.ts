/**
 * Order — zod schemas + BR traceability.
 *
 * Hai lớp, KHÔNG trộn (api-conventions §3.1), mỗi lớp một file (giới hạn 200 dòng / file):
 * - DTO (`*DtoSchema`, file này): hình dạng BE trả về (`OrderResponse.java`). Parse MỘT lần ở `api.ts`.
 * - Model FE (`orderSchema`, `model-schemas.ts`): kiểu UI đọc, sau khi map status BE → FE.
 * - Lịch sử đơn (`history-schemas.ts`); input form gửi đi: giữ / gỡ giữ / giao thất bại / đóng phần còn
 *   lại / giao một phần / hình thức giao (`input-schemas.ts`), huỷ + duyệt công nợ (`action-schemas.ts`),
 *   release (`release-schemas.ts`). Credit hold: `credit-hold-schemas.ts`. Lệnh sản xuất: `production-schemas.ts`.
 */

import { z } from "zod";

import {
  ORDER_BALANCE_POLICIES,
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_HOLD_REASONS,
  ORDER_SHIPMENT_STATUSES,
} from "@/constants/labels-order";
import {
  ORDER_PAYMENT_STATUS_UNKNOWN,
  ORDER_PAYMENT_STATUSES,
  ORDER_PAYMENT_TERMS,
} from "@/constants/orders";
import { SETTLEMENT_BLOCKERS, SETTLEMENT_BRANCHES } from "@/constants/labels-order-settlement";
import { ORDER_STATUS_UNKNOWN, QUOTE_FEE_KINDS } from "@/constants/statuses";

import { uuid } from "@/lib/validation/primitives";

import { orderReleaseFactsShape } from "./delivery-mode-schemas";

/* ── DTO (BE wire) ───────────────────────────────────────────────────── */

/**
 * BE `OrderResponse.currency` — mã ISO 4217 bất kỳ (không chỉ VND/USD). Chỉ kiểm định dạng
 * để một mã lạ không làm hỏng cả trang danh sách; hiển thị qua `formatMoney`.
 */
export const currencyCode = z.string().regex(/^[A-Z]{3}$/, "Mã tiền tệ không hợp lệ");

/**
 * Enum BE dễ mở rộng (cùng tinh thần `deliveryStatus` của PO): chuỗi ngoài `values` → `fallback`
 * thay vì làm hỏng cả response. Khác `.catch()`: chỉ nhận CHUỖI — vắng key / null / sai kiểu ở
 * field bắt buộc vẫn fail (đó là bug hợp đồng, không phải giá trị mới). Field cho phép null thì
 * nối `.nullish()`.
 */
function tolerantEnum<const T extends readonly [string, ...string[]], const F>(
  values: T,
  fallback: F,
) {
  return z.union([z.enum(values), z.string().transform((): F => fallback)]);
}

/**
 * BE `order/api/OrderStatus.java` — đúng 21 giá trị (BE PR #133: bỏ IN_FULFILMENT / PAID, thêm PICKING,
 * PACKED, PARTIALLY_FULFILLED, DELIVERY_FAILED, RETURN_REQUESTED, REFUNDED, PARTIALLY_REFUNDED, CLOSED; hợp đồng
 * bán (docs 17 §5.1) thêm PENDING_CONTRACT và AWAITING_STOCK). `IN_PRODUCTION` còn trong enum BE (lịch sử cũ).
 * Đây là tập giá trị ĐƯỢC GỬI lên BE (lọc `status=`) — không bao giờ chứa `UNKNOWN`.
 */
export const BACKEND_ORDER_STATUSES = [
  "DRAFT",
  "PENDING_CONTRACT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "AWAITING_STOCK",
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

/**
 * Trạng thái đọc từ BE: mã đã biết, hoặc `UNKNOWN` cho chuỗi lạ — trạng thái BE thêm sau, hoặc mã đã
 * bị bỏ (IN_FULFILMENT / PAID) mà BE cũ còn trả. Thiếu / null / không phải chuỗi → parse fail.
 */
export const orderStatusDtoSchema = tolerantEnum(BACKEND_ORDER_STATUSES, ORDER_STATUS_UNKNOWN);

/** BE `HoldReason` — lý do lạ → `UNKNOWN` (không cho gỡ giữ, xem lifecycle). */
export const orderHoldReasonDtoSchema = tolerantEnum(ORDER_HOLD_REASONS, ORDER_STATUS_UNKNOWN);

/** BE `DeliveryFailureReason` — lý do lạ → `UNKNOWN`. */
export const orderDeliveryFailureReasonDtoSchema = tolerantEnum(
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_STATUS_UNKNOWN,
);

/** BE `OrderShipmentStatus` — trạng thái lô lạ → `UNKNOWN`. */
export const orderShipmentStatusDtoSchema = tolerantEnum(
  ORDER_SHIPMENT_STATUSES,
  ORDER_STATUS_UNKNOWN,
);

/** BE `PaymentStatus` — giá trị lạ → `UNKNOWN` (hiển thị "Không rõ"). */
export const orderPaymentStatusDtoSchema = tolerantEnum(
  ORDER_PAYMENT_STATUSES,
  ORDER_PAYMENT_STATUS_UNKNOWN,
);

/** BE `PaymentTerm` — phương thức lạ → null ("chưa rõ phương thức"), KHÔNG thành lựa chọn mới. */
export const orderPaymentTermDtoSchema = tolerantEnum(ORDER_PAYMENT_TERMS, null);

/**
 * BE `BalancePolicy` — cách thu phần còn lại của đơn cọc (BE PR #150: thêm ON_CREDIT). Tolerant: giá trị
 * lạ → "UNKNOWN" (hiện "Không rõ"), không làm hỏng cả trang.
 */
export const orderBalancePolicyDtoSchema = z
  .enum([...ORDER_BALANCE_POLICIES, "UNKNOWN"])
  .catch("UNKNOWN");

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
  /** 4B-2: số thùng đặt; `quantity` = thùng × `unitsPerCarton`. Vắng với dòng không đặt theo thùng. */
  cartons: z.number().int().nullish(),
  unitsPerCarton: z.number().int().nullish(),
  /** R5-3 (optional until the BE ships it): the line's design name and a short-lived preview URL. */
  designName: z.string().nullish(),
  previewUrl: z.string().nullish(),
});

/** BE `OrderResponse.ShipmentLine`. */
export const orderShipmentLineDtoSchema = z.object({
  lineId: z.string(),
  quantity: z.number().int(),
});

/**
 * BE `OrderResponse.Shipment` — lô giao của đơn (split shipments, G4-Q3). Không có tiền: giá trị / công nợ / COD của lô
 * BE đã bỏ (4B-10) — tiền ở các đợt thanh toán (WF-05 BO-08).
 */
export const orderShipmentDtoSchema = z.object({
  shipmentId: z.string(),
  status: orderShipmentStatusDtoSchema,
  handedOverAt: z.string().nullish(),
  outcomeAt: z.string().nullish(),
  failureReason: orderDeliveryFailureReasonDtoSchema.nullish(),
  lines: z.array(orderShipmentLineDtoSchema).nullish(),
  /**
   * WF-05 Q-12 (F-5, đề nghị G1): BE cho "đóng phần thất lạc" lô này không (giao thất bại vì LOST VÀ đơn còn nợ đơn vị
   * của lô). Lô đã đóng vẫn giữ DELIVERY_FAILED + LOST, nên FE không tự biết — vắng thì FE dùng luật dự phòng.
   */
  lostClosable: z.boolean().nullish(),
});

/** Boolean của khối điều kiện: vắng (BE bỏ field) → false. */
const flag = z
  .boolean()
  .nullish()
  .transform((value) => value ?? false);

/**
 * BE `OrderResponse.settlementReadiness` (WF-05 contract F-1, BE-34): vì sao đơn chưa tự hoàn tất / chưa tự đóng, do BE
 * tính (`OrderSettlementService`). Mọi field tuỳ chọn ở FE (BE G1 có thể chưa ship); `branch` / mã chặn lạ không làm hỏng
 * màn: nhánh lạ → `UNKNOWN`, mã chặn lạ giữ nguyên chuỗi để hiện "điều kiện khác". `returnAdjustmentUnissued` (Q-16,
 * X-6): dòng thông tin, không chặn.
 */
export const settlementReadinessDtoSchema = z
  .object({
    branch: tolerantEnum(SETTLEMENT_BRANCHES, ORDER_STATUS_UNKNOWN).nullish(),
    returnWindowDays: z.number().int().nullish(),
    returnWindowEndsAt: z.string().nullish(),
    owing: flag,
    openReturn: flag,
    uninvoicedShipmentIds: z.array(z.string()).nullish(),
    shippingFeeUninvoiced: flag,
    refundOutstanding: flag,
    completionHeld: flag,
    completesAt: z.string().nullish(),
    closesAt: z.string().nullish(),
    blockers: z.array(z.string()).nullish(),
    returnAdjustmentUnissued: flag,
    /**
     * Audit r2 lifecycle M-4 (BE `Order.completionHoldable`, settlement 9e98660b): Sale "Giữ hoàn tất" được ngay lúc này —
     * đúng luật BE áp khi giữ, false khi đang giữ. Vắng (BE cũ) → false: không đoán bằng luật riêng của FE.
     */
    completionHoldable: flag,
    /**
     * Audit r3 EINV-7 (BE r3b): còn bản giảm do giao không thành công của đơn (hoá đơn của lô giảm về 0, hoặc phần phí vận
     * chuyển được miễn giảm trên hoá đơn phần phí còn lại) là nháp / bị từ chối / đang ở NCC — dòng thông tin như Q-16,
     * không chặn đóng. Vắng (BE cũ) → false.
     */
    deliveryReductionUnissued: flag,
  })
  .transform((dto) => ({
    branch: dto.branch ?? ORDER_STATUS_UNKNOWN,
    returnWindowDays: dto.returnWindowDays ?? null,
    returnWindowEndsAt: dto.returnWindowEndsAt ?? null,
    owing: dto.owing,
    openReturn: dto.openReturn,
    uninvoicedShipmentIds: dto.uninvoicedShipmentIds ?? [],
    shippingFeeUninvoiced: dto.shippingFeeUninvoiced,
    refundOutstanding: dto.refundOutstanding,
    completionHeld: dto.completionHeld,
    completesAt: dto.completesAt ?? null,
    closesAt: dto.closesAt ?? null,
    blockers: (dto.blockers ?? []).map((code) =>
      (SETTLEMENT_BLOCKERS as readonly string[]).includes(code)
        ? { code: code as (typeof SETTLEMENT_BLOCKERS)[number], known: true as const }
        : { code, known: false as const },
    ),
    returnAdjustmentUnissued: dto.returnAdjustmentUnissued,
    completionHoldable: dto.completionHoldable,
    deliveryReductionUnissued: dto.deliveryReductionUnissued,
  }));

/** BE `OrderResponse.Fee` (4B-3, 14 BR-17/BR-20/BR-21): dòng phí của đơn kèm VAT; `kind` lạ → `UNKNOWN`. */
export const orderFeeDtoSchema = z.object({
  kind: tolerantEnum(QUOTE_FEE_KINDS, ORDER_STATUS_UNKNOWN),
  /** PLATE_FEE: SKU được làm khuôn lần đầu; vắng với SHIPPING_FEE. */
  sku: z.string().nullish(),
  amount: z.number(),
  taxRate: z.number().nullish(),
  taxAmount: z.number().nullish(),
});

/**
 * BE `OrderResponse.Cancellation` — có khi đơn CANCELLED. `reason` = "CODE" hoặc "CODE: ghi chú";
 * fee* chỉ có khi huỷ giữ khoản thoả thuận (decision Q2); `feeDetail` chỉ nhân viên đọc.
 */
export const orderCancellationDtoSchema = z.object({
  reasonCode: z.string().nullish(),
  reason: z.string().nullish(),
  retainedAmount: z.number().nullish(),
  feeReason: z.string().nullish(),
  feeDetail: z.string().nullish(),
  feeAmount: z.number().nullish(),
  /** D46/D50: chỉ nhân viên thấy ("CUSTOMER" | "COMPANY"). */
  feeBearer: z.string().nullish(),
});

export const orderDtoSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string().nullish(),
  /** Tên + mã khách BE kèm sẵn ở danh sách / chi tiết đơn nội bộ (BE-15). */
  customerName: z.string().nullish(),
  customerCode: z.string().nullish(),
  /** R5-7 (optional): the quote the order was converted from. */
  sourceQuoteId: z.string().nullish(),
  sourceQuoteNumber: z.string().nullish(),
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
  // ── Thanh toán / release (SCRUM-423/427/460). Dòng danh sách có thể không mang một số field
  // ("null on list rows that do not carry it") → nullish.
  paymentTerm: orderPaymentTermDtoSchema.nullish(),
  /** Kho xuất — null tới khi release (SCRUM-423). */
  warehouseId: z.string().nullish(),
  /** Mã + tên kho xuất BE kèm cạnh id (issue #286) — người không có quyền đọc kho vẫn thấy tên. */
  warehouseCode: z.string().nullish(),
  warehouseName: z.string().nullish(),
  /**
   * Audit bo-17 (BE PR #497): đã thu / còn phải thu / quá hạn của các đợt — chỉ có ở dòng `GET /orders`, cho người đọc
   * được đợt (`payment-installments:READ`). null = đơn chưa có đợt (chưa ký hợp đồng) hoặc không được đọc; vắng = BE cũ.
   */
  paidAmount: z.number().nullish(),
  outstandingAmount: z.number().nullish(),
  overdueAmount: z.number().nullish(),
  /** D50: dòng `GET /orders` — công ty chịu một khoản phí của đơn (huy hiệu + bộ lọc). */
  feeBorneByCompany: z.boolean().nullish(),
  releasedAt: z.string().nullish(),
  creditTermDays: z.number().int().nullish(),
  balancePolicy: orderBalancePolicyDtoSchema.nullish(),
  cancellation: orderCancellationDtoSchema.nullish(),
  // ── Vòng đời (BE PR #133). Field staff (holdReason, statusBeforeHold, holdNote) vắng với khách.
  /** Staff: lý do đang giữ (ON_HOLD); vắng với đơn không bị giữ. */
  holdReason: orderHoldReasonDtoSchema.nullish(),
  /** Lý do giữ khách được đọc (AWAITING_CREDIT_APPROVAL | UNDER_REVIEW). */
  holdReasonPublic: z.string().nullish(),
  /** Staff: trạng thái đơn sẽ quay về khi gỡ giữ; vắng với giữ công nợ. */
  statusBeforeHold: orderStatusDtoSchema.nullish(),
  /** Staff: ghi chú lúc giữ. */
  holdNote: z.string().nullish(),
  packedAt: z.string().nullish(),
  /** Thùng giao đầu tiên được dán nhãn (BE PR #317, WF4 BE-8; docs 08 BR-04): từ đó đơn không huỷ, không đổi địa chỉ giao. */
  firstLabeledAt: z.string().nullish(),
  shippedAt: z.string().nullish(),
  deliveredAt: z.string().nullish(),
  deliveryFailureReason: orderDeliveryFailureReasonDtoSchema.nullish(),
  completedAt: z.string().nullish(),
  closedAt: z.string().nullish(),
  /** WF-05 F-1: lúc tiền hoàn của đơn đã chi xong (mốc đếm ngày đóng của nhánh hoàn tiền). */
  refundedAt: z.string().nullish(),
  /** WF-05 F-1 (BE-34): khối điều kiện hoàn tất / đóng do BE tính; null / vắng trước khi giao gì (hoặc BE cũ). */
  settlementReadiness: settlementReadinessDtoSchema.nullish(),
  /** WF-05 Q-12: phiên bản khoá lạc quan của đơn (danh sách, chi tiết, câu trả của lệnh ghi); vắng ở BE cũ. */
  version: z.number().int().nullish(),
  // ── Tiền của đơn giao một phần. Đã thu / còn nợ / công nợ / COD BE bỏ khỏi đơn (4B-10): đọc từ các đợt (BO-08)
  /** Tổng trừ số đơn vị đã đóng ở đơn giao một phần. */
  effectiveTotal: z.number().nullish(),
  /** Phải trả trước khi hàng rời kho (G3-Q4): > 0 thì bàn giao bị từ chối. */
  amountDueBeforeHandover: z.number().nullish(),
  // ── Thuế + dòng phí (4B-3): totalAmount = netAmount + taxAmount
  /** Tổng trước thuế — hàng + dòng phí. */
  netAmount: z.number().nullish(),
  /** VAT của mọi dòng hàng + dòng phí (0 với đơn không VAT). */
  taxAmount: z.number().nullish(),
  /** Dòng phí: phí khuôn mỗi SKU làm lần đầu, phí vận chuyển. */
  fees: z.array(orderFeeDtoSchema).nullish(),
  /** BE luôn gửi danh sách (rỗng khi chưa chia lô); nullish để dòng danh sách / BE cũ vẫn parse. */
  shipments: z.array(orderShipmentDtoSchema).nullish(),
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
  // Hình thức giao + khoá (BE PR #157) và tiền cọc (`depositRequired` / `depositReceivedAt`, BR-PRD-09)
  ...orderReleaseFactsShape,
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

/* ── Tham số lọc `GET /orders` ───────────────────────────────────────── */

/** BE `OrderController#list`: `@RequestParam UUID customerId` — giá trị khác → 400 UNSUPPORTED_PARAMETER. */
export const orderListCustomerIdSchema = uuid("ID khách hàng phải là UUID hợp lệ.");

export function isValidOrderCustomerId(value: string): boolean {
  return orderListCustomerIdSchema.safeParse(value).success;
}
