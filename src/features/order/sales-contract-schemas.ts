/**
 * Hợp đồng mua bán của đơn — DTO BE `SalesContracts.ContractView` / `PlanSuggestion` (origin/develop 438fe6fb,
 * `order/internal/service/SalesContracts.java`). Jackson `non_null` → trường null bị bỏ → `.nullish()`.
 * Tiền số nguyên VND; số chốt luôn là số BE trả (`totals`, `paymentPlan[].amount`).
 */

import { z } from "zod";

import { SALES_CONTRACT_STATUSES } from "@/constants";

import { omittedOrNull } from "@/lib/validation/primitives";

export const contractPartySchema = z.object({
  name: z.string(),
  taxCode: omittedOrNull(z.string()),
  address: omittedOrNull(z.string()),
  representative: omittedOrNull(z.string()),
  representativeTitle: omittedOrNull(z.string()),
});

export const contractBatchViewSchema = z.object({
  seq: z.number().int(),
  windowStart: omittedOrNull(z.string()),
  windowEnd: omittedOrNull(z.string()),
  /** Giá trị hàng của đợt, có VAT (14 BR-13) — điểm xuất phát của đợt thanh toán gắn với nó. */
  value: z.number(),
  lines: z.array(
    z.object({
      orderLineId: z.string(),
      sku: omittedOrNull(z.string()),
      cartons: z.number().int(),
      units: z.number().int(),
    }),
  ),
});

export const contractInstallmentViewSchema = z.object({
  seq: z.number().int(),
  name: z.string(),
  /** `ON_SIGNING` | `BEFORE_DELIVERY` | `AFTER_DELIVERY` (chuỗi để không vỡ khi BE thêm mốc). */
  milestone: z.string(),
  percent: omittedOrNull(z.number()),
  amount: z.number(),
  dueDays: omittedOrNull(z.number().int()),
  deliveryBatchSeq: omittedOrNull(z.number().int()),
});

/** 15 BR-11: gửi hợp đồng có phần trả sau giao → cảnh báo tín dụng, không chặn. */
export const contractCreditWarningSchema = z.object({
  outcome: z.string(),
  creditLimit: omittedOrNull(z.number()),
  exposure: omittedOrNull(z.number()),
  afterDelivery: omittedOrNull(z.number()),
});

export const salesContractDtoSchema = z.object({
  id: z.string(),
  contractNumber: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  status: z.enum(SALES_CONTRACT_STATUSES),
  seller: contractPartySchema,
  buyer: contractPartySchema,
  freeSampleRounds: z.number().int(),
  totals: z.object({
    netAmount: z.number(),
    taxAmount: z.number(),
    totalAmount: z.number(),
    currency: z.string(),
  }),
  deliverySchedule: z.array(contractBatchViewSchema).default([]),
  paymentPlan: z.array(contractInstallmentViewSchema).default([]),
  sentAt: omittedOrNull(z.string()),
  sentBy: omittedOrNull(z.string()),
  signedOn: omittedOrNull(z.string()),
  signedFileName: omittedOrNull(z.string()),
  signedAt: omittedOrNull(z.string()),
  signedBy: omittedOrNull(z.string()),
  cancelledAt: omittedOrNull(z.string()),
  cancelledBy: omittedOrNull(z.string()),
  cancellationReason: omittedOrNull(z.string()),
  completedAt: omittedOrNull(z.string()),
  version: z.number().int(),
  creditWarning: omittedOrNull(contractCreditWarningSchema),
  returnWindowDays: omittedOrNull(z.number().int()),
});

export const salesContractHistoryDtoSchema = z.array(salesContractDtoSchema);

export const paymentPlanSuggestionDtoSchema = z.object({
  contractId: z.string(),
  version: z.number().int(),
  totalAmount: z.number(),
  paymentPlan: z.array(contractInstallmentViewSchema),
});

/** BE `DownloadLink` — đường dẫn tải có hạn. */
export const downloadLinkDtoSchema = z.object({
  url: z.string(),
  expiresAt: omittedOrNull(z.string()),
});

export type SalesContract = z.infer<typeof salesContractDtoSchema>;
export type ContractBatch = z.infer<typeof contractBatchViewSchema>;
export type ContractInstallment = z.infer<typeof contractInstallmentViewSchema>;
export type ContractCreditWarning = z.infer<typeof contractCreditWarningSchema>;
export type PaymentPlanSuggestion = z.infer<typeof paymentPlanSuggestionDtoSchema>;
