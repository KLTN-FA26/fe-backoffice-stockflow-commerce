/**
 * Thẻ thiếu thùng — API (BE `ShortageCardController`, `StaffChatActionsController`; docs 17 §4.14, BR-33):
 *
 *   GET  /orders/{id}/shortage                                           — sales-orders:READ (xem trước + lịch sử thẻ)
 *   POST /chat/conversations/{cid}/cards/shortage {orderId,note,replaceLive} — chat-conversations:UPDATE (người được giao hội thoại)
 *   POST /orders/{id}/shortage-cards/{cardId}/execution/wait-for-production {version,moveWindow,windowEnd,note}
 *                                                                        — sales-order-holds:UPDATE (+ sales-contracts:UPDATE khi dời cửa sổ)
 *   POST …/execution/reduce-cartons {version}      — "Giảm số thùng" (BE-3, spec UNHASK §3.3; chưa có trong BE-1/BE-2)
 *   POST …/execution/ship-part {version,note}      — sales-order-partial-shipments:UPDATE + sales-order-holds:UPDATE
 *   POST …/execution/close-rest {version,reasonCode,note,agreedFee} — sales-order-cancellations:UPDATE
 *   POST …/execution/cancel {version,note}         — sales-order-cancellations:UPDATE (lý do cố định OUT_OF_STOCK ở BE)
 *
 * Mọi lệnh Thực hiện chạy trong MỘT giao dịch BE (bị từ chối thì không đổi gì, thẻ giữ `ANSWERED`) và gửi kèm
 * Idempotency-Key.
 */

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";
import { findConversationAbout, findConversationOfCustomer } from "@/lib/references/chat-lookup";

import { orderPath } from "./api";
import { shortageCardSchema, shortagePreviewSchema } from "./shortage-card-schemas";

import type { FeeBearer } from "@/constants";
import type { ShortageWaitValues } from "./shortage-card-schemas";

const cardPath = (orderId: string, cardId: string, step: string) =>
  orderPath(orderId, `/shortage-cards/${encodeURIComponent(cardId)}/execution/${step}`);

export async function getShortagePreview(orderId: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(orderPath(orderId, "/shortage"), { signal });
  return shortagePreviewSchema.parse(data);
}

export interface SendShortageCardInput {
  orderId: string;
  customerId: string | null;
  note?: string;
  replaceLive: boolean;
}

/** Mã lỗi FE (không phải của BE): khách chưa có hội thoại nào để gửi thẻ vào. */
export const NO_SHORTAGE_CONVERSATION = "SHORTAGE_NO_CONVERSATION";

/**
 * Sale gửi thẻ vào hội thoại về đơn (không có thì hội thoại của khách); BE lập nội dung từ đơn, Sale chỉ gõ lời nhắn — 16
 * BR-15 — và gắn đơn vào hội thoại. Khách chưa có hội thoại → lỗi `NO_SHORTAGE_CONVERSATION`.
 */
export async function sendShortageCard(input: SendShortageCardInput): Promise<void> {
  const conversationId =
    (await findConversationAbout("ORDER", input.orderId)) ??
    (input.customerId ? await findConversationOfCustomer(input.customerId) : null);
  if (!conversationId) throw new ApiError(404, NO_SHORTAGE_CONVERSATION, "No conversation");
  await api.post<unknown>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/cards/shortage`,
    {
      orderId: input.orderId,
      note: input.note || undefined,
      replaceLive: input.replaceLive,
    },
  );
}

interface ExecuteBase {
  orderId: string;
  cardId: string;
  /** Phiên bản thẻ Sale đang thấy. */
  version: number;
  idempotencyKey?: string;
}

async function execute(input: ExecuteBase, step: string, body: object) {
  const { data } = await api.post<unknown>(
    cardPath(input.orderId, input.cardId, step),
    { version: input.version, ...body },
    idempotencyRequestConfig(input.idempotencyKey),
  );
  return shortageCardSchema.parse(data);
}

export const executeWait = (input: ExecuteBase & ShortageWaitValues) =>
  execute(input, "wait-for-production", {
    moveWindow: input.moveWindow,
    windowEnd: input.moveWindow ? input.windowEnd : undefined,
    note: input.note || undefined,
  });

export const executeReduce = (input: ExecuteBase) => execute(input, "reduce-cartons", {});

export const executeShipPart = (input: ExecuteBase & { note?: string }) =>
  execute(input, "ship-part", { note: input.note || undefined });

export const executeCancel = (input: ExecuteBase & { note?: string }) =>
  execute(input, "cancel", { note: input.note || undefined });

export const executeCloseRest = (
  input: ExecuteBase & {
    reasonCode: string;
    note?: string;
    agreedFee?: { amount: number; reason: string; detail: string };
    feeBearer?: FeeBearer;
  },
) =>
  execute(input, "close-rest", {
    reasonCode: input.reasonCode,
    note: input.note || undefined,
    ...(input.agreedFee ? { agreedFee: input.agreedFee } : {}),
    ...(input.agreedFee && input.feeBearer ? { feeBearer: input.feeBearer } : {}),
  });
