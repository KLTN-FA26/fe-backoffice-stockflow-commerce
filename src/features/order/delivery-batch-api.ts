/**
 * Lịch giao của đơn — API layer (BE `DeliveryBatchController`, docs 17 §4.5). Dùng cho ô chọn đợt giao ở hộp thoại
 * release. Endpoint cần `sales-contracts:READ`; seed BE (V20261115000200) không cấp cho quản lý kho nên màn chỉ gọi
 * khi người dùng có mã đó (xem `ORDER_SCHEDULE_PERMISSIONS`).
 */

import { api } from "@/lib/api/client";

import { beDeliveryScheduleSchema } from "./delivery-batch-schemas";

import type { z } from "zod";

export type DeliverySchedule = z.infer<typeof beDeliveryScheduleSchema>;
export type DeliveryBatch = DeliverySchedule["batches"][number];

export async function getDeliverySchedule(
  orderId: string,
  signal?: AbortSignal,
): Promise<DeliverySchedule> {
  const { data } = await api.get<unknown>(
    `/orders/${encodeURIComponent(orderId)}/delivery-batches`,
    {
      signal,
    },
  );
  return beDeliveryScheduleSchema.parse(data);
}

/**
 * Đợt mặc định của hộp thoại release: đợt sớm nhất chưa release và chưa đóng (BR-29 — BE chỉ nhận đợt kế tiếp; FE chỉ
 * gợi ý, BE vẫn là bên quyết). Không có đợt nào → undefined (bỏ trống, BE tự chọn).
 */
export function nextBatchToRelease(batches: readonly DeliveryBatch[]): DeliveryBatch | undefined {
  return [...batches]
    .sort((a, b) => a.seq - b.seq)
    .find(
      (batch) => !batch.releasedAt && (batch.state === "AWAITING_STOCK" || batch.state === "READY"),
    );
}
