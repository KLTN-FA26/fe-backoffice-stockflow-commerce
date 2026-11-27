/**
 * Báo giá theo thùng — BE `origin/develop` 438fe6fb (`order/internal/controller/dto/QuoteResponse.java`,
 * `QuoteRowResponse.java`, `QuoteRequests.java`). Jackson `non_null` → trường null bị bỏ → `.nullish()`.
 * Tiền là số nguyên VND; số chính thức luôn là số BE trả (`proposed`, `accepted`), FE chỉ xem trước.
 */

import { z } from "zod";

import {
  QUOTE_API_STATUSES,
  QUOTE_FEE_KINDS,
  QUOTE_PRICE_REVIEW_OUTCOMES,
  QUOTE_PRICE_SOURCES,
} from "@/constants";

import { bePageSchema } from "@/lib/api/page-schema";
import { omittedOrNull } from "@/lib/validation/primitives";
import { customerSkuIdAsVariantId } from "@/lib/references/customer-skus";

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
  /** R5-3 (optional until the BE ships it): the line's design name, a short-lived preview URL. */
  designName: omittedOrNull(z.string()),
  previewUrl: omittedOrNull(z.string()),
  /** BE-14: `PURCHASABLE`, `PRODUCT_INACTIVE`… ; null on old lines (null alone never counts as discontinued). */
  purchasability: omittedOrNull(z.string()),
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
  /** R5-8 (optional): who made the change, as a name — staff name, or the customer's. */
  changedByName: omittedOrNull(z.string()),
});

/**
 * 14 BR-10 (sửa ngày 2026-11-26) — một bậc giá so với giá tham chiếu (BE `QuoteResponse.PriceCheckTier`): giá riêng của
 * khách, không có thì giá chuẩn của quy cách; `source` / `referencePrice` / `discountPercent` null khi không có tham chiếu.
 * `discountPercent` dương = thấp hơn giá tham chiếu (âm = cao hơn, không bao giờ cần duyệt).
 */
export const priceCheckTierDtoSchema = z.object({
  minQuantity: z.number().int(),
  unitPrice: z.number(),
  referencePrice: omittedOrNull(z.number()),
  source: omittedOrNull(z.enum(QUOTE_PRICE_SOURCES)),
  discountPercent: omittedOrNull(z.number()),
  needsApproval: z.boolean(),
});

/** Một dòng báo giá đã đo giá (BE `PriceCheckLine`). */
export const priceCheckLineDtoSchema = z.object({
  lineNo: z.number().int(),
  sku: z.string(),
  cartons: z.number().int(),
  needsApproval: z.boolean(),
  tiers: z.array(priceCheckTierDtoSchema).default([]),
});

/** Kiểm tra giá của bản nháp lúc này (BE `PriceCheck`) — chỉ có khi DRAFT: gửi bây giờ thì có phải chờ duyệt không. */
export const priceCheckDtoSchema = z.object({
  thresholdPercent: z.number(),
  needsApproval: z.boolean(),
  lines: z.array(priceCheckLineDtoSchema).default([]),
});

/**
 * Lần gửi duyệt giá gần nhất (BE `PriceReview`), với số liệu lúc gửi. `reason`: lý do từ chối, ghi chú khi duyệt, hoặc lý
 * do huỷ khi báo giá bị huỷ lúc đang chờ.
 */
export const priceReviewDtoSchema = z.object({
  id: z.string(),
  revision: z.number().int(),
  outcome: z.enum(QUOTE_PRICE_REVIEW_OUTCOMES),
  thresholdPercent: z.number(),
  submittedAt: z.string(),
  submittedBy: omittedOrNull(z.string()),
  submittedByName: omittedOrNull(z.string()),
  decidedAt: omittedOrNull(z.string()),
  decidedBy: omittedOrNull(z.string()),
  decidedByName: omittedOrNull(z.string()),
  reason: omittedOrNull(z.string()),
  lines: z.array(priceCheckLineDtoSchema).default([]),
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
  /** BE `QuoteResponse.customerName` / `customerCode`: tên và mã khách trên báo giá (null với khách không còn biết). */
  customerName: omittedOrNull(z.string()),
  customerCode: omittedOrNull(z.string()),
  /** 14 BR-10: bản nháp đang chờ Quản lý kinh doanh duyệt giá (vẫn `DRAFT`, khoá sửa / gửi). */
  priceReviewPending: z.boolean().default(false),
  priceReview: omittedOrNull(priceReviewDtoSchema),
  priceCheck: omittedOrNull(priceCheckDtoSchema),
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
  /**
   * R5-2 (BE round 5, có thể chưa có): tổng có VAT — đã chấp nhận / đã lên đơn thì số chấp nhận, còn lại số đề xuất;
   * null (bị bỏ khỏi JSON) khi chưa đủ giá. Cùng `lineCount`, `firstItemName` (tên thiết kế dòng 1, không có thì SKU).
   */
  total: omittedOrNull(z.number()),
  lineCount: omittedOrNull(z.number().int()),
  firstItemName: omittedOrNull(z.string()),
  /** 14 BR-10: nháp đang chờ duyệt giá. */
  priceReviewPending: z.boolean().default(false),
});
export const quotePageDtoSchema = bePageSchema(quoteRowDtoSchema);

/**
 * SKU riêng của khách — BE `CustomerSkuResponse` (`GET /customer-skus?customerId=`); BE gọi id là `id`, màn hình gọi
 * `variantId` (`customerSkuIdAsVariantId`).
 */
const customerSkuDtoFields = z.object({
  variantId: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: omittedOrNull(z.string()),
  ownerCustomerId: z.string(),
  designSnapshotId: omittedOrNull(z.string()),
  sourceSku: omittedOrNull(z.string()),
  /** `ACTIVE`, `BLOCKED` hoặc `OBSOLETE` — chỉ `ACTIVE` được báo giá (14 BR-04). */
  status: z.string(),
  /** R5-4 (optional until the BE ships it): lets the editor preview cups and tax before the first save (BO-UX-16). */
  unitsPerCarton: omittedOrNull(z.number().int()),
  taxRate: omittedOrNull(z.number()),
});
export const customerSkuDtoSchema = z.preprocess(customerSkuIdAsVariantId, customerSkuDtoFields);
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

/**
 * Giá chuẩn của quy cách — BE `StandardPriceResponse` (chỉ phần form báo giá cần). Giá gợi ý khi khách chưa có giá riêng.
 */
export const standardPriceSuggestionSchema = z.object({
  sku: z.string(),
  moq: z.number().int(),
  tiers: z.array(tierDtoSchema),
});
