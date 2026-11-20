/**
 * Duyệt thiết kế — API layer (BE `DesignReviewController`, `DesignWorkflowController`, `DesignController`,
 * `DesignQuoteRequestController`; origin/develop 5fe7b9a16). Parse tại biên.
 *
 * Người duyệt chỉ đọc được thiết kế đang `PENDING_REVIEW` (BE `CustomerDesignRules.java:40-53`): ngoài trường hợp đó BE
 * trả 404, không phải 403.
 */

import { api } from "@/lib/api/client";

import {
  artifactLinkSchema,
  designArtifactListSchema,
  designDecisionPageSchema,
  designDtoSchema,
  designPageSchema,
  designPreflightDtoSchema,
  designQuoteRequestListSchema,
} from "./schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type {
  ArtifactLink,
  Design,
  DesignArtifact,
  DesignDecision,
  DesignDecisionOutput,
  DesignPreflight,
  DesignQuoteRequest,
} from "./types";

const DESIGNS = "/designs";
const byId = (id: string) => `${DESIGNS}/${encodeURIComponent(id)}`;
const artifact = (id: string, artifactId: string) =>
  `${byId(id)}/artifacts/${encodeURIComponent(artifactId)}`;

export interface PageParams {
  /** Trang 0-based trên dây (BE `PageResponse`). */
  page: number;
  size: number;
}

/** Hàng đợi chờ lâu nhất trước; BE không nhận lọc / sắp xếp. */
export async function listReviewQueue(
  params: PageParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Design>> {
  const { data } = await api.get<unknown>(`${DESIGNS}/review-queue`, {
    params: { page: Math.max(0, params.page), size: params.size },
    signal,
  });
  return designPageSchema.parse(data);
}

export async function getDesign(id: string, signal?: AbortSignal): Promise<Design> {
  const { data } = await api.get<unknown>(byId(id), { signal });
  return designDtoSchema.parse(data);
}

export async function listDesignHistory(
  id: string,
  params: PageParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<DesignDecision>> {
  const { data } = await api.get<unknown>(`${byId(id)}/history`, { params, signal });
  return designDecisionPageSchema.parse(data);
}

export async function listDesignArtifacts(
  id: string,
  signal?: AbortSignal,
): Promise<DesignArtifact[]> {
  const { data } = await api.get<unknown>(`${byId(id)}/artifacts`, { signal });
  return designArtifactListSchema.parse(data);
}

/** BE kiểm lại file từ đầu mỗi lần gọi (tải file về) — chậm, chỉ gọi khi người duyệt mở khối. */
export async function getArtifactPreflight(
  id: string,
  artifactId: string,
  signal?: AbortSignal,
): Promise<DesignPreflight> {
  const { data } = await api.get<unknown>(`${artifact(id, artifactId)}/preflight`, { signal });
  return designPreflightDtoSchema.parse(data);
}

export async function getArtifactDownloadUrl(
  id: string,
  artifactId: string,
  signal?: AbortSignal,
): Promise<ArtifactLink> {
  const { data } = await api.get<unknown>(`${artifact(id, artifactId)}/download-url`, { signal });
  return artifactLinkSchema.parse(data);
}

export async function listDesignQuoteRequests(
  id: string,
  signal?: AbortSignal,
): Promise<DesignQuoteRequest[]> {
  const { data } = await api.get<unknown>(`${byId(id)}/quote-requests`, { signal });
  return designQuoteRequestListSchema.parse(data);
}

export type DecideDesignInput = { id: string; version: number } & DesignDecisionOutput;

/**
 * Duyệt / trả lại đúng `version` đang hiển thị (12 BR-11). Lệnh chạy lâu: axios và BFF chờ 120 s theo
 * `LONG_RUNNING_ROUTES` (`constants/auth.ts`).
 */
export async function decideDesign({
  id,
  version,
  approved,
  notes,
}: DecideDesignInput): Promise<Design> {
  const { data } = await api.post<unknown>(`${byId(id)}/reviews`, {
    version,
    approved,
    ...(notes ? { notes } : {}),
  });
  return designDtoSchema.parse(data);
}
