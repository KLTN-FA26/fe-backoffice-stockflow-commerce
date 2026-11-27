/** Đề nghị cấp hạn mức — query hooks. */

import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getCreditRequest, listCreditRequests, type ListCreditRequestParams } from "./api";

import type { CreditRequest } from "./types";

export const creditRequestKeys = createQueryKeys<ListCreditRequestParams>("credit-requests");

export const useCreditRequests = createListQuery<CreditRequest, ListCreditRequestParams>(
  creditRequestKeys,
  listCreditRequests,
);

export const useCreditRequest = createDetailQuery<CreditRequest>(
  creditRequestKeys,
  getCreditRequest,
);
