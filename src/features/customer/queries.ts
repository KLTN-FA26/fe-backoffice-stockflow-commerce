import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import {
  getCreditProfile,
  getCustomer,
  getCustomerStatusHistory,
  getLegalProfile,
  getPortalInvitation,
  listCustomers,
} from "./api";
import { getCreditPosition } from "./credit-profile-api";
import { listCustomerOrders, listCustomerQuotes } from "./documents-api";

import type { ListCustomerParams } from "./api";
import type { CustomerDocumentsParams } from "./documents-api";
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

/** Dư nợ / còn dùng được / quá hạn — dưới `detail(id)`: lưu hạn mức (invalidate `customerKeys.all`) tải lại theo. */
export function useCreditPosition(id: string, enabled = true) {
  return useQuery({
    queryKey: sub(id, "credit-position"),
    queryFn: ({ signal }) => getCreditPosition(id, signal),
    enabled,
    ...QUERY_TIMES.detail,
  });
}

/** `null` = chưa có hồ sơ pháp lý. BE cần `customer-legal-profiles:READ`. */
export function useLegalProfile(id: string, enabled = true) {
  return useQuery({
    queryKey: sub(id, "legal-profile"),
    queryFn: ({ signal }) => getLegalProfile(id, signal),
    enabled,
    ...QUERY_TIMES.detail,
  });
}

/** Báo giá của khách (bo-30) — dưới `detail(id)`: đổi khách / trạng thái thì tải lại cùng trang. */
export function useCustomerQuotes(params: CustomerDocumentsParams, enabled = true) {
  return useQuery({
    queryKey: [...sub(params.customerId, "quotes"), params.page, params.size] as const,
    queryFn: ({ signal }) => listCustomerQuotes(params, signal),
    enabled,
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}

/** Đơn của khách (bo-30). */
export function useCustomerOrders(params: CustomerDocumentsParams, enabled = true) {
  return useQuery({
    queryKey: [...sub(params.customerId, "orders"), params.page, params.size] as const,
    queryFn: ({ signal }) => listCustomerOrders(params, signal),
    enabled,
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}
