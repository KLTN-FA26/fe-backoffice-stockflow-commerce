/**
 * Giữ hoàn tất đơn — API (BE `OrderCompletionHoldController`, WF-05 GH-2):
 *
 *   GET  /orders/{orderId}/completion-hold           — sales-orders:READ; data null khi đơn không bị giữ
 *   POST /orders/{orderId}/completion-hold           {reasonCode, note?} — sales-order-holds:UPDATE
 *   POST /orders/{orderId}/completion-hold/release   {note}              — sales-order-holds:UPDATE
 *
 * Mọi thao tác ghi gửi kèm Idempotency-Key. Lỗi 409: ORDER_COMPLETION_ALREADY_HELD, ORDER_COMPLETION_HOLD_NOT_APPLICABLE,
 * ORDER_COMPLETION_NOT_HELD (map ở `errors.ts` → `completionHoldErrorView`).
 */

import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { orderPath } from "./api";
import { completionHoldSchema, currentCompletionHoldSchema } from "./completion-hold-schemas";

import type {
  CompletionHold,
  HoldCompletionValues,
  ReleaseCompletionHoldValues,
} from "./completion-hold-schemas";

const holdPath = (orderId: string, suffix = "") => orderPath(orderId, `/completion-hold${suffix}`);

export async function getCompletionHold(
  orderId: string,
  signal?: AbortSignal,
): Promise<CompletionHold | null> {
  const { data } = await api.get<unknown>(holdPath(orderId), { signal });
  return currentCompletionHoldSchema.parse(data);
}

export type HoldCompletionInput = Pick<HoldCompletionValues, "reasonCode"> & {
  orderId: string;
  /** Bỏ trống = không gửi (BE chỉ bắt buộc với OTHER). */
  note?: string;
  idempotencyKey?: string;
};

/** Giữ hoàn tất: bỏ `note` khi trống (BE chỉ bắt buộc với OTHER — schema input đã kiểm). */
export async function holdCompletion(input: HoldCompletionInput): Promise<CompletionHold> {
  const { orderId, idempotencyKey, reasonCode, note } = input;
  const { data } = await api.post<unknown>(
    holdPath(orderId),
    note === undefined ? { reasonCode } : { reasonCode, note },
    idempotencyRequestConfig(idempotencyKey),
  );
  return completionHoldSchema.parse(data);
}

export type ReleaseCompletionHoldInput = ReleaseCompletionHoldValues & {
  orderId: string;
  idempotencyKey?: string;
};

export async function releaseCompletionHold(
  input: ReleaseCompletionHoldInput,
): Promise<CompletionHold> {
  const { orderId, idempotencyKey, note } = input;
  const { data } = await api.post<unknown>(
    holdPath(orderId, "/release"),
    { note },
    idempotencyRequestConfig(idempotencyKey),
  );
  return completionHoldSchema.parse(data);
}
