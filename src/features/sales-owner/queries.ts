/**
 * Phân công khách — query hooks và query keys. Danh sách khách nằm dưới root `customers` (đổi người phụ trách ở đâu
 * cũng làm mới); bảng tải dưới `sales-workload` (chung với ô chọn Sale ở `lib/references`).
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { salesWorkloadKeys } from "@/lib/references/sales-workload";

import {
  listChatWorkload,
  listCustomersOf,
  listTemporaryBatches,
  listUnownedCustomers,
} from "./api";
import { listCovers, listLeads, listOwnerChangeRequests } from "./work-api";

import type { OwnerChangeRequestStatus, SalesOwnerState } from "@/constants/sales-owner";
import type { LeadListParams } from "./work-api";

export const salesOwnerFeatureKeys = {
  chatWorkload: () => [...salesWorkloadKeys.all, "chat"] as const,
  batches: ["sales-owner-transfers"] as const,
  ownedBy: (userId: string) => [...QUERY_ROOTS.customers, "owned-by", userId] as const,
  unowned: (state: string, page: number, size: number) =>
    [...QUERY_ROOTS.customers, "unowned", state, page, size] as const,
  leads: ["sales-leads"] as const,
  covers: ["staff-covers"] as const,
  requests: ["sales-owner-change-requests"] as const,
};
const K = salesOwnerFeatureKeys;

export function useChatWorkload(enabled = true) {
  return useQuery({
    queryKey: K.chatWorkload(),
    queryFn: ({ signal }) => listChatWorkload(signal),
    enabled,
    ...QUERY_TIMES.list,
  });
}

export function useTemporaryBatches(enabled = true) {
  return useQuery({
    queryKey: K.batches,
    queryFn: ({ signal }) => listTemporaryBatches(signal),
    enabled,
    ...QUERY_TIMES.list,
  });
}

export function useCustomersOf(userId: string, enabled = true) {
  return useQuery({
    queryKey: K.ownedBy(userId),
    queryFn: ({ signal }) => listCustomersOf(userId, signal),
    enabled: enabled && !!userId,
    ...QUERY_TIMES.list,
  });
}

export function useUnownedCustomers(
  params: { state: Exclude<SalesOwnerState, "ASSIGNED">; page: number; size: number },
  enabled = true,
) {
  return useQuery({
    queryKey: K.unowned(params.state, params.page, params.size),
    queryFn: ({ signal }) => listUnownedCustomers(params, signal),
    enabled,
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}

export function useLeads(params: LeadListParams, enabled = true) {
  return useQuery({
    queryKey: [...K.leads, params] as const,
    queryFn: ({ signal }) => listLeads(params, signal),
    enabled,
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}

export function useCovers(params: { userId?: string; active?: boolean }, enabled = true) {
  return useQuery({
    queryKey: [...K.covers, params] as const,
    queryFn: ({ signal }) => listCovers(params, signal),
    enabled,
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}

export function useOwnerChangeRequests(
  params: { page: number; size: number; status?: OwnerChangeRequestStatus },
  enabled = true,
) {
  return useQuery({
    queryKey: [...K.requests, params] as const,
    queryFn: ({ signal }) => listOwnerChangeRequests(params, signal),
    enabled,
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}
