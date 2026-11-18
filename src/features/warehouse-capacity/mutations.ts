/**
 * Mutation Bảng sức chứa + invalidation (api-conventions §2.3). Đổi hệ số sử dụng làm Sức chứa / Còn trống / % của
 * mọi cấp tính lại (docs 06 §4.6 bước 2) → làm mới toàn bộ `capacityKeys`. Lỗi hiện trong hộp thoại → tắt toast lỗi.
 */

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";

import { updateUtilizationFactor } from "./api";
import { capacityKeys } from "./queries";

export const useUpdateUtilizationFactor = createMutation(updateUtilizationFactor, {
  invalidate: [capacityKeys.all],
  successMessage: TOAST_MESSAGES.warehouseCapacity.factorSaved,
  showErrorToast: false,
});
