/**
 * Shipping — mutation đánh dấu sự kiện lỗi đã xử lý (docs 09 §4.5 bước 8). Hộp thoại hiện lỗi inline nên không bật toast
 * lỗi; sự kiện đã đổi ở nơi khác (đã đánh dấu rồi, đang xử lý) làm mới danh sách và chi tiết để màn hiện đúng trạng thái.
 */

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { resolveCarrierEvent } from "./carrier-event-api";
import { carrierEventKeys } from "./carrier-event-queries";

import type { CarrierEventDetail } from "./carrier-event-types";

const ROOT = [carrierEventKeys.all];

export const useResolveCarrierEvent = withStaleRefetch(
  createMutation<{ eventId: string; note: string }, CarrierEventDetail>(resolveCarrierEvent, {
    invalidate: ROOT,
    successMessage: TOAST_MESSAGES.shipping.carrierEventResolved,
    showErrorToast: false,
  }),
  ROOT,
  ["CARRIER_EVENT_NOT_RESOLVABLE", "CARRIER_EVENT_NOT_FOUND"],
);
