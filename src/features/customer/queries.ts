import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import {
  getCreditProfile,
  getCustomer,
  getCustomerStatusHistory,
  getPortalInvitation,
  listCustomers,
} from "./api";

import type { ListCustomerParams } from "./api";
import type { Customer } from "./types";

export const customerKeys = createQueryKeys<ListCustomerParams>("customers");

export const useCustomers = createListQuery<Customer, ListCustomerParams>(
  customerKeys,
  listCustomers,
);
export const useCustomer = createDetailQuery<Customer>(customerKeys, getCustomer);

const sub = (id: string, name: string) => [...customerKeys.detail(id), name] as const;

export function useCustomerStatusHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: sub(id, "status-history"),
    queryFn: ({ signal }) => getCustomerStatusHistory(id, signal),
    enabled,
    ...QUERY_TIMES.detail,
  });
}

/** Trạng thái lời mời — BE chỉ cho SALES_STAFF / ECOMMERCE_ADMIN (role check trong controller). */
export function usePortalInvitation(id: string, enabled = true) {
  return useQuery({
    queryKey: sub(id, "portal-invitation"),
    queryFn: ({ signal }) => getPortalInvitation(id, signal),
    enabled,
    ...QUERY_TIMES.detail,
  });
}

export function useCreditProfile(id: string, enabled = true) {
  return useQuery({
    queryKey: sub(id, "credit-profile"),
    queryFn: ({ signal }) => getCreditProfile(id, signal),
    enabled,
    ...QUERY_TIMES.detail,
  });
}
