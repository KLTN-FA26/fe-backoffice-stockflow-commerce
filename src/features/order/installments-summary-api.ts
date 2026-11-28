/**
 * Các đợt thanh toán của một đơn, để điền khối "Thanh toán" ở chi tiết đơn — API layer
 * (BE `GET /installments/orders/{orderId}`, `payment-installments:READ`, docs 15 §5.2). `OrderResponse` không còn mang
 * phương thức / trạng thái / đã thu (BE b7d3d7b4), nên khối đọc từ đây. Chỉ lấy các field khối cần; đợt không có
 * trường "phương thức" nên khối không hiện dòng đó. Màn đầy đủ của Kế toán ở `features/payment`.
 */

import { z } from "zod";

import { INSTALLMENT_API_STATUSES, ORDER_PAYMENT_API_STATUSES } from "@/constants/payment";
import { ORDER_STATUS_UNKNOWN } from "@/constants/statuses";
import { api } from "@/lib/api/client";

const installmentSchema = z.object({
  installmentId: z.string(),
  seq: z.number().int(),
  name: z.string(),
  amount: z.number(),
  paidAmount: z.number(),
  /** Trạng thái lạ (BE thêm sau) → `UNKNOWN` ("Không rõ"), không làm hỏng khối (WF-05 BO-11). */
  status: z.union([
    z.enum(INSTALLMENT_API_STATUSES),
    z.string().transform((): typeof ORDER_STATUS_UNKNOWN => ORDER_STATUS_UNKNOWN),
  ]),
  /** Còn phải thu của đợt (BE `InstallmentResponse.outstanding`). */
  outstanding: z.number().nullish(),
  /** Hạn trả; null tới khi tới mốc, và với đợt trả trước khi giao. */
  dueDate: z.string().nullish(),
  /** Quá hạn hôm nay (BE tính lúc đọc). */
  overdue: z.boolean().nullish(),
  /** R5-12 (optional): how many days past `dueDate` it is still owing (0 when not). */
  daysOverdue: z.number().int().nullish(),
});

/** BE `OrderInstallmentsResponse.paymentStatus` — tính từ các đợt chưa huỷ; giá trị lạ → `UNKNOWN` ("Không rõ"). */
const paymentStatusSchema = z.union([
  z.enum(ORDER_PAYMENT_API_STATUSES),
  z.string().transform((): typeof ORDER_STATUS_UNKNOWN => ORDER_STATUS_UNKNOWN),
]);

export const orderInstallmentsSummarySchema = z.object({
  /** Vắng khi mọi đợt đã huỷ. */
  paymentStatus: paymentStatusSchema.nullish(),
  total: z.number(),
  paid: z.number(),
  /** Còn phải thu trên các đợt chưa huỷ. */
  outstanding: z.number().nullish(),
  /** BE tính từ mọi đợt ON_SIGNING (docs 15 BR-07); null khi response cũ chưa có cờ. */
  onSigningPaid: z.boolean().nullish(),
  /** Phải thu trước khi hàng rời kho: đợt khi ký + trước khi giao còn thiếu (docs 15 BR-07, BR-08). */
  dueBeforeHandover: z.number().nullish(),
  /** D46/D50: phần phí công ty chịu (0 = không). */
  feeBorneByCompany: z.number().nullish(),
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
