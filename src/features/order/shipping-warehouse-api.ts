/**
 * Kho xuất của đơn — API layer (BE `ShippingWarehouseController`, docs 17 §4.2 bước 2–3, BR-21, BR-22):
 *
 *   GET /orders/{id}/shipping-warehouse/options — `sales-order-shipping-warehouses:READ`: các kho xếp theo gợi ý, tồn
 *       (thùng) từng dòng và sức chứa (m³) từng kho; `chosenWarehouseId` null khi Sale chưa chọn kho. Quản lý kho dùng
 *       `getChosenShippingWarehouseId` để chọn sẵn kho ở hộp thoại release (BE vẫn kiểm kho khi release).
 *   GET /orders/{id}/stock-coverage — `sales-order-shipping-warehouses:READ`: đã giữ bao nhiêu thùng, theo dòng và đợt giao.
 *   PUT /orders/{id}/shipping-warehouse {warehouseId} — `sales-order-shipping-warehouses:UPDATE` (Sale): chọn kho và giữ
 *       phần có sẵn (nguyên thùng, không hạn); trả `Coverage`. 404 WAREHOUSE_NOT_FOUND; 409
 *       ORDER_SHIPPING_WAREHOUSE_NOT_ALLOWED (không phải đơn đã xác nhận / chờ hàng của hợp đồng) hoặc _LOCKED (đã giữ hàng
 *       / đã có Đơn sản xuất gửi về kho hiện tại, BR-22).
 */

import { z } from "zod";

import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { orderPath } from "./api";
import {
  shippingCoverageSchema,
  shippingWarehouseOptionsSchema,
} from "./shipping-warehouse-schemas";

import type {
  ChooseShippingWarehouseValues,
  ShippingCoverage,
  ShippingWarehouseOptions,
} from "./shipping-warehouse-schemas";

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

export async function getShippingWarehouseOptions(
  orderId: string,
  signal?: AbortSignal,
): Promise<ShippingWarehouseOptions> {
  const { data } = await api.get<unknown>(orderPath(orderId, "/shipping-warehouse/options"), {
    signal,
  });
  return shippingWarehouseOptionsSchema.parse(data);
}

export async function getShippingCoverage(
  orderId: string,
  signal?: AbortSignal,
): Promise<ShippingCoverage> {
  const { data } = await api.get<unknown>(orderPath(orderId, "/stock-coverage"), { signal });
  return shippingCoverageSchema.parse(data);
}

export type ChooseShippingWarehouseInput = ChooseShippingWarehouseValues & {
  orderId: string;
  idempotencyKey?: string;
};

export async function chooseShippingWarehouse(
  input: ChooseShippingWarehouseInput,
): Promise<ShippingCoverage> {
  const { orderId, warehouseId, idempotencyKey } = input;
  const { data } = await api.put<unknown>(
    orderPath(orderId, "/shipping-warehouse"),
    { warehouseId },
    idempotencyRequestConfig(idempotencyKey),
  );
  return shippingCoverageSchema.parse(data);
}
