/**
 * Các lô giao đã giao thành công của một đơn — cho hộp "Lập hoá đơn nháp" của feature `einvoice`, không import
 * `features/order` / `features/shipping` (feature-architecture). Lấy từ `GET /orders/{id}` (`sales-orders:READ` — Kế toán
 * có; Kế toán KHÔNG có quyền đọc lô giao nên không dùng `/fulfillment/shipments`). Mã lô (`<mã đơn>-S<n>`) không có ở đây:
 * lô đã có hoá đơn thì lấy mã từ hoá đơn, lô chưa có hoá đơn nào được gọi theo ngày giao. Key dưới root `orders`.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { SHARED_QUERY_ROOTS } from "@/constants";
import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

const orderShipmentsSchema = z.object({
  shipments: z
    .array(
      z.object({
        shipmentId: z.string(),
        status: z.string(),
        outcomeAt: z.string().nullish(),
      }),
    )
    .nullish(),
});

export interface DeliveredShipmentRef {
  shipmentId: string;
  /** Lúc hãng báo giao thành công (ISO). */
  deliveredAt: string | null;
}

export const deliveredShipmentKeys = {
  ofOrder: (orderId: string) =>
    [SHARED_QUERY_ROOTS.salesOrders, "delivered-shipments", orderId] as const,
};

export function useDeliveredShipmentsOfOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: deliveredShipmentKeys.ofOrder(orderId ?? ""),
    queryFn: async ({ signal }): Promise<DeliveredShipmentRef[]> => {
      const { data } = await api.get<unknown>(`/orders/${encodeURIComponent(orderId ?? "")}`, {
        signal,
      });
      return (orderShipmentsSchema.parse(data).shipments ?? [])
        .filter((shipment) => shipment.status === "DELIVERED")
        .map((shipment) => ({
          shipmentId: shipment.shipmentId,
          deliveredAt: shipment.outcomeAt ?? null,
        }));
    },
    enabled: !!orderId,
    ...QUERY_TIMES.list,
  });
}
