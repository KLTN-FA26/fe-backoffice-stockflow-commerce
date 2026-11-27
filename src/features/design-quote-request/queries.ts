import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createQueryKeys } from "@/lib/api/query-factory";

import { getDesignPreview, listDesignQuoteRequests, listProjectQuoteRequests } from "./api";

import type { DesignQuoteRequestParams, ProjectQuoteRequestParams } from "./api";

export const designQuoteRequestKeys =
  createQueryKeys<DesignQuoteRequestParams>("design-quote-requests");
export const projectQuoteRequestKeys = createQueryKeys<ProjectQuoteRequestParams>(
  "design-project-quote-requests",
);

export function useDesignQuoteRequests(params: DesignQuoteRequestParams) {
  return useQuery({
    queryKey: designQuoteRequestKeys.list(params),
    queryFn: ({ signal }) => listDesignQuoteRequests(params, signal),
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}

export function useProjectQuoteRequests(params: ProjectQuoteRequestParams) {
  return useQuery({
    queryKey: projectQuoteRequestKeys.list(params),
    queryFn: ({ signal }) => listProjectQuoteRequests(params, signal),
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}

/** Số yêu cầu tối đa tải một lần để tìm yêu cầu đang mở (BE `Pages.MAX_PAGE_SIZE`). */
const DETAIL_LOOKUP_SIZE = 200;

/**
 * Một yêu cầu báo giá dự án. BE không có `GET /design-project-quote-requests/{id}` và `GET /design-projects/{id}/
 * quote-requests` chỉ mở cho khách chủ dự án → tải yêu cầu của KHÁCH đó (mọi trạng thái, tối đa 200, mới nhất trước) rồi
 * tìm theo id. Khoá nằm dưới `projectQuoteRequestKeys.all` nên đóng / lập báo giá làm mới luôn trang chi tiết.
 */
export function useProjectQuoteRequest(customerId: string, requestId: string) {
  const params: ProjectQuoteRequestParams = { customerId, page: 0, size: DETAIL_LOOKUP_SIZE };
  return useQuery({
    queryKey: projectQuoteRequestKeys.list(params),
    queryFn: ({ signal }) => listProjectQuoteRequests(params, signal),
    select: (page) => page.items.find((request) => request.id === requestId) ?? null,
    enabled: Boolean(customerId),
    ...QUERY_TIMES.list,
  });
}

/** Ảnh xem trước của một thiết kế con trong yêu cầu dự án. */
export function useDesignPreview(designId: string) {
  return useQuery({
    queryKey: ["design-quote-request", "design-preview", designId] as const,
    queryFn: ({ signal }) => getDesignPreview(designId, signal),
    ...QUERY_TIMES.list,
  });
}
