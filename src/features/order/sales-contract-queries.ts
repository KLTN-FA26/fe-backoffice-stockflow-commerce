/** Hợp đồng của đơn — query key nằm dưới `orderKeys.all` để mọi mutation đơn tải lại cả hợp đồng. */

import { useQuery } from "@tanstack/react-query";

import { orderKeys } from "./queries";
import { getSalesContract, getSalesContractHistory } from "./sales-contract-api";

export const contractKeys = {
  of: (orderId: string) => [...orderKeys.all, "contract", orderId] as const,
  history: (orderId: string) => [...orderKeys.all, "contract", orderId, "history"] as const,
};

export function useSalesContract(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: contractKeys.of(orderId),
    queryFn: ({ signal }) => getSalesContract(orderId, signal),
    enabled,
  });
}

export function useSalesContractHistory(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: contractKeys.history(orderId),
    queryFn: ({ signal }) => getSalesContractHistory(orderId, signal),
    enabled,
  });
}
