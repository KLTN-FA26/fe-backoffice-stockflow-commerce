/**
 * Mutation module 06 + invalidation (api-conventions §2.3). Mọi thay đổi bản đồ làm mới bố cục và danh
 * sách vị trí dùng chung (`lib/references` — màn lấy hàng / cất hàng đọc cùng layout). Tạo kho làm mới
 * danh mục kho lẫn ô chọn kho của module khác. Lỗi hiện tại chỗ (form / thanh lưu) → tắt toast lỗi.
 */

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";
import { warehouseLocationKeys } from "@/lib/references/warehouse-locations";
import { warehouseOptionKeys } from "@/lib/references/warehouse-options";

import { changePlaceStatus, createWarehouse } from "./api";
import { DraftSaveError, saveMapDraft } from "./draft-save";
import { isStaleLayoutError } from "./errors";
import { warehouseKeys, warehouseLayoutKeys } from "./queries";

const T = TOAST_MESSAGES.warehouseMap;
const LAYOUT = [warehouseLayoutKeys.all, warehouseLocationKeys.all];
const base = { invalidate: LAYOUT, showErrorToast: false } as const;

export const useCreateWarehouse = createMutation(createWarehouse, {
  invalidate: [warehouseKeys.all, warehouseOptionKeys.all],
  successMessage: T.warehouseCreated,
  showErrorToast: false,
});

const layoutMutation = <TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  successMessage: string,
) => withStaleRefetch(createMutation(fn, { ...base, successMessage }), LAYOUT, isStaleLayoutError);

export const useChangePlaceStatus = layoutMutation(changePlaceStatus, T.statusChanged);

/**
 * Lưu toàn bộ bản nháp bản đồ (chế độ sửa) — tuần tự từng request, xem `draft-save.ts`. Hỏng giữa
 * chừng vẫn làm mới bố cục (phần đã lưu là thật); màn hình ghi nhận phần đó vào bản nháp.
 */
export const useSaveMapDraft = withStaleRefetch(
  createMutation(saveMapDraft, { ...base, successMessage: T.saved }),
  LAYOUT,
  (error) =>
    isStaleLayoutError(error) ||
    (error instanceof DraftSaveError &&
      error.result.saved.length + error.result.removedKeys.length > 0),
);
