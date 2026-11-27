/**
 * Hàng chờ Kế toán duyệt tín dụng TRƯỚC khi gửi hợp đồng — DTO BE `ContractCreditReviewResponse`
 * (`GET /orders/contract-credit-reviews`, PR #486; kltn-docs 15 BR-11, 14 §4.3 bước 13). Số liệu tại lúc Sale gửi
 * duyệt; `contractVersion` là phiên bản hợp đồng HIỆN TẠI — gửi kèm khi duyệt / từ chối.
 */

import { z } from "zod";

import { bePageSchema } from "@/lib/api/page-schema";
import { omittedOrNull } from "@/lib/validation/primitives";

export const contractCreditReviewDtoSchema = z.object({
  reviewId: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  contractId: z.string(),
  contractNumber: z.string(),
  contractVersion: z.number().int(),
  customerId: z.string(),
  /** Null khi module khách không còn bản ghi (BE `CustomerLabel`). */
  customer: omittedOrNull(
    z.object({ customerId: z.string(), name: z.string(), code: omittedOrNull(z.string()) }),
  ),
  /** `OVERDUE` | `OVER_LIMIT`. */
  checkOutcome: z.string(),
  creditLimit: omittedOrNull(z.number()),
  exposure: omittedOrNull(z.number()),
  afterDelivery: omittedOrNull(z.number()),
  overdueAmount: omittedOrNull(z.number()),
  submittedBy: omittedOrNull(z.string()),
  submittedAt: z.string(),
});

export const contractCreditReviewPageDtoSchema = bePageSchema(contractCreditReviewDtoSchema);

/** Ghi chú duyệt / lý do từ chối: bắt buộc, 1–500 ký tự (BE `SalesContractRequests.CreditDecision`). */
export const CONTRACT_CREDIT_NOTE_MAX = 500;

export type ContractCreditReview = z.infer<typeof contractCreditReviewDtoSchema>;
