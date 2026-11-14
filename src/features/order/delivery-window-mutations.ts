/**
 * Dời cửa sổ giao — mutation hook (BE `DeliveryBatchController#changeWindow`, docs 17 §4.5, BR-28).
 *
 * Đổi lịch giao hiệu lực (`orderKeys.deliverySchedule` nằm dưới `orderKeys.all`), lấy lại ngày cần hàng của Đơn sản xuất
 * còn `Draft` của đợt (`orderKeys.productionOrders` cũng dưới `orderKeys.all`) và gỡ / dựng chặn "chưa tới cửa sổ giao" của
 * bàn giao nên làm mới chuyến xe (`fulfillmentLoads`). `showErrorToast: false`: hộp thoại tự map lỗi theo `error.code`.
 */

import { SHARED_QUERY_ROOTS, WINDOW_CHANGE_LABELS } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";

import { changeDeliveryWindow } from "./delivery-window-api";
import { orderKeys } from "./queries";

import type { DeliverySchedule } from "./delivery-batch-api";
import type { ChangeDeliveryWindowInput } from "./delivery-window-api";

export const useChangeDeliveryWindow = createMutation<ChangeDeliveryWindowInput, DeliverySchedule>(
  changeDeliveryWindow,
  {
    invalidate: [orderKeys.all, [SHARED_QUERY_ROOTS.fulfillmentLoads]],
    successMessage: WINDOW_CHANGE_LABELS.success,
    showErrorToast: false,
  },
);
