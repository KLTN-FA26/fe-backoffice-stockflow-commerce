/** Đơn hàng của khách (portal) — API layer. Parse tại biên. */

import { api } from "@/lib/api/client";

import { myOrderDetailDtoSchema, myOrderPageDtoSchema } from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { MyOrderCard, MyOrderDetail } from "./types";

export interface ListMyOrderParams extends ListQueryParams {
  page?: number;
  size?: number;
}

/** BE develop `GET /orders/me` — chỉ đơn của khách đang đăng nhập (scope OWN). */
export async function listMyOrders(
  params: ListMyOrderParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<MyOrderCard>> {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 10),
    sort: "placedAt,desc",
  });
  const { data } = await api.get<unknown>("/orders/me", { params: query, signal });
  return myOrderPageDtoSchema.parse(data);
}

/** BE develop `GET /orders/me/{id}` — kèm dòng thời gian trạng thái (SCRUM-248). */
export async function getMyOrder(id: string, signal?: AbortSignal): Promise<MyOrderDetail> {
  const { data } = await api.get<unknown>(`/orders/me/${encodeURIComponent(id)}`, { signal });
  return myOrderDetailDtoSchema.parse(data);
}
