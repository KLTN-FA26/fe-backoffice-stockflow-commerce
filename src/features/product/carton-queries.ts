import { useQuery } from "@tanstack/react-query";

import { UI_LABELS } from "@/constants";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { deleteSkuUnit, listSkuUnits, retireSkuUnit, saveCartonSpec } from "./carton-api";
import { isStaleCartonError } from "./carton-errors";
import { variantKeys } from "./variant-queries";
import { PRODUCT_HISTORY_ROOT } from "./queries";

import type { SaveCartonSpecInput, SkuUnitInput } from "./carton-api";
import type { UomConversion } from "./carton-schemas";

/**
 * Đơn vị tính của SKU (`GET .../uom-conversions`). Khoá nằm dưới `variantKeys.product` nên mọi thay đổi
 * biến thể (kể cả đổi SKU nháp) làm mới luôn. `enabled = false` khi thiếu quyền đọc / panel đóng.
 */
export function useSkuUnits(productId: string, variantId: string, enabled: boolean) {
  return useQuery({
    queryKey: variantKeys.units(productId, variantId),
    queryFn: ({ signal }) => listSkuUnits(productId, variantId, signal),
    ...QUERY_TIMES.detail,
    enabled,
  });
}

/**
 * Khai báo / sửa thùng: thành công làm mới đơn vị của biến thể + lịch sử sản phẩm (BE ghi
 * `UOM_CONVERSION`); dữ liệu cũ (`isStaleCartonError`) tải lại biến thể của sản phẩm.
 */
export const useSaveCartonSpec = withStaleRefetch(
  createMutation<SaveCartonSpecInput, UomConversion>(saveCartonSpec, {
    invalidate: [variantKeys.all, PRODUCT_HISTORY_ROOT],
    showErrorToast: false,
    successMessage: UI_LABELS.cartonSpec.saved,
  }),
  ({ productId }: SaveCartonSpecInput) => [variantKeys.product(productId)],
  isStaleCartonError,
);

const unitMutation = <TResult>(fn: (input: SkuUnitInput) => Promise<TResult>, message: string) =>
  withStaleRefetch(
    createMutation<SkuUnitInput, TResult>(fn, {
      invalidate: [variantKeys.all, PRODUCT_HISTORY_ROOT],
      showErrorToast: false,
      successMessage: message,
    }),
    ({ productId }: SkuUnitInput) => [variantKeys.product(productId)],
    isStaleCartonError,
  );

/** Ngưng dùng / xoá một đơn vị đóng gói (docs 01 BR-10). */
export const useRetireSkuUnit = unitMutation(retireSkuUnit, UI_LABELS.cartonSpec.retired);
export const useDeleteSkuUnit = unitMutation(deleteSkuUnit, UI_LABELS.cartonSpec.deleted);
