/**
 * Kho xuất của đơn — mutation (BE `PUT /orders/{id}/shipping-warehouse`, docs 17 §4.2 bước 2-3).
 *
 * Chọn kho giữ hàng ở kho đó nên đổi cả đơn (kho xuất, lịch sử) lẫn tồn khả dụng và phiếu giữ hàng → invalidate
 * `orderKeys.all` (kèm tình trạng giữ hàng và danh sách kho nằm dưới key này) + `RESERVATION_CHANGE_INVALIDATIONS`.
 * Không có `successMessage` cố định: lời báo phụ thuộc kết quả giữ hàng (đủ / một phần / chưa có) nên call site phát toast;
 * `showErrorToast: false` vì hộp thoại map lỗi theo `error.code` (`orderActionErrorView`, "shippingWarehouse").
 */

import { createMutation } from "@/lib/api/query-factory";
import { RESERVATION_CHANGE_INVALIDATIONS } from "@/lib/api/shared-query-keys";

import { orderKeys } from "./queries";
import { chooseShippingWarehouse } from "./shipping-warehouse-api";

import type { ChooseShippingWarehouseInput } from "./shipping-warehouse-api";
import type { ShippingCoverage } from "./shipping-warehouse-schemas";

export const useChooseShippingWarehouse = createMutation<
  ChooseShippingWarehouseInput,
  ShippingCoverage
>(chooseShippingWarehouse, {
  invalidate: [orderKeys.all, ...RESERVATION_CHANGE_INVALIDATIONS],
  showErrorToast: false,
});
