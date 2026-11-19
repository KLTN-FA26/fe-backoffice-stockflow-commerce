/**
 * Shipping — API sự kiện hãng vận chuyển (BE `CarrierEventController`, docs 09 §3 Output, §4.5 bước 2, 8).
 *
 *   GET  /fulfillment/carrier-events?result&open&carrierId&loadId&page&size   `fulfillment-carrier-events:READ`
 *        `result` = một kết quả, hoặc `ERRORS` (danh sách lỗi: RECEIVED, UNMATCHED, INVALID_SIGNATURE, NEEDS_REVIEW,
 *        UNVERIFIED); `open=true` chưa đánh dấu xử lý, `false` đã đánh dấu; mới nhất trước. Sự kiện chưa ghép chuyến
 *        là của mọi người có quyền, sự kiện đã ghép là của kho của chuyến.
 *   GET  /fulfillment/carrier-events/{eventId}   → sự kiện + nội dung hãng gửi (thông tin xác thực đã che)
 *   POST /fulfillment/carrier-events/{eventId}/resolution {note}   `fulfillment-carrier-events:UPDATE`
 *        → đánh dấu sự kiện lỗi đã xử lý tay (ghi tay / sửa tay kết quả giao, nhập mã vận đơn), không bao giờ áp lại.
 *        409 CARRIER_EVENT_NOT_RESOLVABLE (không thuộc danh sách lỗi / đã đánh dấu / đang xử lý), 404
 *        CARRIER_EVENT_NOT_FOUND, 403 OUT_OF_DATA_SCOPE, 400 VALIDATION_FAILED (thiếu ghi chú).
 * BE KHÔNG có thao tác áp lại sự kiện.
 */

import { CARRIER_EVENT_PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { beCarrierEventDetailSchema, beCarrierEventPageSchema } from "./carrier-event-schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { CarrierEventDetail, CarrierEventRow } from "./carrier-event-types";

export const CARRIER_EVENTS_PATH = "/fulfillment/carrier-events";

export interface ListCarrierEventParams extends ListQueryParams {
  /** Một kết quả của BE, hoặc `ERRORS`; vắng = mọi kết quả. */
  result?: string;
  open?: boolean;
  carrierId?: string;
  loadId?: string;
}

export const carrierEventPath = (eventId: string) =>
  `${CARRIER_EVENTS_PATH}/${encodeURIComponent(eventId)}`;

export async function listCarrierEvents(
  params: ListCarrierEventParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CarrierEventRow>> {
  const { data } = await api.get<unknown>(CARRIER_EVENTS_PATH, {
    params: {
      result: params.result || undefined,
      open: params.open,
      carrierId: params.carrierId || undefined,
      loadId: params.loadId || undefined,
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? CARRIER_EVENT_PAGE_SIZE,
    },
    signal,
  });
  return beCarrierEventPageSchema.parse(data);
}

export async function getCarrierEvent(
  eventId: string,
  signal?: AbortSignal,
): Promise<CarrierEventDetail> {
  const { data } = await api.get<unknown>(carrierEventPath(eventId), { signal });
  return beCarrierEventDetailSchema.parse(data);
}

/** Đánh dấu một sự kiện lỗi đã xử lý tay, kèm ghi chú bắt buộc. */
export async function resolveCarrierEvent(input: {
  eventId: string;
  note: string;
}): Promise<CarrierEventDetail> {
  const { data } = await api.post<unknown>(`${carrierEventPath(input.eventId)}/resolution`, {
    note: input.note,
  });
  return beCarrierEventDetailSchema.parse(data);
}
