/**
 * Lô giao đã giao thành công của một đơn — để ô "Lô giao" của hoá đơn nháp chọn theo mã người đọc được thay vì
 * gõ id nội bộ (docs 21 BR-01: mỗi lô giao `Delivered` một hoá đơn gốc). Đặt ở `lib/` để feature `einvoice` không
 * import `features/shipping` (feature-architecture). BE `GET /fulfillment/shipments?orderId&status=DELIVERED`
 * (fulfillment-shipments:READ); key dưới root `fulfillment-shipments` của feature shipping.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { PAGE_SIZE, SHARED_QUERY_ROOTS } from "@/constants";
import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

/** Chỉ phần ô chọn cần của BE `ShipmentRowResponse`. */
const orderShipmentSchema = z.object({
  shipmentId: z.string(),
  /** `<số đơn>-S<n>`. */
  code: z.string(),
  packageCount: z.number().int().nullish(),
  outcomeAt: z.string().nullish(),
});
const orderShipmentPageSchema = z.object({ items: z.array(orderShipmentSchema) });

export type OrderShipmentRef = z.infer<typeof orderShipmentSchema>;

export const orderShipmentKeys = {
  delivered: (orderId: string) =>
    [SHARED_QUERY_ROOTS.fulfillmentShipments, "delivered-of-order", orderId] as const,
};

export async function fetchDeliveredShipmentsOfOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderShipmentRef[]> {
  const { data } = await api.get<unknown>("/fulfillment/shipments", {
    params: { orderId, status: "DELIVERED", page: 0, size: PAGE_SIZE.masterData },
    signal,
  });
  return orderShipmentPageSchema.parse(data).items;
}

/** Các lô giao đã giao thành công của đơn, mã tăng dần (S1, S2…). */
export function useDeliveredShipmentsOfOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: orderShipmentKeys.delivered(orderId ?? ""),
    queryFn: ({ signal }) => fetchDeliveredShipmentsOfOrder(orderId ?? "", signal),
    enabled: !!orderId,
    select: (rows) =>
      [...rows].sort((a, b) => a.code.localeCompare(b.code, "vi", { numeric: true })),
    ...QUERY_TIMES.list,
  });
}
