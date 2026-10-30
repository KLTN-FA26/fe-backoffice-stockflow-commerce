/**
 * Mutation module 06 + invalidation (api-conventions §2.3). Mọi thay đổi bản đồ làm mới bố cục và danh
 * sách vị trí dùng chung (`lib/references` — màn lấy hàng / cất hàng đọc cùng layout). Tạo kho làm mới
 * danh mục kho lẫn ô chọn kho của module khác. Lỗi hiện trong form (đã map tiếng Việt) → tắt toast lỗi.
 */

import { TOAST_MESSAGES } from "@/constants";
import { newIdempotencyKey } from "@/lib/api/idempotency";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";
import { warehouseLocationKeys } from "@/lib/references/warehouse-locations";
import { warehouseOptionKeys } from "@/lib/references/warehouse-options";

import {
  addShelfLevel,
  changePlaceStatus,
  createArea,
  createBoundary,
  createShelf,
  createWarehouse,
  createZone,
  deleteBoundary,
  generateShelfBins,
} from "./api";
import { isStaleLayoutError, ShelfPartiallyCreatedError } from "./errors";
import { warehouseKeys, warehouseLayoutKeys } from "./queries";

import type { ShelfCreateStep, ShelfCreateValues } from "./types";

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

export const useCreateZone = layoutMutation(createZone, T.zoneCreated);
export const useCreateArea = layoutMutation(createArea, T.areaCreated);
export const useCreateBoundary = layoutMutation(createBoundary, T.boundaryCreated);
export const useDeleteBoundary = layoutMutation(deleteBoundary, T.boundaryDeleted);
export const useChangePlaceStatus = layoutMutation(changePlaceStatus, T.statusChanged);

export interface CreateShelfInput {
  warehouseId: string;
  values: ShelfCreateValues;
  onStep?: (step: ShelfCreateStep) => void;
}

/**
 * "Thêm kệ" = tạo kệ → tạo tầng 1..N → tự sinh bin cho mọi tầng vừa tạo (BR-14). BE không có API gộp:
 * hỏng sau bước 1 thì kệ đã có trên bản đồ → `ShelfPartiallyCreatedError` (bố cục được tải lại).
 */
export async function createShelfWithBins({ warehouseId, values, onStep }: CreateShelfInput) {
  onStep?.({ phase: "shelf" });
  const shelf = await createShelf(warehouseId, values);
  try {
    const levelIds: string[] = [];
    for (let index = 1; index <= values.levelCount; index += 1) {
      onStep?.({ phase: "levels", done: index - 1, total: values.levelCount });
      levelIds.push((await addShelfLevel(shelf.id, index, values.levelHeight)).id);
    }
    if (values.generateBins && levelIds.length > 0) {
      onStep?.({ phase: "bins" });
      await generateShelfBins(shelf.id, levelIds, values, newIdempotencyKey());
    }
  } catch (error) {
    throw new ShelfPartiallyCreatedError(error);
  }
  return shelf;
}

export const useCreateShelf = layoutMutation(createShelfWithBins, T.shelfCreated);
