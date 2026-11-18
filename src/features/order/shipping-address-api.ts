/**
 * Đổi địa chỉ giao — API layer (`PUT /orders/{id}/shipping-address`, BE WF04 G2; docs 17 §4.7, BR-16).
 *
 * Tách khỏi `api.ts` (giới hạn 200 dòng / file); cùng quy ước: path không có `v1`, parse zod một lần ở biên.
 * BE `sales-order-addresses:UPDATE` (scope ALL). Trả `OrderResponse`; cùng địa chỉ lần nữa BE không đổi gì và không ghi
 * lịch sử. 404 ADDRESS_NOT_FOUND (không phải địa chỉ của khách), 409 ORDER_ADDRESS_LOCKED (đã dán nhãn / bước không cho đổi).
 */

import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { toOrder } from "./api";
import { orderDtoSchema } from "./schemas";

import type { OrderMutationVars } from "./api";
import type { Order } from "./types";

export type ChangeShippingAddressInput = OrderMutationVars<{ shippingAddressId: string }>;

export async function changeShippingAddress(input: ChangeShippingAddressInput): Promise<Order> {
  const { id, shippingAddressId, idempotencyKey } = input;
  const { data } = await api.put<unknown>(
    `/orders/${encodeURIComponent(id)}/shipping-address`,
    { shippingAddressId },
    idempotencyRequestConfig(idempotencyKey),
  );
  return toOrder(orderDtoSchema.parse(data));
}
