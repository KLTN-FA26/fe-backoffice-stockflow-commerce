import { z } from "zod";

import { CONTRACT_ESIGN_PATHS as P } from "@/constants/contract-esign";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import {
  companyCertificateSchema,
  contractRevisionsSchema,
  contractSignaturesSchema,
} from "./sales-contract-esign-schemas";
import { downloadLinkDtoSchema, salesContractDtoSchema } from "./sales-contract-schemas";

export const isContractUnavailable = (error: unknown) =>
  error instanceof ApiError && [400, 403, 404, 405].includes(error.status);

export async function optionalContractEndpoint<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error: unknown) {
    if (isContractUnavailable(error)) return null;
    throw error;
  }
}

export function getContractRevisions(orderId: string, signal?: AbortSignal) {
  return optionalContractEndpoint(async () => {
    const { data } = await api.get<unknown>(P.contract(orderId, "/revisions"), { signal });
    return contractRevisionsSchema.parse(data);
  });
}
export function getContractSignatures(orderId: string, signal?: AbortSignal) {
  return optionalContractEndpoint(async () => {
    const { data } = await api.get<unknown>(P.contract(orderId, "/signatures"), { signal });
    return contractSignaturesSchema.parse(data);
  });
}
export function getCompanyCertificate(orderId: string, signal?: AbortSignal) {
  return optionalContractEndpoint(async () => {
    const { data } = await api.get<unknown>(P.contract(orderId, "/company-signature/identity"), {
      signal,
    });
    return companyCertificateSchema.parse(data);
  });
}
export function getContractEsignLink(orderId: string, suffix: string) {
  return optionalContractEndpoint(async () => {
    const { data } = await api.get<unknown>(P.contract(orderId, suffix));
    return downloadLinkDtoSchema.parse(data);
  });
}
export const CONTRACT_ESIGN_ACTIONS = {
  review: "/terms-review",
  approve: "/terms-review/approval",
  reject: "/terms-review/rejection",
  withdraw: "/terms-review/withdrawal",
  extend: "/sign-by",
  companySign: "/company-signature",
  upload: "/company-signature/upload",
} as const;
export type ContractEsignAction = keyof typeof CONTRACT_ESIGN_ACTIONS;
export interface ContractEsignInput {
  orderId: string;
  version: number;
  action: ContractEsignAction;
  note?: string;
  signBy?: string;
  signerName?: string;
  signerTitle?: string;
  file?: File;
}
export async function updateContractEsign(input: ContractEsignInput) {
  const { orderId, action, file, ...body } = input;
  let payload: typeof body | FormData = body;
  if (file) {
    payload = new FormData();
    payload.append("file", file);
    payload.append("version", String(input.version));
    if (body.signerName) payload.append("signerName", body.signerName);
    if (body.signerTitle) payload.append("signerTitle", body.signerTitle);
  }
  const { data } = await api.request<unknown>({
    method: action === "extend" ? "PUT" : "POST",
    url: P.contract(orderId, CONTRACT_ESIGN_ACTIONS[action]),
    data: payload,
    ...(file ? { headers: { "Content-Type": "multipart/form-data" } } : {}),
  });
  // Every write returns SalesContracts.ContractView; tolerate empty legacy responses.
  return data == null ? null : salesContractDtoSchema.parse(data);
}
export const contractListRowSchema = z.object({
  orderId: z.string().nullish(),
  contractId: z.string().nullish(),
  contractNumber: z.string().nullish(),
  orderNumber: z.string().nullish(),
  customerId: z.string().nullish(),
  customerName: z.string().nullish(),
  status: salesContractDtoSchema.shape.status.optional(),
  revision: z.number().nullish(),
  totalAmount: z.number().nullish(),
  sentAt: z.string().nullish(),
  signBy: z.string().nullish(),
  overdueToSign: z.boolean().nullish(),
  customerSignedAt: z.string().nullish(),
  signedAt: z.string().nullish(),
  termsReview: z.string().nullish(),
  creditReview: z.string().nullish(),
  salesOwnerId: z.string().nullish(),
  salesOwnerName: z.string().nullish(),
});
// Same paged envelope as the existing Sales list endpoints.
const contractListSchema = z.object({
  items: z.array(contractListRowSchema).default([]),
  page: z.number().default(0),
  size: z.number().default(15),
  totalElements: z.number().default(0),
  totalPages: z.number().default(0),
  hasNext: z.boolean().default(false),
  hasPrevious: z.boolean().default(false),
});
export const contractSummarySchema = z.object({
  byStatus: z.record(z.string(), z.number()).nullish(),
  awaitingCompanySignature: z.number().nullish(),
  overdueToSign: z.number().nullish(),
  termsReviewPending: z.number().nullish(),
});
export interface ContractListParams {
  page: number;
  size: number;
  status?: readonly string[];
  salesOwnerId?: string;
  mine?: boolean;
  signByBefore?: string;
  termsReview?: string;
  q?: string;
}
export function listSalesContracts(params: ContractListParams, signal?: AbortSignal) {
  return optionalContractEndpoint(async () => {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size) });
    params.status?.forEach((status) => query.append("status", status));
    for (const [key, value] of Object.entries(params))
      if (key !== "status" && value !== undefined) query.set(key, String(value));
    const { data } = await api.get<unknown>(P.list, { params: query, signal });
    return contractListSchema.parse(data);
  });
}
export function getSalesContractSummary(signal?: AbortSignal) {
  return optionalContractEndpoint(async () => {
    const { data } = await api.get<unknown>(P.summary, { signal });
    return contractSummarySchema.parse(data);
  });
}
export type ContractListRow = z.infer<typeof contractListRowSchema>;
