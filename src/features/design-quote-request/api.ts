/**
 * Yêu cầu báo giá thiết kế — API layer (BE `DesignQuoteRequestController`, `DesignProjectController`).
 * Quyền READ / UPDATE: `design-quote-requests`. Danh sách mới nhất trước. Parse tại biên.
 */

import { api } from "@/lib/api/client";

import {
  createdQuoteSchema,
  designQuoteRequestPageSchema,
  projectQuoteRequestPageSchema,
} from "./schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { DesignQuoteRequest, ProjectQuoteRequest, QuoteRequestStatus } from "./types";

const DESIGN_REQUESTS = "/design-quote-requests";
const PROJECT_REQUESTS = "/design-project-quote-requests";
const closure = (base: string, id: string) => `${base}/${encodeURIComponent(id)}/closure`;

export interface DesignQuoteRequestParams {
  customerId?: string;
  /** Trống = mọi trạng thái. */
  status?: QuoteRequestStatus;
  /** Trang 0-based trên dây. */
  page: number;
  size: number;
}

export interface ProjectQuoteRequestParams {
  customerId?: string;
  /** Trống = mọi trạng thái (BE-3). */
  status?: QuoteRequestStatus;
  page: number;
  size: number;
}

export async function listDesignQuoteRequests(
  params: DesignQuoteRequestParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<DesignQuoteRequest>> {
  const { data } = await api.get<unknown>(DESIGN_REQUESTS, {
    params: {
      page: Math.max(0, params.page),
      size: params.size,
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    signal,
  });
  return designQuoteRequestPageSchema.parse(data);
}

export async function listProjectQuoteRequests(
  params: ProjectQuoteRequestParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<ProjectQuoteRequest>> {
  const { data } = await api.get<unknown>(PROJECT_REQUESTS, {
    params: {
      page: Math.max(0, params.page),
      size: params.size,
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    signal,
  });
  return projectQuoteRequestPageSchema.parse(data);
}

/** Idempotent: đóng yêu cầu đã đóng vẫn 200. */
export async function closeDesignQuoteRequest(id: string): Promise<void> {
  await api.post(closure(DESIGN_REQUESTS, id));
}

export async function closeProjectQuoteRequest(id: string): Promise<void> {
  await api.post(closure(PROJECT_REQUESTS, id));
}

const quoteOf = (base: string, id: string) => `${base}/${encodeURIComponent(id)}/quote`;

/**
 * Lập báo giá nháp từ yêu cầu (BE `…/quote`, không body): 201 lần đầu, 200 khi đã có — cùng một báo giá. BE tự đóng
 * yêu cầu. Chỉ cần `id` để mở màn sửa; phần còn lại của báo giá do màn đó tải lại.
 */
export async function createQuoteFromDesignRequest(id: string): Promise<{ id: string }> {
  const { data } = await api.post<unknown>(quoteOf(DESIGN_REQUESTS, id));
  return createdQuoteSchema.parse(data);
}

export async function createQuoteFromProjectRequest(id: string): Promise<{ id: string }> {
  const { data } = await api.post<unknown>(quoteOf(PROJECT_REQUESTS, id));
  return createdQuoteSchema.parse(data);
}
