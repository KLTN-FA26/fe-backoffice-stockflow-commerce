import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { setVariantDescription } from "./description-api";
import { PRODUCT_HISTORY_ROOT } from "./queries";
import { isStaleVariantError } from "./variant-errors";
import { variantKeys } from "./variant-queries";

/**
 * Lưu mô tả riêng của biến thể (ADR-0013). Như mọi thay đổi biến thể: làm mới biến thể + lịch sử sản phẩm; lỗi dữ
 * liệu cũ tải lại biến thể trước khi màn hình báo lỗi.
 */
export const useSetVariantDescription = withStaleRefetch(
  createMutation(setVariantDescription, {
    invalidate: [variantKeys.all, PRODUCT_HISTORY_ROOT],
    showErrorToast: false,
    successMessage: "Đã lưu mô tả biến thể",
  }),
  (input: { productId: string }) => [variantKeys.product(input.productId)],
  isStaleVariantError,
);
