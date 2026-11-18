import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { listDeliveryDocuments } from "./delivery-documents-api";
import { orderKeys } from "./queries";

/** File vận đơn & POD của đơn — dưới root `orders`: mọi mutation đơn (invalidate `orderKeys.all`) làm mới luôn. */
export const deliveryDocumentKeys = {
  list: (orderId: string) => [...orderKeys.all, "delivery-documents", orderId] as const,
};

export function useOrderDeliveryDocuments(orderId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: deliveryDocumentKeys.list(orderId),
    queryFn: ({ signal }) => listDeliveryDocuments(orderId, signal),
    ...QUERY_TIMES.detail,
    enabled: !!orderId && (options.enabled ?? true),
    retry: false,
  });
}
