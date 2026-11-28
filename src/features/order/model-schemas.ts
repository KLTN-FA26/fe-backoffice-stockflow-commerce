/**
 * Order — model FE (kiểu UI đọc, sau khi map status BE → FE). DTO ở `schemas.ts`.
 */

import { z } from "zod";

import {
  ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_HOLD_REASONS,
  ORDER_SHIPMENT_READ_STATUSES,
} from "@/constants/labels-order";
import { SETTLEMENT_BLOCKERS, SETTLEMENT_BRANCHES } from "@/constants/labels-order-settlement";
import { ORDER_PAYMENT_TERMS } from "@/constants/orders";
import { ORDER_READ_STATUSES, ORDER_STATUS_UNKNOWN, QUOTE_FEE_KINDS } from "@/constants/statuses";

import { orderDeliveryModeDtoSchema } from "./delivery-mode-schemas";
import { currencyCode, orderBalancePolicyDtoSchema, orderShipmentLineDtoSchema } from "./schemas";

const orderDeliveryFailureReasonSchema = z.enum([
  ...ORDER_DELIVERY_FAILURE_REASONS,
  ORDER_STATUS_UNKNOWN,
]);

/**
 * Dòng đơn. `isCustom`: dòng in theo thiết kế ⇔ `designSnapshotId != null`
 * (BE `OrderLine#isMadeToOrder`, docs 14 BR-02) — BE không có cờ riêng.
 */
export const orderLineSchema = z.object({
  lineId: z.string(),
  sku: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  isCustom: z.boolean(),
  designSnapshotId: z.string().nullable(),
  /** Phiếu giữ hàng của dòng — BE chỉ trả mã, chưa có API xem chi tiết reservation. */
  reservationIds: z.array(z.string()),
  /** null khi BE không trả (dòng danh sách / đơn chưa có lô giao). */
  shippedQuantity: z.number().int().nullable(),
  deliveredQuantity: z.number().int().nullable(),
  cancelledQuantity: z.number().int().nullable(),
  /** Số thùng / cái mỗi thùng (đơn từ báo giá theo thùng); null với dòng theo cái. */
  cartons: z.number().int().nullable(),
  unitsPerCarton: z.number().int().nullable(),
  /** R5-3: tên thiết kế của dòng; vắng khi BE chưa trả. */
  designName: z.string().nullish(),
});

export const orderShipmentSchema = z.object({
  shipmentId: z.string(),
  status: z.enum(ORDER_SHIPMENT_READ_STATUSES),
  handedOverAt: z.string().nullable(),
  outcomeAt: z.string().nullable(),
  failureReason: orderDeliveryFailureReasonSchema.nullable(),
  /** Rỗng khi BE không gửi `lines`. */
  lines: z.array(orderShipmentLineDtoSchema),
  /** Q-12: BE nói lô còn đóng được như thất lạc; null = BE chưa trả (luật dự phòng ở `canCloseLostShipment`). */
  lostClosable: z.boolean().nullable(),
});

/**
 * Khối điều kiện hoàn tất / đóng đơn do BE tính (F-1, `schemas.ts#settlementReadinessDtoSchema`). Mã chặn đã biết có
 * `known: true`; mã BE thêm sau giữ nguyên chuỗi với `known: false`.
 */
export const settlementReadinessSchema = z.object({
  branch: z.enum([...SETTLEMENT_BRANCHES, ORDER_STATUS_UNKNOWN]),
  returnWindowDays: z.number().int().nullable(),
  returnWindowEndsAt: z.string().nullable(),
  owing: z.boolean(),
  openReturn: z.boolean(),
  uninvoicedShipmentIds: z.array(z.string()),
  shippingFeeUninvoiced: z.boolean(),
  refundOutstanding: z.boolean(),
  completionHeld: z.boolean(),
  completesAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  blockers: z.array(
    z.union([
      z.object({ code: z.enum(SETTLEMENT_BLOCKERS), known: z.literal(true) }),
      z.object({ code: z.string(), known: z.literal(false) }),
    ]),
  ),
  returnAdjustmentUnissued: z.boolean(),
  /** Sale giữ hoàn tất được ngay (BE `completionHoldable`). */
  completionHoldable: z.boolean(),
  /** Audit r3 EINV-7: còn bản giảm do giao không thành công chưa phát hành — dòng thông tin, không chặn. */
  deliveryReductionUnissued: z.boolean(),
});

/** Dòng phí của đơn (4B-3); field BE vắng → null. */
export const orderFeeSchema = z.object({
  kind: z.enum([...QUOTE_FEE_KINDS, ORDER_STATUS_UNKNOWN]),
  sku: z.string().nullable(),
  amount: z.number(),
  taxRate: z.number().nullable(),
  taxAmount: z.number().nullable(),
});

export const orderCancellationSchema = z.object({
  reasonCode: z.string().nullable(),
  reason: z.string().nullable(),
  retainedAmount: z.number().nullable(),
  feeReason: z.string().nullable(),
  feeDetail: z.string().nullable(),
  feeAmount: z.number().nullable(),
  feeBearer: z.string().nullable(),
});

/**
 * Kiểu UI đọc. Người nhận lấy từ `shippingAddress`, fallback `contact*`.
 * BE không trả subtotal/phí ship/thuế/giảm giá → UI không hiển thị các field đó (không bịa số).
 * Field BE vắng → null (mảng → []); mapper không tự tính số tiền nào.
 */
export const orderSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string().nullable(),
  /** Tên khách BE kèm sẵn (BE-15); null khi BE không trả (khách tự xem đơn, đơn trả từ thao tác). */
  customerName: z.string().nullable(),
  customerCode: z.string().nullable(),
  /** R5-7: báo giá nguồn của đơn; vắng khi BE chưa trả / đơn không từ báo giá. */
  sourceQuoteId: z.string().nullish(),
  sourceQuoteNumber: z.string().nullish(),
  status: z.enum(ORDER_READ_STATUSES),
  totalAmount: z.number(),
  currency: currencyCode,
  placedAt: z.string(),
  recipientName: z.string(),
  recipientPhone: z.string(),
  contactEmail: z.string().nullable(),
  /** Địa chỉ giao đã ghép sẵn (line1, line2, phường/xã, tỉnh); null khi BE không có. */
  shippingAddressText: z.string().nullable(),
  lines: z.array(orderLineSchema),
  // Thanh toán / release / huỷ (SCRUM-423/427/460)
  // Đã thu / trạng thái thanh toán BE bỏ khỏi đơn (4B-10) — đọc từ `GET /installments/orders/{id}` (WF-05 BO-08)
  paymentTerm: z.enum(ORDER_PAYMENT_TERMS).nullable(),
  /** Số ngày trả sau khi giao (đơn CREDIT, hoặc đơn cọc ON_CREDIT); null nếu khác. */
  creditTermDays: z.number().int().nullable(),
  /** null khi đơn không cọc (hoặc dòng danh sách không mang field này). */
  balancePolicy: orderBalancePolicyDtoSchema.nullable(),
  warehouseId: z.string().nullable(),
  /** Issue #286: mã + tên kho xuất, null khi BE chưa gửi. */
  warehouseCode: z.string().nullable(),
  warehouseName: z.string().nullable(),
  /**
   * Audit bo-17: tiền của các đợt trên dòng danh sách. null = chưa có hợp đồng (chưa có đợt); `undefined` = BE chưa trả
   * field (bản trước PR #497) — danh sách ẩn hẳn cột khi cả trang không có.
   */
  paidAmount: z.number().nullish(),
  outstandingAmount: z.number().nullish(),
  overdueAmount: z.number().nullish(),
  /** D50: công ty chịu một khoản phí của đơn (dòng danh sách). */
  feeBorneByCompany: z.boolean(),
  releasedAt: z.string().nullable(),
  cancellation: orderCancellationSchema.nullable(),
  // Vòng đời (BE PR #133)
  /** Staff: lý do đang giữ; null khi đơn không ON_HOLD. */
  holdReason: z.enum([...ORDER_HOLD_REASONS, ORDER_STATUS_UNKNOWN]).nullable(),
  holdReasonPublic: z.string().nullable(),
  /** Trạng thái FE đơn quay về khi gỡ giữ; null với giữ công nợ. */
  statusBeforeHold: z.enum(ORDER_READ_STATUSES).nullable(),
  holdNote: z.string().nullable(),
  packedAt: z.string().nullable(),
  /** Mốc thùng giao đầu tiên được dán nhãn; có rồi thì đơn không huỷ, không đổi địa chỉ giao (docs 08 BR-04). */
  firstLabeledAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  deliveryFailureReason: orderDeliveryFailureReasonSchema.nullable(),
  completedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  /** F-1: lúc tiền hoàn đã chi xong; null khi BE chưa trả / chưa hoàn. */
  refundedAt: z.string().nullable(),
  /** F-1: khối điều kiện hoàn tất / đóng của BE; null khi BE không trả (chưa giao gì, dòng danh sách, BE cũ). */
  settlementReadiness: settlementReadinessSchema.nullable(),
  /**
   * WF-05 Q-12 (BE 6bbfa15b `OrderResponse.version`): phiên bản khoá lạc quan của đơn — gửi lại làm `version` khi đóng
   * phần thất lạc (409 OPTIMISTIC_LOCK khi đơn đã đổi). null khi BE không trả (cổng khách, BE cũ).
   */
  version: z.number().int().nullable(),
  effectiveTotal: z.number().nullable(),
  amountDueBeforeHandover: z.number().nullable(),
  /** 4B-3: tổng trước thuế / VAT; null khi BE không trả (dòng danh sách, đơn cũ). */
  netAmount: z.number().nullable(),
  taxAmount: z.number().nullable(),
  /** Rỗng khi BE không trả `fees`. */
  fees: z.array(orderFeeSchema),
  /** Rỗng khi BE không trả `shipments` (đơn chưa chia lô). */
  shipments: z.array(orderShipmentSchema),
  /** null = BE không trả (dòng danh sách) — màn chi tiết không đoán, ẩn điều khiển. */
  allowPartialShipment: z.boolean().nullable(),
  printLinesReady: z.boolean().nullable(),
  /** null = BE không trả (dòng danh sách) — màn chi tiết không đoán, ẩn điều khiển. */
  deliveryMode: orderDeliveryModeDtoSchema.nullable(),
  /** null = BE không trả; true = không còn đổi được hình thức giao. */
  deliveryModeLocked: z.boolean().nullable(),
  /** Tiền cọc cần có (đơn cọc) và lúc đã nhận; null = vắng (đơn không cọc / chưa nhận). */
  depositRequired: z.number().nullable(),
  depositReceivedAt: z.string().nullable(),
  /** Số dòng in (dòng có thiết kế đã khoá) — BE `Order#printLines`: release dòng in cần mẫu duyệt (BR-PRD-08). */
  printLineCount: z.number().int().nonnegative(),
});
