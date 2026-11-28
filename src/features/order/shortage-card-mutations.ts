/**
 * Thẻ thiếu thùng — mutation hooks. Thực hiện đổi đơn (gỡ treo, huỷ dòng thiếu, giữ chỗ, lịch giao, tiền): invalidate
 * `orderKeys.all` + giữ chỗ + tác vụ lấy hàng. Gửi thẻ chỉ đổi thẻ và chat. `showErrorToast: false` — hộp thoại hiện lỗi.
 */

import { SHARED_QUERY_ROOTS, SHORTAGE_LABELS } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { RESERVATION_CHANGE_INVALIDATIONS } from "@/lib/api/shared-query-keys";

import {
  executeCancel,
  executeCloseRest,
  executeReduce,
  executeShipPart,
  executeWait,
  sendShortageCard,
} from "./shortage-card-api";
import { orderKeys } from "./queries";

const EXECUTED = {
  invalidate: [
    orderKeys.all,
    ...RESERVATION_CHANGE_INVALIDATIONS,
    [SHARED_QUERY_ROOTS.fulfillmentTasks],
  ],
  successMessage: SHORTAGE_LABELS.success.executed,
  showErrorToast: false,
} as const;

export const useSendShortageCard = createMutation(sendShortageCard, {
  invalidate: [orderKeys.all, QUERY_ROOTS.chat],
  successMessage: SHORTAGE_LABELS.success.sent,
  showErrorToast: false,
});
export const useExecuteShortageWait = createMutation(executeWait, EXECUTED);
export const useExecuteShortageReduce = createMutation(executeReduce, EXECUTED);
export const useExecuteShortageShipPart = createMutation(executeShipPart, EXECUTED);
export const useExecuteShortageCancel = createMutation(executeCancel, EXECUTED);
export const useExecuteShortageCloseRest = createMutation(executeCloseRest, {
  ...EXECUTED,
  successMessage: SHORTAGE_LABELS.success.closed,
});
