/**
 * Kế toán duyệt tín dụng trước khi gửi hợp đồng (BE PR #486, 15 BR-11): hàng chờ, duyệt (hợp đồng được gửi ngay, người
 * gửi là Sale đã gửi duyệt), từ chối (về DRAFT để Sale sửa), Sale rút đề nghị. Parse tại biên.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { ORDERS_PATH } from "./api";
import { contractCreditReviewPageDtoSchema } from "./contract-credit-review-schemas";
import { salesContractDtoSchema } from "./sales-contract-schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { ContractCreditReview } from "./contract-credit-review-schemas";
import type { SalesContract } from "./sales-contract-schemas";

export interface ListContractCreditReviewParams extends ListQueryParams {
  page?: number;
  size?: number;
}

const reviewPath = (orderId: string, step: "approval" | "rejection" | "withdrawal") =>
  `${ORDERS_PATH}/${encodeURIComponent(orderId)}/contract/credit-review/${step}`;

/** `GET /orders/contract-credit-reviews` — cũ nhất trước, không lọc (quyền `sales-order-credit-holds:READ`). */
export async function listContractCreditReviews(
  params: ListContractCreditReviewParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<ContractCreditReview>> {
  const { page = 0, size = PAGE_SIZE.md } = params;
  const query = new URLSearchParams({ page: String(Math.max(0, page)), size: String(size) });
  const { data } = await api.get<unknown>(`${ORDERS_PATH}/contract-credit-reviews`, {
    params: query,
    signal,
  });
  return contractCreditReviewPageDtoSchema.parse(data);
}

export interface ContractCreditDecisionInput {
  orderId: string;
  /** `contractVersion` của dòng chờ. */
  version: number;
  note: string;
}

/** Duyệt → `ContractView` ở `SENT`. */
export async function approveContractCredit(
  input: ContractCreditDecisionInput,
): Promise<SalesContract> {
  const { data } = await api.post<unknown>(reviewPath(input.orderId, "approval"), {
    version: input.version,
    note: input.note,
  });
  return salesContractDtoSchema.parse(data);
}

/** Từ chối (lý do bắt buộc) → `ContractView` ở `DRAFT`, `creditReview = NONE`. */
export async function rejectContractCredit(
  input: ContractCreditDecisionInput,
): Promise<SalesContract> {
  const { data } = await api.post<unknown>(reviewPath(input.orderId, "rejection"), {
    version: input.version,
    note: input.note,
  });
  return salesContractDtoSchema.parse(data);
}

/** Sale rút đề nghị để sửa hợp đồng → `DRAFT`, `creditReview = NONE` (quyền `sales-contracts:UPDATE`). */
export async function withdrawContractCreditReview(input: {
  orderId: string;
  version: number;
}): Promise<SalesContract> {
  const { data } = await api.post<unknown>(reviewPath(input.orderId, "withdrawal"), {
    version: input.version,
  });
  return salesContractDtoSchema.parse(data);
}
