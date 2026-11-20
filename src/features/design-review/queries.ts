import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import {
  getArtifactDownloadUrl,
  getArtifactPreflight,
  getDesign,
  getReviewRound,
  listDesignArtifacts,
  listDesignHistory,
  listDesignQuoteRequests,
  listReviewQueue,
  listReviewRounds,
} from "./api";

import type { PageParams } from "./api";

export const designKeys = {
  all: ["designs"] as const,
  /** Không truyền tham số = mọi trang của hàng đợi (để invalidate). */
  queue: (params?: PageParams) =>
    params
      ? ([...designKeys.all, "queue", params] as const)
      : ([...designKeys.all, "queue"] as const),
  /** Mọi dữ liệu của một thiết kế (chi tiết, file, lịch sử, yêu cầu báo giá, preflight, link) — để tải lại / bỏ cùng lúc. */
  design: (id: string) => [...designKeys.all, "design", id] as const,
  detail: (id: string) => [...designKeys.design(id), "detail"] as const,
  history: (id: string) => [...designKeys.design(id), "history"] as const,
  artifacts: (id: string) => [...designKeys.design(id), "artifacts"] as const,
  quoteRequests: (id: string) => [...designKeys.design(id), "quote-requests"] as const,
  preflight: (id: string, artifactId: string) =>
    [...designKeys.design(id), "preflight", artifactId] as const,
  link: (id: string, artifactId: string) => [...designKeys.design(id), "link", artifactId] as const,
};

/** Vòng duyệt dự án. `all` để invalidate cả danh sách lẫn chi tiết sau khi quyết định. */
export const roundKeys = {
  all: ["design-review-rounds"] as const,
  lists: () => [...roundKeys.all, "list"] as const,
  list: (params: PageParams) => [...roundKeys.lists(), params] as const,
  details: () => [...roundKeys.all, "detail"] as const,
  detail: (id: string) => [...roundKeys.details(), id] as const,
};

const HISTORY_PAGE: PageParams = { page: 0, size: 50 };

export function useReviewQueue(params: PageParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: designKeys.queue(params),
    queryFn: ({ signal }) => listReviewQueue(params, signal),
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
    enabled: options?.enabled !== false,
  });
}

export function useReviewRounds(params: PageParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: roundKeys.list(params),
    queryFn: ({ signal }) => listReviewRounds(params, signal),
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
    enabled: options?.enabled !== false,
  });
}

export function useReviewRound(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: roundKeys.detail(id),
    queryFn: ({ signal }) => getReviewRound(id, signal),
    ...QUERY_TIMES.detail,
    enabled: options?.enabled !== false,
  });
}

export function useDesign(id: string | null | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: designKeys.detail(id ?? ""),
    queryFn: ({ signal }) => getDesign(id ?? "", signal),
    ...QUERY_TIMES.detail,
    enabled: !!id && options?.enabled !== false,
  });
}

export function useDesignHistory(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: designKeys.history(id),
    queryFn: ({ signal }) => listDesignHistory(id, HISTORY_PAGE, signal),
    ...QUERY_TIMES.detail,
    enabled: options?.enabled !== false,
  });
}

export function useDesignArtifacts(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: designKeys.artifacts(id),
    queryFn: ({ signal }) => listDesignArtifacts(id, signal),
    ...QUERY_TIMES.detail,
    enabled: options?.enabled !== false,
  });
}

export function useDesignQuoteRequests(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: designKeys.quoteRequests(id),
    queryFn: ({ signal }) => listDesignQuoteRequests(id, signal),
    ...QUERY_TIMES.detail,
    enabled: options?.enabled !== false,
  });
}

/** Chỉ chạy khi người duyệt mở khối kiểm tra (BE tải file về kiểm lại); kết quả không đổi với cùng file. */
export function useArtifactPreflight(id: string, artifactId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: designKeys.preflight(id, artifactId ?? ""),
    queryFn: ({ signal }) => getArtifactPreflight(id, artifactId ?? "", signal),
    ...QUERY_TIMES.master,
    // Mỗi lần gọi BE tải lại file in (tới 50 MB) để kiểm: không tự thử lại khi hết giờ; người duyệt bấm "Thử lại".
    retry: false,
    enabled: enabled && !!artifactId,
  });
}

/** Link ký ngắn hạn (BE `no-store`): luôn lấy mới, không giữ lâu trong cache. */
export const artifactLinkOptions = (id: string, artifactId: string) => ({
  queryKey: designKeys.link(id, artifactId),
  queryFn: ({ signal }: { signal?: AbortSignal }) => getArtifactDownloadUrl(id, artifactId, signal),
  staleTime: 0,
  gcTime: 30_000,
});

export function useArtifactLink(id: string, artifactId: string, enabled: boolean) {
  return useQuery({ ...artifactLinkOptions(id, artifactId), enabled, refetchOnWindowFocus: false });
}

/** "Tải về": lấy link mới ngay lúc bấm (link cũ có thể đã hết hạn). */
export function useFetchArtifactLink(id: string) {
  const queryClient = useQueryClient();
  return (artifactId: string) => queryClient.fetchQuery(artifactLinkOptions(id, artifactId));
}
