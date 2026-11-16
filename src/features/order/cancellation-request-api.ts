/**
 * Yêu cầu huỷ của khách — API layer (BE `CancellationRequestController`, docs 17 §4.8 bước 28–30, §5.4). Cùng quy ước
 * `api.ts`: path không có `v1`, parse zod một lần ở biên rồi map DTO → model FE.
 *
 * - GET  /orders/cancellation-requests?status&orderId&page&size — `sales-order-cancellations:READ` (mới nhất trước)
 * - POST /orders/{orderId}/cancellation-requests/{requestId}/approval {note?, retainedPercent? | agreedFee?}
 *     — `sales-order-cancellations:UPDATE`; huỷ đơn trong cùng giao dịch, trả `OrderResponse`
 * - POST /orders/{orderId}/cancellation-requests/{requestId}/rejection {note} — trả yêu cầu đã quyết
 * - GET  /refunds/orders/{orderId} — `payment-refunds:READ`: kết quả tất toán (đã thu / phí / phải hoàn / phí còn thiếu)
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { ORDERS_PATH, orderPath, toOrder } from "./api";
import {
  cancellationRequestDtoSchema,
  cancellationRequestPageDtoSchema,
  orderRefundDtoSchema,
} from "./cancellation-request-schemas";
import { orderDtoSchema } from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  ApproveCancellationValues,
  CancellationRequest,
  CancellationRequestDto,
  OrderRefundDto,
  RejectCancellationValues,
} from "./cancellation-request-schemas";
import type { Order } from "./types";

const REQUESTS_PATH = `${ORDERS_PATH}/cancellation-requests`;
const REFUNDS_PATH = "/refunds/orders";

export interface ListCancellationRequestParams extends ListQueryParams {
  /** Trang đánh số từ 0 (BE PageResponse). */
  page?: number;
  size?: number;
  /** BE `CancellationRequestStatus` (PENDING = hàng đợi cần quyết). */
  status?: string;
  /** UUID đơn — thẻ "Yêu cầu huỷ" trên chi tiết đơn chỉ lấy yêu cầu của đơn đó. */
  orderId?: string;
}

/** DTO BE → model FE (field vắng → null). Pure — export để test. */
export function toCancellationRequest(dto: CancellationRequestDto): CancellationRequest {
  return {
    requestId: dto.requestId,
    orderId: dto.orderId,
    reasonCode: dto.reasonCode,
    note: dto.note ?? null,
    requestedAt: dto.requestedAt,
    status: dto.status,
    decidedAt: dto.decidedAt ?? null,
    decisionNote: dto.decisionNote ?? null,
    retainedPercent: dto.retainedPercent ?? null,
  };
}

export async function listCancellationRequests(
  params: ListCancellationRequestParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CancellationRequest>> {
  const { page = 0, size = PAGE_SIZE.md, status, orderId } = params;
  const query = new URLSearchParams({ page: String(Math.max(0, page)), size: String(size) });
  if (status) query.set("status", status);
  if (orderId) query.set("orderId", orderId);
  const { data } = await api.get<unknown>(REQUESTS_PATH, { params: query, signal });
  const parsed = cancellationRequestPageDtoSchema.parse(data);
  return { ...parsed, items: parsed.items.map(toCancellationRequest) };
}

/** Biến của quyết định: đơn + yêu cầu + input + `Idempotency-Key` (header, không vào body). */
export type CancellationDecisionVars<T> = T & {
  orderId: string;
  requestId: string;
  idempotencyKey?: string;
};

const decisionPath = (orderId: string, requestId: string, step: "approval" | "rejection") =>
  orderPath(orderId, `/cancellation-requests/${encodeURIComponent(requestId)}/${step}`);

/**
 * Body đúng `ApproveCancellationRequest`: bỏ `note` khi trống, chỉ gửi phí khi có — không phí = hoàn toàn bộ. Trả đơn
 * đã huỷ (`OrderResponse`); kết quả tiền nằm ở `getOrderRefund`.
 */
export async function approveCancellationRequest(
  input: CancellationDecisionVars<ApproveCancellationValues>,
): Promise<Order> {
  const { orderId, requestId, idempotencyKey, note, retainedPercent, agreedFee } = input;
  const body = {
    ...(note ? { note } : {}),
    ...(retainedPercent !== undefined ? { retainedPercent } : {}),
    ...(agreedFee ? { agreedFee } : {}),
  };
  const { data } = await api.post<unknown>(
    decisionPath(orderId, requestId, "approval"),
    body,
    idempotencyRequestConfig(idempotencyKey),
  );
  return toOrder(orderDtoSchema.parse(data));
}

export async function rejectCancellationRequest(
  input: CancellationDecisionVars<RejectCancellationValues>,
): Promise<CancellationRequest> {
  const { orderId, requestId, idempotencyKey, note } = input;
  const { data } = await api.post<unknown>(
    decisionPath(orderId, requestId, "rejection"),
    { note },
    idempotencyRequestConfig(idempotencyKey),
  );
  return toCancellationRequest(cancellationRequestDtoSchema.parse(data));
}

export async function getOrderRefund(
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderRefundDto> {
  const { data } = await api.get<unknown>(`${REFUNDS_PATH}/${encodeURIComponent(orderId)}`, {
    signal,
  });
  return orderRefundDtoSchema.parse(data);
}
