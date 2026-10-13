/**
 * Đơn hàng phía khách (portal) — BE develop `OrderController` `/orders/me`, `/orders/me/{id}`
 * (CustomerOrderCardResponse / CustomerOrderDetailResponse, có timeline). Không chứa dữ liệu nội bộ
 * (giữ hàng, checksum, người thao tác). Jackson `non_null` → nullish.
 */

import { z } from "zod";

import { bePageSchema } from "@/lib/api/page-schema";

export const STATUS_GROUPS = [
  "AWAITING_PAYMENT",
  "UNDER_REVIEW",
  "CONFIRMED",
  "IN_PRODUCTION",
  "PREPARING",
  "SHIPPING",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;
export type StatusGroup = (typeof STATUS_GROUPS)[number];

/** Nhóm trạng thái khách đọc → chuỗi status-map (nhãn Việt + tone dùng chung). */
export const STATUS_GROUP_DISPLAY: Readonly<Record<StatusGroup, string>> = {
  AWAITING_PAYMENT: "Pending Payment",
  UNDER_REVIEW: "Under Review",
  CONFIRMED: "Confirmed",
  IN_PRODUCTION: "In Production",
  PREPARING: "Preparing",
  SHIPPING: "Shipping",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

const statusGroup = z.enum(STATUS_GROUPS);

export const myOrderCardDtoSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  statusGroup,
  total: z.number(),
  currency: z.string(),
  placedAt: z.string(),
  lineCount: z.number().int(),
  deliveryState: z.string().nullish(),
});
export const myOrderPageDtoSchema = bePageSchema(myOrderCardDtoSchema);

export const myOrderDetailDtoSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  statusGroup,
  holdReasonPublic: z.string().nullish(),
  paymentTerm: z.string().nullish(),
  total: z.number(),
  currency: z.string(),
  placedAt: z.string(),
  shippingAddress: z
    .object({
      recipientName: z.string().nullish(),
      phone: z.string().nullish(),
      line1: z.string().nullish(),
      line2: z.string().nullish(),
      wardName: z.string().nullish(),
      provinceName: z.string().nullish(),
    })
    .nullish(),
  payment: z
    .object({
      status: z.string(),
      paidAmount: z.number().nullish(),
      depositRequired: z.number().nullish(),
    })
    .nullish(),
  lines: z.array(
    z.object({
      lineId: z.string(),
      sku: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number(),
      lineTotal: z.number(),
      designSnapshotId: z.string().nullish(),
      production: z.object({ state: z.string(), goodQuantity: z.number().int() }).nullish(),
    }),
  ),
  timeline: z.array(
    z.object({
      status: z.string(),
      statusGroup,
      occurredAt: z.string(),
      reasonCode: z.string().nullish(),
    }),
  ),
  deliveryState: z.string().nullish(),
});

export type MyOrderCard = z.infer<typeof myOrderCardDtoSchema>;
export type MyOrderDetail = z.infer<typeof myOrderDetailDtoSchema>;
