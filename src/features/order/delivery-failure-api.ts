/**
 * Giao thất bại — API (BE `DeliveryFailureController`, WF-05 GH-1; docs 09 §4.3, 17 §4.8):
 *
 *   GET  /orders/delivery-failures?status&limit            — sales-orders:READ (back office; WM chỉ thấy kho mình)
 *   GET  /orders/{orderId}/delivery-failures               — sales-orders:READ
 *   POST /orders/{orderId}/delivery-failures/{caseId}/redelivery   {note, failedTripFee?} — sales-order-holds:UPDATE
 *   POST /orders/{orderId}/delivery-failures/{caseId}/cancellation {note, agreedFee?}     — sales-order-cancellations:UPDATE
 *   POST /orders/{orderId}/delivery-failures/cancellation  {note, agreedFee?}  (chưa có hồ sơ) — sales-order-cancellations:UPDATE
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

import type {
  CancelUndeliveredValues,
  DeliveryFailureCase,
  RedeliveryValues,
} from "./delivery-failure-schemas";

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

export type RedeliverInput = RedeliveryValues & {
  orderId: string;
  caseId: string;
  idempotencyKey?: string;
};

/** Giao lại: hồ sơ → REDELIVERY, đơn rời trạng thái giữ khi không còn hồ sơ chờ. */
export async function redeliverFailedShipment(input: RedeliverInput): Promise<DeliveryFailureCase> {
  const { orderId, caseId, idempotencyKey, note, failedTripFee } = input;
  const { data } = await api.post<unknown>(
    casePath(orderId, caseId, "redelivery"),
    failedTripFee === undefined ? { note } : { note, failedTripFee },
    idempotencyRequestConfig(idempotencyKey),
  );
  return deliveryFailureCaseSchema.parse(data);
}

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
  const { orderId, caseId, idempotencyKey, note, agreedFee } = input;
  const body = agreedFee ? { note, agreedFee } : { note };
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
