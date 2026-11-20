import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import {
  getArtifactDownloadUrl,
  getArtifactPreflight,
  getDesign,
  listDesignArtifacts,
  listDesignHistory,
  listDesignQuoteRequests,
  listReviewQueue,
} from "./api";

import type { PageParams } from "./api";

export const designKeys = {
  all: ["designs"] as const,
  /** Không truyền tham số = mọi trang của hàng đợi (để invalidate). */
  queue: (params?: PageParams) =>
    params
      ? ([...designKeys.all, "queue", params] as const)
      : ([...designKeys.all, "queue"] as const),
  detail: (id: string) => [...designKeys.all, "detail", id] as const,
  history: (id: string) => [...designKeys.all, "history", id] as const,
  artifacts: (id: string) => [...designKeys.all, "artifacts", id] as const,
  quoteRequests: (id: string) => [...designKeys.all, "quote-requests", id] as const,
  preflight: (id: string, artifactId: string) =>
    [...designKeys.all, "preflight", id, artifactId] as const,
  link: (id: string, artifactId: string) => [...designKeys.all, "link", id, artifactId] as const,
};

/** Vòng duyệt dự án — BO-4 bổ sung list / detail; ở đây chỉ cần gốc để invalidate sau khi quyết định. */
export const roundKeys = {
  all: ["design-review-rounds"] as const,
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
