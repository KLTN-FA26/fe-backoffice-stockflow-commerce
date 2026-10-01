/**
 * TanStack React Query — client factory + default options.
 *
 * Stale/gc times follow PRODUCTION-FRONTEND-RULES §2.2:
 *   List chứng từ  → 30s / 5m
 *   Detail          → 60s / 10m
 *   Master data     → 10m / 30m
 *   Dashboard KPI   → 15s / 2m
 *   Tracking        → 10s / 2m
 *
 * Defaults here are conservative (30s stale, 5m gc). Individual queries
 * override via their own options.
 */

import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { meKeys } from "@/lib/auth/me-permissions";

import { ApiError } from "./error";

import type { QueryKey } from "@tanstack/react-query";

function isMyPermissionsKey(key: QueryKey): boolean {
  const prefix = meKeys.permissions();
  return prefix.every((part, i) => key[i] === part);
}

export function makeQueryClient(): QueryClient {
  // 403 = quyền đã đổi (admin vừa bỏ tick trên màn Phân quyền) → tải lại /me/permissions
  // để nút tương ứng biến mất (BE PR #39). Bỏ qua lỗi của chính query quyền để không lặp vô hạn.
  const refreshPermissionsOnForbidden = (error: unknown, key?: QueryKey) => {
    if (!(error instanceof ApiError) || error.status !== 403) return;
    if (key && isMyPermissionsKey(key)) return;
    void client.invalidateQueries({ queryKey: meKeys.permissions() });
  };

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => refreshPermissionsOnForbidden(error, query.queryKey),
    }),
    mutationCache: new MutationCache({
      onError: (error) => refreshPermissionsOnForbidden(error),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s — matches "List chứng từ"
        gcTime: 5 * 60_000, // 5m
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          // Never retry 4xx (client errors).
          if (error instanceof ApiError && error.isClientError) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
  return client;
}

/* ── Preset stale/gc times (import in feature queries) ───────────────── */

export const QUERY_TIMES = {
  /** List pages: PO, Receipt, Invoice, Orders … */
  list: { staleTime: 30_000, gcTime: 5 * 60_000 },
  /** Detail pages */
  detail: { staleTime: 60_000, gcTime: 10 * 60_000 },
  /** Master data: products, suppliers, warehouses, categories */
  master: { staleTime: 10 * 60_000, gcTime: 30 * 60_000, refetchOnWindowFocus: false as const },
  /** Dashboard KPI */
  dashboard: { staleTime: 15_000, gcTime: 2 * 60_000 },
  /** Tracking / webhook-driven data */
  tracking: { staleTime: 10_000, gcTime: 2 * 60_000 },
} as const;
