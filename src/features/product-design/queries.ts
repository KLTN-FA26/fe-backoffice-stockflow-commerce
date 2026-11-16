import { useQuery } from "@tanstack/react-query";

import { getModelFileLink, getPrintConfig } from "./api";

import type { PrintConfigDto } from "./types";

/**
 * Query keys of print configurations, one entry per variant. No key of `features/product` shows whether a variant
 * has a 3D model (its variant and product DTOs do not carry it), so no shared root is needed.
 */
export const printConfigKeys = {
  all: ["print-configs"] as const,
  variant: (productId: string, variantId: string) =>
    [...printConfigKeys.all, productId, variantId] as const,
  /** The short-lived link to a stored `.glb`; a new `version` is a new file, so a new key. */
  modelFile: (productId: string, variantId: string, templateId: string, version: number) =>
    [...printConfigKeys.variant(productId, variantId), "model-file", templateId, version] as const,
};

/** The variant's print configuration; `null` data when it has none (not an error). */
export function usePrintConfig(productId: string | undefined, variantId: string | undefined) {
  return useQuery({
    queryKey: printConfigKeys.variant(productId ?? "", variantId ?? ""),
    queryFn: ({ signal }) => getPrintConfig(productId ?? "", variantId ?? "", signal),
    enabled: Boolean(productId) && Boolean(variantId),
  });
}

/** Link refresh margin: the BE's link is short-lived, so it is never kept past this (ms). */
const LINK_STALE_MS = 60_000;

/**
 * The URL to read the stored `.glb` of a configuration (BE `GET …/model-file/download-url`). Asked only when the
 * configuration has a file (`model3d.hasFile`); the link is short-lived, so it is fetched when needed and not kept long.
 */
export function useModelFileUrl(config: PrintConfigDto | null | undefined) {
  const { productId, variantId, templateId, version } = config ?? {};
  return useQuery({
    queryKey: printConfigKeys.modelFile(
      productId ?? "",
      variantId ?? "",
      templateId ?? "",
      version ?? 0,
    ),
    queryFn: ({ signal }) =>
      getModelFileLink(productId ?? "", variantId ?? "", templateId ?? "", signal),
    enabled: Boolean(config?.model3d.hasFile),
    staleTime: LINK_STALE_MS,
    gcTime: LINK_STALE_MS,
  });
}
