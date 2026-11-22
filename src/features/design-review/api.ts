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
  reviewRoundDtoSchema,
  reviewRoundPageSchema,
  roundApprovalDtoSchema,
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
  ReviewRound,
  RoundApproval,
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

const ROUNDS = "/design-review-rounds";
const roundById = (id: string) => `${ROUNDS}/${encodeURIComponent(id)}`;

/** Vòng duyệt dự án chưa đóng, chờ lâu nhất trước; BE không nhận lọc / sắp xếp. */
export async function listReviewRounds(
  params: PageParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<ReviewRound>> {
  const { data } = await api.get<unknown>(ROUNDS, {
    params: { page: Math.max(0, params.page), size: params.size },
    signal,
  });
  return reviewRoundPageSchema.parse(data);
}

/** Cả vòng đã đóng. */
export async function getReviewRound(id: string, signal?: AbortSignal): Promise<ReviewRound> {
  const { data } = await api.get<unknown>(roundById(id), { signal });
  return reviewRoundDtoSchema.parse(data);
}

export interface ApproveRoundInput {
  roundId: string;
  /** Đúng `version` đang hiển thị của từng thiết kế còn chờ (1–20, 12 BR-11). */
  designs: { id: string; version: number }[];
}

/**
 * "Duyệt tất cả": BE duyệt tuần tự, thiết kế nào không duyệt được vẫn chờ. Lệnh chạy lâu (tới 20 thiết kế): axios và BFF
 * chờ 120 s theo `LONG_RUNNING_ROUTES`.
 */
export async function approveRound({
  roundId,
  designs,
}: ApproveRoundInput): Promise<RoundApproval> {
  const { data } = await api.post<unknown>(`${roundById(roundId)}/approvals`, { designs });
  return roundApprovalDtoSchema.parse(data);
}
