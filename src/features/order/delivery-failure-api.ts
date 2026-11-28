/**
 * Lô hàng hoàn về — API (BE `DeliveryFailureController`, WF-05 GH-1; docs 09 §4.3, 17 §4.8):
 *
 *   GET  /orders/delivery-failures?status&limit            — sales-orders:READ (back office; WM chỉ thấy kho mình)
 *   GET  /orders/{orderId}/delivery-failures               — sales-orders:READ
 *   POST /orders/{orderId}/delivery-failures/{caseId}/cancellation {note, agreedFee?}     — sales-order-cancellations:UPDATE
 *   POST /orders/{orderId}/delivery-failures/cancellation  {note, agreedFee?}  (chưa có hồ sơ) — sales-order-cancellations:UPDATE
 *
 * "Giao lại" (`…/redelivery`) BE đã xoá ở PR #377 (gửi lại = đơn mới, Q-12) — FE không gọi nữa (WF-05 BO-01). Hai lệnh
 * huỷ chỉ còn cho đơn cũ đang giữ vì giao thất bại (Q-13).
 *
 * Danh sách KHÔNG phân trang (BE trả `List`, `limit` ≤ 200). Mọi thao tác ghi gửi kèm Idempotency-Key.
 */

import { DELIVERY_FAILURE_LIMITS } from "@/constants";
import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { ORDERS_PATH, orderPath } from "./api";
import {
  deliveryFailureCaseListSchema,
  deliveryFailureCaseSchema,
} from "./delivery-failure-schemas";

import type { CancelUndeliveredValues, DeliveryFailureCase } from "./delivery-failure-schemas";

export interface ListDeliveryFailureParams {
  /** BE `DeliveryFailureCase.Status`; vắng = mọi trạng thái. */
  status?: "OPEN" | "REDELIVERY" | "REDELIVERED" | "CANCELLED";
}

export async function listDeliveryFailures(
  params: ListDeliveryFailureParams,
  signal?: AbortSignal,
): Promise<DeliveryFailureCase[]> {
  const { data } = await api.get<unknown>(`${ORDERS_PATH}/delivery-failures`, {
    params: { status: params.status, limit: DELIVERY_FAILURE_LIMITS.listLimit },
    signal,
  });
  return deliveryFailureCaseListSchema.parse(data);
}

export async function listOrderDeliveryFailures(
  orderId: string,
  signal?: AbortSignal,
): Promise<DeliveryFailureCase[]> {
  const { data } = await api.get<unknown>(orderPath(orderId, "/delivery-failures"), { signal });
  return deliveryFailureCaseListSchema.parse(data);
}

const casePath = (orderId: string, caseId: string, step: string) =>
  orderPath(orderId, `/delivery-failures/${encodeURIComponent(caseId)}/${step}`);

export type CancelUndeliveredInput = CancelUndeliveredValues & {
  orderId: string;
  /** Vắng = huỷ khi chưa có hồ sơ (hàng mất trên đường về / kho chưa lập phiếu nhận hàng hoàn). */
  caseId?: string;
  idempotencyKey?: string;
};

/** Huỷ phần chưa giao — theo hồ sơ, hoặc (không `caseId`) khi lô về chưa có hồ sơ. Trả các hồ sơ bị ảnh hưởng. */
export async function cancelUndelivered(
  input: CancelUndeliveredInput,
): Promise<DeliveryFailureCase[]> {
  const { orderId, caseId, idempotencyKey, note, agreedFee, feeBearer } = input;
  const body = agreedFee ? { note, agreedFee, feeBearer } : { note };
  const config = idempotencyRequestConfig(idempotencyKey);
  if (caseId) {
    const { data } = await api.post<unknown>(
      casePath(orderId, caseId, "cancellation"),
      body,
      config,
    );
    return [deliveryFailureCaseSchema.parse(data)];
  }
  const { data } = await api.post<unknown>(
    orderPath(orderId, "/delivery-failures/cancellation"),
    body,
    config,
  );
  return deliveryFailureCaseListSchema.parse(data);
}
