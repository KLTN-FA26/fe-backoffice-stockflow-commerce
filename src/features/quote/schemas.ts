/**
 * Báo giá theo thùng — BE `origin/develop` 438fe6fb (`order/internal/controller/dto/QuoteResponse.java`,
 * `QuoteRowResponse.java`, `QuoteRequests.java`). Jackson `non_null` → trường null bị bỏ → `.nullish()`.
 * Tiền là số nguyên VND; số chính thức luôn là số BE trả (`proposed`, `accepted`), FE chỉ xem trước.
 */

import { z } from "zod";

import { QUOTE_API_STATUSES, QUOTE_FEE_KINDS } from "@/constants";

import { bePageSchema } from "@/lib/api/page-schema";
import { omittedOrNull } from "@/lib/validation/primitives";

/* ── DTO ─────────────────────────────────────────────────────────────── */

/** Bậc giá: từ `minQuantity` thùng trở lên, `unitPrice` VND một cái. */
export const tierDtoSchema = z.object({ minQuantity: z.number().int(), unitPrice: z.number() });

/**
 * BE `TotalsBuilder`: thiếu phần nào (dòng chưa giá, phí chưa nhập tiền) thì phần đó và `total` là null nên bị bỏ
 * khỏi JSON (`non_null`) — vd dòng chưa giá cho `{"fees":0}` hoặc `{}`. Đọc lỏng, màn hình chỉ coi là "đủ" khi có cả bốn.
 */
export const totalsDtoSchema = z.object({
  subtotal: omittedOrNull(z.number()),
  fees: omittedOrNull(z.number()),
  tax: omittedOrNull(z.number()),
  total: omittedOrNull(z.number()),
});

export const quoteLineDtoSchema = z.object({
  id: z.string(),
  lineNo: z.number().int(),
  /** `CARTON` (báo giá theo thùng) hoặc `UNIT` (báo giá cũ trước rescope). */
  measure: z.string(),
  sku: z.string(),
  cartons: omittedOrNull(z.number().int()),
  unitsPerCarton: omittedOrNull(z.number().int()),
  units: z.number().int(),
  designSnapshotId: omittedOrNull(z.string()),
  printSpec: omittedOrNull(z.string()),
  priced: z.boolean(),
  moq: omittedOrNull(z.number().int()),
  tiers: z.array(tierDtoSchema).default([]),
  proposedUnitPrice: omittedOrNull(z.number()),
  proposedLineTotal: omittedOrNull(z.number()),
  acceptedCartons: omittedOrNull(z.number().int()),
  acceptedUnits: omittedOrNull(z.number().int()),
  acceptedUnitPrice: omittedOrNull(z.number()),
  acceptedLineTotal: omittedOrNull(z.number()),
  taxClass: omittedOrNull(z.string()),
  taxRate: omittedOrNull(z.number()),
  proposedTax: omittedOrNull(z.number()),
  acceptedTax: omittedOrNull(z.number()),
});

export const quoteFeeDtoSchema = z.object({
  id: z.string(),
  kind: z.enum(QUOTE_FEE_KINDS),
  sku: omittedOrNull(z.string()),
  /** `null` = phí khuôn hệ thống tự thêm, Sale chưa nhập tiền (bắt buộc trước khi gửi, 14 BR-17). */
  amount: omittedOrNull(z.number()),
  taxClass: omittedOrNull(z.string()),
  taxRate: omittedOrNull(z.number()),
  tax: omittedOrNull(z.number()),
});

export const quoteTransitionDtoSchema = z.object({
  revision: z.number().int(),
  fromStatus: omittedOrNull(z.enum(QUOTE_API_STATUSES)),
  toStatus: z.enum(QUOTE_API_STATUSES),
  reason: omittedOrNull(z.string()),
  changedAt: z.string(),
  changedBy: omittedOrNull(z.string()),
});

export const quoteDtoSchema = z.object({
  id: z.string(),
  quoteNumber: z.string(),
  customerId: z.string(),
  status: z.enum(QUOTE_API_STATUSES),
  revision: z.number().int(),
  validUntil: z.string(),
  terms: omittedOrNull(z.string()),
  requestedDeliveryDate: omittedOrNull(z.string()),
  /** Báo giá cũ trước rescope (theo cái): chỉ xem. */
  legacy: z.boolean().default(false),
  lines: z.array(quoteLineDtoSchema),
  fees: z.array(quoteFeeDtoSchema).default([]),
  priced: z.boolean(),
  proposed: omittedOrNull(totalsDtoSchema),
  accepted: omittedOrNull(totalsDtoSchema),
  proposedTotal: omittedOrNull(z.number()),
  acceptedTotal: omittedOrNull(z.number()),
  sentAt: omittedOrNull(z.string()),
  sentBy: omittedOrNull(z.string()),
  respondedAt: omittedOrNull(z.string()),
  respondedBy: omittedOrNull(z.string()),
  customerFeedback: omittedOrNull(z.string()),
  cancellationReason: omittedOrNull(z.string()),
  convertedOrder: omittedOrNull(
    z.object({
      orderId: z.string(),
      orderNumber: z.string(),
      status: z.string(),
      total: z.number(),
    }),
  ),
  convertedAt: omittedOrNull(z.string()),
  history: z.array(quoteTransitionDtoSchema).default([]),
  createdAt: z.string(),
  createdBy: omittedOrNull(z.string()),
  version: z.number().int(),
});

/** Dòng danh sách — BE `QuoteRowResponse` (không có điều khoản thanh toán). */
export const quoteRowDtoSchema = z.object({
  id: z.string(),
  quoteNumber: z.string(),
  customerId: z.string(),
  status: z.enum(QUOTE_API_STATUSES),
  revision: z.number().int(),
  validUntil: z.string(),
  sentAt: omittedOrNull(z.string()),
  convertedOrderId: omittedOrNull(z.string()),
  createdAt: z.string(),
  version: z.number().int(),
});
export const quotePageDtoSchema = bePageSchema(quoteRowDtoSchema);

/** SKU riêng của khách — BE `product.api.CustomerSku` (`GET /customer-skus?customerId=`). */
export const customerSkuDtoSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: omittedOrNull(z.string()),
  ownerCustomerId: z.string(),
  designSnapshotId: omittedOrNull(z.string()),
  sourceSku: omittedOrNull(z.string()),
  /** `ACTIVE`, `BLOCKED` hoặc `OBSOLETE` — chỉ `ACTIVE` được báo giá (14 BR-04). */
  status: z.string(),
});
export const customerSkuListDtoSchema = z.array(customerSkuDtoSchema);

/** Giá riêng của khách cho một SKU — BE `CustomerPriceResponse` (404 = chưa có giá riêng). */
export const customerPriceDtoSchema = z.object({
  customerId: z.string(),
  sku: z.string(),
  measure: z.string(),
  moq: z.number().int(),
  tiers: z.array(tierDtoSchema),
  note: omittedOrNull(z.string()),
  version: z.number().int(),
});
