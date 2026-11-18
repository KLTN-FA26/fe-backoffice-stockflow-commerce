/**
 * Mutations hồ sơ hàng tồn. Lưu xong làm mới mọi query hồ sơ hàng tồn (danh sách, gợi ý, detail);
 * màn hình có thể `setQueryData(detail)` bằng item trả về (version mới) để không chờ tải lại.
 * Lỗi do màn hình map (`inventoryItemErrorMessage`) → `showErrorToast: false`.
 */
import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";

import { saveItemLogistics } from "./api";
import { inventoryItemKeys } from "./queries";

import type { InventoryItem, LogisticsFormValues } from "./types";

const TOAST = TOAST_MESSAGES.inventoryItem;

export const useSaveItemLogistics = createMutation<
  { id: string; version: number; values: LogisticsFormValues },
  InventoryItem
>(saveItemLogistics, {
  invalidate: [inventoryItemKeys.all],
  showErrorToast: false,
  successMessage: TOAST.logisticsSaved,
});
