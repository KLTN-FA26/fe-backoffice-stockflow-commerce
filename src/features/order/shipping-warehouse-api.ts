/**
 * Kho xuất Sale đã chọn cho đơn — API layer (BE `ShippingWarehouseController`, docs 17 §4.2 bước 2–3, BR-21). Chỉ ĐỌC:
 * `GET /orders/{id}/shipping-warehouse/options` cần `sales-order-shipping-warehouses:READ` (quản lý kho có quyền này).
 * `chosenWarehouseId` null khi Sale chưa chọn kho. Dùng để chọn sẵn kho ở hộp thoại release (BE vẫn kiểm kho khi release).
 */

import { z } from "zod";

import { api } from "@/lib/api/client";

const optionsSchema = z.object({ chosenWarehouseId: z.string().nullish() });

export async function getChosenShippingWarehouseId(
  orderId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const { data } = await api.get<unknown>(
    `/orders/${encodeURIComponent(orderId)}/shipping-warehouse/options`,
    { signal },
  );
  return optionsSchema.parse(data).chosenWarehouseId ?? null;
}
