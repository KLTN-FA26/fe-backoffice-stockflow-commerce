import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createQueryKeys } from "@/lib/api/query-factory";

import { listDesignQuoteRequests, listProjectQuoteRequests } from "./api";

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
