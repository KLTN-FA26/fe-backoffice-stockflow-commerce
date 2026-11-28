/**
 * Đề nghị cấp hạn mức — API back office (BE `CreditRequestController`, `/credit-requests`, PR #490). Parse tại biên.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import { uploadFileDirect } from "@/lib/api/direct-upload";

import {
  creditRequestDtoSchema,
  creditRequestFileSchema,
  creditRequestPageDtoSchema,
  downloadLinkSchema,
} from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  CreditRequest,
  CreditRequestApproveBody,
  CreditRequestCreateBody,
  CreditRequestFile,
  CreditRequestRecommendBody,
} from "./types";

const BASE = "/credit-requests";
const path = (id: string, suffix = "") => `${BASE}/${encodeURIComponent(id)}${suffix}`;

export interface ListCreditRequestParams extends ListQueryParams {
  page?: number;
  size?: number;
  /** BE nhận MỘT trạng thái. */
  status?: string;
  customerId?: string;
}

/** `GET /credit-requests` — mới nhất trước; dòng không có `files` / `review`. */
export async function listCreditRequests(
  params: ListCreditRequestParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CreditRequest>> {
  const { page = 0, size = PAGE_SIZE.md, status, customerId } = params;
  const query = new URLSearchParams({ page: String(Math.max(0, page)), size: String(size) });
  if (status) query.set("status", status);
  if (customerId) query.set("customerId", customerId);
  const { data } = await api.get<unknown>(BASE, { params: query, signal });
  return creditRequestPageDtoSchema.parse(data);
}

/** Chi tiết kèm `files` và (back office) `review`. */
export async function getCreditRequest(id: string, signal?: AbortSignal): Promise<CreditRequest> {
  const { data } = await api.get<unknown>(path(id), { signal });
  return creditRequestDtoSchema.parse(data);
}

/** Sale tạo thay khách (kèm ý kiến) → `PENDING_APPROVAL`. */
export async function createCreditRequest(body: CreditRequestCreateBody): Promise<CreditRequest> {
  const { data } = await api.post<unknown>(BASE, body);
  return creditRequestDtoSchema.parse(data);
}

export async function recommendCreditRequest(input: {
  id: string;
  version: number;
  body: CreditRequestRecommendBody;
}): Promise<CreditRequest> {
  const { data } = await api.post<unknown>(path(input.id, "/recommendation"), {
    version: input.version,
    ...input.body,
  });
  return creditRequestDtoSchema.parse(data);
}

export async function approveCreditRequest(input: {
  id: string;
  version: number;
  /** `review.creditTermsVersion` (−1 khi khách chưa có hạn mức). */
  creditTermsVersion: number;
  body: CreditRequestApproveBody;
}): Promise<CreditRequest> {
  const { data } = await api.post<unknown>(path(input.id, "/approval"), {
    version: input.version,
    creditTermsVersion: input.creditTermsVersion,
    ...input.body,
  });
  return creditRequestDtoSchema.parse(data);
}

export async function rejectCreditRequest(input: {
  id: string;
  version: number;
  reason: string;
}): Promise<CreditRequest> {
  const { data } = await api.post<unknown>(path(input.id, "/rejection"), {
    version: input.version,
    reason: input.reason,
  });
  return creditRequestDtoSchema.parse(data);
}

/** Người đã gửi rút đề nghị còn mở. */
export async function withdrawCreditRequest(input: {
  id: string;
  version: number;
}): Promise<CreditRequest> {
  const { data } = await api.post<unknown>(path(input.id, "/withdrawal"), {
    version: input.version,
  });
  return creditRequestDtoSchema.parse(data);
}

/** Tải giấy tờ: khai báo slot → PUT thẳng lên storage → gắn `uploadId` vào đề nghị. */
export async function attachCreditRequestFile(input: {
  id: string;
  file: File;
}): Promise<CreditRequestFile> {
  const uploadId = await uploadFileDirect({
    file: input.file,
    declare: async (declaration, signal) =>
      (await api.post<unknown>(path(input.id, "/files/uploads"), declaration, { signal })).data,
  });
  const { data } = await api.post<unknown>(path(input.id, "/files"), { uploadId });
  return creditRequestFileSchema.parse(data);
}

/** Link tải ngắn hạn. */
export async function getCreditRequestFileUrl(id: string, fileId: string): Promise<string> {
  const { data } = await api.get<unknown>(
    path(id, `/files/${encodeURIComponent(fileId)}/download-url`),
  );
  return downloadLinkSchema.parse(data).url;
}
