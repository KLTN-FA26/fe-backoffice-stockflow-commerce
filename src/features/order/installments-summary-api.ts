/**
 * Các đợt thanh toán của một đơn, để điền khối "Thanh toán" ở chi tiết đơn — API layer
 * (BE `GET /installments/orders/{orderId}`, `payment-installments:READ`, docs 15 §5.2). `OrderResponse` không còn mang
 * phương thức / trạng thái / đã thu (BE b7d3d7b4), nên khối đọc từ đây. Chỉ lấy các field khối cần; đợt không có
 * trường "phương thức" nên khối không hiện dòng đó. Màn đầy đủ của Kế toán ở `features/payment`.
 */

import { z } from "zod";

import { INSTALLMENT_API_STATUSES } from "@/constants/payment";
import { api } from "@/lib/api/client";

const installmentSchema = z.object({
  installmentId: z.string(),
  seq: z.number().int(),
  name: z.string(),
  amount: z.number(),
  paidAmount: z.number(),
  status: z.enum(INSTALLMENT_API_STATUSES),
});

export const orderInstallmentsSummarySchema = z.object({
  total: z.number(),
  paid: z.number(),
  currency: z.string(),
  installments: z.array(installmentSchema),
});

export type OrderInstallmentsSummary = z.infer<typeof orderInstallmentsSummarySchema>;

export async function getOrderInstallmentsSummary(
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderInstallmentsSummary> {
  const { data } = await api.get<unknown>(`/installments/orders/${encodeURIComponent(orderId)}`, {
    signal,
  });
  return orderInstallmentsSummarySchema.parse(data);
}
