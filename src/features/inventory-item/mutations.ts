/**
 * Mutations hồ sơ hàng tồn. Lưu xong làm mới mọi query hồ sơ hàng tồn (danh sách, tóm tắt, detail);
 * màn hình có thể `setQueryData(detail)` bằng item trả về (version mới) để không chờ tải lại.
 * Lỗi do màn hình map (`inventoryItemErrorMessage`) → `showErrorToast: false`.
 */
import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";

import { saveItemLogistics, saveItemPolicy } from "./api";
import { inventoryItemKeys } from "./queries";

import type { InventoryItem, LogisticsFormValues, PolicyFormValues } from "./types";

const TOAST = TOAST_MESSAGES.inventoryItem;
// `all` phủ danh sách + tóm tắt (module khác) + detail
const invalidate = [inventoryItemKeys.all];

export const useSaveItemLogistics = createMutation<
  { id: string; version: number; values: LogisticsFormValues },
  InventoryItem
>(saveItemLogistics, { invalidate, showErrorToast: false, successMessage: TOAST.logisticsSaved });

export const useSaveItemPolicy = createMutation<
  { id: string; version: number; values: PolicyFormValues },
  InventoryItem
>(saveItemPolicy, { invalidate, showErrorToast: false, successMessage: TOAST.policySaved });
